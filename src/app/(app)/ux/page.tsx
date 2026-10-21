import type { Metadata } from "next";
import { Eye } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Chip, type Tone } from "@/components/ui/chip";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Notice } from "@/components/ui/notice";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guard";
import {
  computeFreshness,
  formatAge,
  SYNC_INTERVALS,
  type FreshnessState,
} from "@/domain/freshness";

export const metadata: Metadata = { title: "Heatmaps & UX" };
export const dynamic = "force-dynamic";

interface ClarityConnection {
  id: string;
  display_label: string;
  status: string;
  last_success_at: string | null;
  last_attempt_at: string | null;
  last_error_code: string | null;
}

interface ClarityProject {
  id: string;
  connection_id: string | null;
  display_label: string;
  identifiers: Record<string, unknown>;
}

/** The connection status, in words. */
function statusLabel(status: string): string {
  const words = status.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The tone a connection status carries. */
function statusTone(status: string): Tone {
  if (status === "connected") return "success";
  if (status === "needs_setup") return "warning";
  return "danger";
}

/** The short name of a freshness state, for a tile. */
const FRESHNESS_LABEL: Record<FreshnessState, string> = {
  fresh: "Up to date",
  aging: "Refresh overdue",
  stale: "Data is stale",
  failing: "Sync failing",
  never: "Never synced",
};

/** The newest of a set of timestamps, or null when there is none. */
function newestTimestamp(values: Array<string | null>): string | null {
  let newest: string | null = null;
  let newestAt = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (!value) continue;
    const at = Date.parse(value);
    if (!Number.isFinite(at)) continue;
    if (at > newestAt) {
      newest = value;
      newestAt = at;
    }
  }
  return newest;
}

/** The connection with the most recent activity. */
function activeConnection(
  connections: ClarityConnection[],
): ClarityConnection | null {
  const newest = newestTimestamp(
    connections.map((connection) => connection.last_success_at),
  );
  if (!newest) return connections[0] ?? null;
  return (
    connections.find((connection) => connection.last_success_at === newest) ??
    connections[0] ??
    null
  );
}

/** The Clarity project id an account carries, when it has one. */
function projectIdOf(project: ClarityProject): string | null {
  const clarity = project.identifiers?.clarity as
    | { projectId?: unknown }
    | undefined;
  const projectId = clarity?.projectId;
  return typeof projectId === "string" && projectId.length > 0 ? projectId : null;
}

/**
 * Heatmaps and UX.
 *
 * CCM holds the Clarity connection and links to the native project for
 * replay and heatmaps. It does not store session recordings, form fields,
 * page text or private identifiers, and this release has no Clarity sync:
 * no behaviour metric has ever been read from the provider.
 */
