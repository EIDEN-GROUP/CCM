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
  SYNC_INTERVALS,
  type FreshnessState,
} from "@/domain/freshness";
import { formatMessage, intlLocale, type Translator } from "@/lib/i18n";
import { getLocale, getTranslator } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t("pages.ux.title") };
}

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

/**
 * The connection status, in words.
 *
 * The catalogue carries every status a provider connection can hold. An
 * unknown status keeps its raw value rather than an invented label.
 */
function statusLabel(status: string, t: Translator): string {
  switch (status) {
    case "connected":
      return t("api.connected");
    case "needs_setup":
      return t("api.needsSetup");
    case "token_refresh_failed":
      return t("api.tokenRefreshFailed");
    case "permission_revoked":
      return t("api.permissionRevoked");
    case "provider_outage":
      return t("api.providerOutage");
    case "rate_limited":
      return t("api.rateLimited");
    case "sync_stale":
      return t("api.syncStale");
    case "not_configured":
      return t("api.notConfigured");
    default: {
      const words = status.replace(/_/g, " ");
      return words.charAt(0).toUpperCase() + words.slice(1);
    }
  }
}

/** The tone a connection status carries. */
function statusTone(status: string): Tone {
  if (status === "connected") return "success";
  if (status === "needs_setup") return "warning";
  return "danger";
}

/** The short name of a freshness state, for a tile. */
function freshnessLabel(state: FreshnessState, t: Translator): string {
  switch (state) {
    case "fresh":
      return t("pages.ux.freshnessFresh");
    case "aging":
      return t("pages.ux.freshnessAging");
    case "stale":
      return t("pages.ux.freshnessStale");
    case "failing":
      return t("pages.ux.freshnessFailing");
    default:
      return t("pages.ux.neverSynced");
  }
}

/**
 * The freshness explanation.
 *
 * "Failing" covers two different situations — a connector that never ran and
 * one that ran and broke — so the state alone is not enough to pick the
 * sentence.
 */
function freshnessDetail(
  state: FreshnessState,
  lastSuccessAt: string | null,
  t: Translator,
): string {
  switch (state) {
    case "fresh":
      return t("pages.ux.freshnessFresh");
    case "aging":
      return t("pages.ux.freshnessAging");
    case "stale":
      return t("pages.ux.freshnessStale");
    case "failing":
      return lastSuccessAt
        ? t("pages.ux.freshnessDetailLastGood")
        : t("pages.ux.freshnessDetailFailingNoRun");
    default:
      return t("pages.ux.freshnessDetailNever");
  }
}

/**
 * Relative age, in the interface language.
 *
 * The shared domain formatter speaks English only, and a half-translated
 * screen is worse than an untranslated one.
 */
function formatAgeLabel(ageSeconds: number, locale: string): string {
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "always" });
  if (ageSeconds < 60) {
    return relative.format(-Math.max(1, Math.round(ageSeconds)), "second");
  }
  const minutes = ageSeconds / 60;
  if (minutes < 60) return relative.format(-Math.round(minutes), "minute");
  const hours = minutes / 60;
  if (hours < 24) return relative.format(-Math.round(hours), "hour");
  return relative.format(-Math.round(hours / 24), "day");
}

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
  const t = await getTranslator();
  const locale = intlLocale(await getLocale());

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
    failure = formatMessage(t("pages.ux.connectionsReadError"), {
      message: connectionResult.error.message,
    });
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
      failure = formatMessage(t("pages.ux.projectsReadError"), {
        message: projectResult.error.message,
      });
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
      label: t("pages.ux.connectionTile"),
      value: canReadConnections
        ? connection
          ? statusLabel(connection.status, t)
          : t("pages.ux.notConnected")
        : "—",
      detail: canReadConnections
        ? connection
          ? formatMessage(t("pages.ux.connectionStatusDetail"), {
              label: connection.display_label,
              status: statusLabel(connection.status, t),
            })
          : t("pages.ux.noConnectionDetail")
        : t("pages.ux.connectionsNotVisibleDetail"),
    },
    {
      label: t("pages.ux.lastSyncTile"),
      value: ageSeconds === null ? "—" : formatAgeLabel(ageSeconds, locale),
      detail:
        ageSeconds === null
          ? lastSync
            ? t("pages.ux.unknownAgeDetail")
            : t("pages.ux.neverSyncedDetail")
          : t("pages.ux.lastSyncDetail"),
    },
    {
      label: t("pages.ux.syncStateTile"),
      value: freshnessLabel(freshness.state, t),
      detail: freshnessDetail(freshness.state, lastSync, t),
    },
    {
      label: t("pages.ux.projectsTile"),
      value: canReadConnections ? String(projects.length) : "—",
      detail: canReadConnections
        ? t("pages.ux.projectsDetail")
        : t("pages.ux.projectsUnknownDetail"),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("pages.ux.title")}
        subtitle={t("pages.ux.subtitle")}
      />

      <Notice tone="info" title={t("pages.ux.storageNoticeTitle")}>
        {t("pages.ux.storageNoticeBody")}
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
              title={t("pages.ux.connectionsCardTitle")}
              subtitle={t("pages.ux.connectionsCardSubtitle")}
            />
            <CardBody className="p-0">
              {!canReadConnections ? (
                <EmptyState
                  title={t("pages.ux.notVisibleTitle")}
                  description={t("pages.ux.notVisibleDescription")}
                  icon={<Eye className="size-5" />}
                  className="border-0"
                />
              ) : connections.length === 0 ? (
                <EmptyState
                  title={t("pages.ux.noConnectionTitle")}
                  description={t("pages.ux.noConnectionDescription")}
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
                              ? formatMessage(t("pages.ux.lastSyncOn"), {
                                  date: item.last_success_at.slice(0, 10),
                                })
                              : t("pages.ux.neverSynced")}
                          </p>
                          <p className="text-body-sm text-muted-text">
                            {projectIds.length > 0
                              ? formatMessage(t("pages.ux.clarityProject"), {
                                  ids: projectIds.join(", "),
                                })
                              : t("pages.ux.noClarityProject")}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Chip tone={statusTone(item.status)}>
                            {statusLabel(item.status, t)}
                          </Chip>
                          <a
                            href="https://clarity.microsoft.com/projects"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-label-md font-semibold text-primary-ink hover:underline"
                          >
                            {t("pages.ux.openClarity")}
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