export default async function UxPage() {
  const session = await getSession();
  const guard = await requirePermission(session, "ux.read");
  if (!guard.allowed) return guard.response;

  const supabase = await createClient();
  const workspaceId = session.workspaceId!;

  // A failed query is **not** an empty result. "We could not read the
  // connections" and "there are no connections" are different facts, and
  // the screen must not confuse them.
  let connections: ClarityConnection[] = [];
  let projects: ClarityProject[] = [];
  let failure: string | null = null;

  const connectionResult = await supabase
    .from("provider_connections")
    .select(
      "id, display_label, status, last_success_at, last_attempt_at, last_error_code",
    )
    .eq("workspace_id", workspaceId)
    .eq("provider_key", "clarity");

  if (connectionResult.error) {
    failure = `The Clarity connections could not be read: ${connectionResult.error.message}`;
  } else {
    connections = (connectionResult.data ?? []) as ClarityConnection[];
  }

  if (!failure) {
    const projectResult = await supabase
      .from("external_accounts")
      .select("id, connection_id, display_label, identifiers")
      .eq("workspace_id", workspaceId)
      .eq("provider_key", "clarity");

    if (projectResult.error) {
      failure = `The Clarity projects could not be read: ${projectResult.error.message}`;
    } else {
      projects = (projectResult.data ?? []) as ClarityProject[];
    }
  }

  // Reading provider connections needs the Integrations permission. Without
  // it the database returns no rows at all, which looks exactly like "not
  // connected" — so the screen says it cannot tell instead of claiming a
  // state it did not read.
  const canReadConnections = session.permissions.has("integrations.read");

  const connection = activeConnection(connections);
  const lastSync = newestTimestamp(
    connections.map((item) => item.last_success_at),
  );
  const lastSyncAt = lastSync ? Date.parse(lastSync) : Number.NaN;
  const ageSeconds = Number.isFinite(lastSyncAt)
    ? (new Date().getTime() - lastSyncAt) / 1000
    : null;

  const freshness = computeFreshness({
    lastSuccessAt: lastSync,
    lastAttemptAt: connection?.last_attempt_at ?? null,
    lastAttemptFailed: connection?.last_error_code != null,
    targetIntervalSeconds: SYNC_INTERVALS.clarity,
    now: new Date(),
  });

  const tiles = [
    {
      label: "Connection",
      value: canReadConnections
        ? connection
          ? statusLabel(connection.status)
          : "Not connected"
        : "—",
      detail: canReadConnections
        ? connection
          ? `Status of the Clarity connection "${connection.display_label}": ${statusLabel(connection.status).toLowerCase()}.`
          : "CCM holds no Clarity connection for this workspace."
        : "Reading provider connections needs the Integrations permission, so this role cannot see whether Clarity is connected.",
    },
    {
      label: "Last sync",
      value: ageSeconds === null ? "—" : formatAge(ageSeconds),
      detail:
        ageSeconds === null
          ? lastSync
            ? "The recorded sync time could not be read, so its age is unknown."
            : "No Clarity sync has ever succeeded, so there is no last sync to show."
          : "The last successful Clarity sync. The target is one a day.",
    },
    {
      label: "Sync state",
      value: FRESHNESS_LABEL[freshness.state],
      detail: freshness.label,
    },
    {
      label: "Projects",
      value: canReadConnections ? String(projects.length) : "—",
      detail: canReadConnections
        ? "Clarity projects linked in the account catalogue. Recordings and heatmaps stay in Clarity."
        : "Reading the account catalogue needs the Integrations permission, so the number of Clarity projects is unknown.",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Heatmaps & UX"
        subtitle="Behaviour signals and friction points."
      />

      <Notice tone="info" title="What CCM stores">
        CCM holds the Clarity connection and links to the native project for
        replay and heatmaps. No behaviour metric has been read from Clarity:
        there is no Clarity sync in this release, and no session recording,
        heatmap, form field, page text or private identifier is stored.
        Playback happens in Clarity, under the provider&apos;s own privacy and
        masking controls.
      </Notice>

      {failure ? (
        <ErrorState detail={failure} className="border-0" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tiles.map((tile) => (
              <Card key={tile.label} className="p-4">
                <h3 className="text-label-md font-semibold text-secondary">
                  {tile.label}
                </h3>
                <p className="mt-1 text-headline-md font-bold text-tertiary">
                  {tile.value}
                </p>
                <p className="mt-1 text-body-sm text-muted-text">
                  {tile.detail}
                </p>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader
              title="Clarity connections"
              subtitle="The connection state and the link to the native project"
            />
            <CardBody className="p-0">
              {!canReadConnections ? (
                <EmptyState
                  title="Clarity connections are not visible to this role"
                  description="Reading provider connections needs the Integrations permission. Ask an administrator for it to see whether Clarity is connected."
                  icon={<Eye className="size-5" />}
                  className="border-0"
                />
              ) : connections.length === 0 ? (
                <EmptyState
                  title="No Clarity connection"
                  description="Connect a Microsoft Clarity project to link the native replay and heatmaps. CCM keeps the connection and its sync state; it stores no recordings and reads no behaviour metrics yet."
                  icon={<Eye className="size-5" />}
                  className="border-0"
                />
              ) : (
                <ul className="divide-y divide-border">
                  {connections.map((item) => {
                    const projectIds = projects
                      .filter((project) => project.connection_id === item.id)
                      .map(projectIdOf)
                      .filter((id): id is string => id !== null);

                    return (
                      <li
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                      >
                        <div>
                          <p className="text-body-md font-semibold text-tertiary">
                            {item.display_label}
                          </p>
                          <p className="text-body-sm text-muted-text">
                            {item.last_success_at
                              ? `Last sync ${item.last_success_at.slice(0, 10)}`
                              : "Never synced"}
                          </p>
                          <p className="text-body-sm text-muted-text">
                            {projectIds.length > 0
                              ? `Clarity project ${projectIds.join(", ")}`
                              : "No Clarity project linked"}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Chip tone={statusTone(item.status)}>
                            {statusLabel(item.status)}
                          </Chip>
                          <a
                            href="https://clarity.microsoft.com/projects"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-label-md font-semibold text-primary-ink hover:underline"
                          >
                            Open Clarity
                          </a>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
