import type { Metadata } from "next";
import { Tags } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Chip, type Tone } from "@/components/ui/chip";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Notice } from "@/components/ui/notice";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guard";
import { formatAge } from "@/domain/freshness";
import { collectMeasurementIds } from "@/providers/google/gtm";

export const metadata: Metadata = { title: "GTM & Tracking" };
export const dynamic = "force-dynamic";

interface GtmSnapshot {
  id: string;
  account_id: string;
  container_id: string;
  version_id: string | null;
  version_number: number | null;
  published_at: string | null;
  tags: unknown;
  triggers: unknown;
  variables: unknown;
  workspaces: unknown;
  environments: unknown;
  expected_measurement_ids: string[];
  captured_at: string;
}

/** One line of the checklist: the verdict, and what it was decided on. */
interface ChecklistRow {
  /** The chip. A check that could not be computed says so. */
  label: string;
  tone: Tone;
  /** What the capture actually said. */
  detail: string;
  /** Stable identity for the row, so React can key it. */
  id: string;
}

/**
 * The number of items a snapshot column holds.
 *
 * The column is a jsonb array, but the sync worker writes the count the
 * connector reported, so a row can hold an array or a number. Both are
 * read. Anything else is unknown, and an unknown count is never a zero.
 */
function countOf(value: unknown): number | null {
  if (Array.isArray(value)) return value.length;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

/** A count for a person, or the em dash when nobody can say. */
function countText(value: unknown): string {
  const count = countOf(value);
  return count === null ? "—" : String(count);
}

/**
 * The tag definitions a capture stored, when it stored them.
 *
 * The sync worker writes the count of tags rather than the tags
 * themselves, so most snapshots hold a number and carry no definitions at
 * all. An empty array carries no evidence either: it is what the column
 * defaults to, so it cannot be told apart from a capture that recorded
 * nothing. Either way the definitions are unknown.
 */
function tagDefinitions(
  value: unknown,
): Array<Record<string, unknown>> | null {
  if (!Array.isArray(value)) return null;
  const entries = value.filter(
    (entry): entry is Record<string, unknown> =>
      typeof entry === "object" && entry !== null,
  );
  return entries.length > 0 ? entries : null;
}

/** The triggers a tag fires on, as the container describes them. */
function triggerIds(tag: Record<string, unknown>): string[] {
  const value = tag.triggerId;
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }
  if (typeof value === "string") return [value];
  return [];
}

/** A count in words, so an unreadable count never reads as a zero. */
function countPhrase(
  count: number | null,
  singular: string,
  plural: string,
): string {
  return count === null
    ? "an unknown number of"
    : `${count} ${count === 1 ? singular : plural}`;
}

/** How long ago an instant was, or the em dash when it cannot be read. */
function ageLabel(instant: string, now: Date): string {
  const at = Date.parse(instant);
  if (!Number.isFinite(at)) return "—";
  return formatAge((now.getTime() - at) / 1000);
}

/** A timestamp, in the timezone the workspace works in. */
function formatTimestamp(value: string, timezone: string): string {
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(instant);
}

/**
 * Was the container captured after the version it was taken from was
 * published?
 *
 * A capture that predates the published version describes a container that
 * has already moved on, so it is stale rather than healthy.
 */
function captureCheck(snapshot: GtmSnapshot, timezone: string): ChecklistRow {
  const capturedAt = snapshot.captured_at;
  const publishedAt = snapshot.published_at;
  const captured = Date.parse(capturedAt);
  const published = publishedAt === null ? Number.NaN : Date.parse(publishedAt);

  if (!Number.isFinite(captured)) {
    return {
      id: "capture",
      label: "Not checked",
      tone: "neutral",
      detail:
        "The capture carries no readable capture date, so it cannot be compared with the published version.",
    };
  }
  if (!publishedAt || !Number.isFinite(published)) {
    return {
      id: "capture",
      label: "Not checked",
      tone: "neutral",
      detail:
        "The capture records no published version, so there is no date to compare the capture against.",
    };
  }
  if (captured < published) {
    return {
      id: "capture",
      label: "Stale",
      tone: "danger",
      detail: `The capture (${formatTimestamp(capturedAt, timezone)}) predates the published version (${formatTimestamp(publishedAt, timezone)}).`,
    };
  }
  return {
    id: "capture",
    label: "Pass",
    tone: "success",
    detail: `The capture (${formatTimestamp(capturedAt, timezone)}) is newer than the published version (${formatTimestamp(publishedAt, timezone)}).`,
  };
}

/**
 * Does a GA4 tag in the capture reference the expected Measurement ID?
 *
 * The answer needs the tag definitions. When the capture stored a count
 * instead, the answer is unknown — and unknown is not a pass.
 */
function measurementIdCheck(snapshot: GtmSnapshot): ChecklistRow {
  const tags = tagDefinitions(snapshot.tags);
  const expected = snapshot.expected_measurement_ids ?? [];

  if (!tags) {
    return {
      id: "measurement",
      label: "Not checked",
      tone: "neutral",
      detail:
        "The capture stored a count of tags rather than the tag definitions, so CCM cannot say which Measurement ID they reference.",
    };
  }
  if (expected.length === 0) {
    return {
      id: "measurement",
      label: "Not checked",
      tone: "neutral",
      detail:
        "The snapshot records no expected GA4 Measurement ID, so there is nothing to compare the tags against.",
    };
  }

  const found = collectMeasurementIds(tags);
  const missing = expected.filter((id) => !found.includes(id));
  if (missing.length > 0) {
    return {
      id: "measurement",
      label: "Fail",
      tone: "danger",
      detail: `No tag in the capture references ${missing.join(", ")}.`,
    };
  }
  return {
    id: "measurement",
    label: "Pass",
    tone: "success",
    detail: `A tag in the capture references every expected Measurement ID (${expected.join(", ")}).`,
  };
}

/**
 * Do two GA4 configuration tags fire on the same trigger?
 *
 * A duplicate GA4 tag sends the same event twice, so this check needs the
 * tag definitions and their triggers. Without them it stays unchecked.
 */
function duplicateCheck(snapshot: GtmSnapshot): ChecklistRow {
  const tags = tagDefinitions(snapshot.tags);
  if (!tags) {
    return {
      id: "duplicate",
      label: "Not checked",
      tone: "neutral",
      detail:
        "The capture stored a count of tags rather than the tag definitions, so duplicates cannot be ruled out.",
    };
  }

  const ga4Tags = tags.filter(
    (tag) => collectMeasurementIds([tag]).length > 0,
  );
  if (ga4Tags.length === 0) {
    return {
      id: "duplicate",
      label: "Not checked",
      tone: "neutral",
      detail:
        "The capture holds no GA4 tag, so there is no duplicate to rule out.",
    };
  }

  const perMeasurement = new Map<string, number>();
  const perTrigger = new Map<string, number>();
  for (const tag of ga4Tags) {
    for (const id of collectMeasurementIds([tag])) {
      perMeasurement.set(id, (perMeasurement.get(id) ?? 0) + 1);
    }
    for (const trigger of triggerIds(tag)) {
      perTrigger.set(trigger, (perTrigger.get(trigger) ?? 0) + 1);
    }
  }

  const sharedIds = [...perMeasurement]
    .filter(([, count]) => count > 1)
    .map(([id]) => id);
  if (sharedIds.length > 0) {
    return {
      id: "duplicate",
      label: "Fail",
      tone: "danger",
      detail: `${sharedIds.join(", ")} ${sharedIds.length === 1 ? "is" : "are"} referenced by more than one tag in the capture.`,
    };
  }

  const sharedTriggers = [...perTrigger].filter(([, count]) => count > 1);
  if (sharedTriggers.length > 0) {
    return {
      id: "duplicate",
      label: "Fail",
      tone: "danger",
      detail: `${sharedTriggers.length} ${sharedTriggers.length === 1 ? "trigger fires" : "triggers fire"} more than one GA4 tag in the capture.`,
    };
  }

  return {
    id: "duplicate",
    label: "Pass",
    tone: "success",
    detail: `No Measurement ID or trigger is shared by the ${ga4Tags.length} GA4 ${ga4Tags.length === 1 ? "tag" : "tags"} in the capture.`,
  };
}

/**
 * Does every approved event have a tag and a trigger?
 *
 * CCM holds no approved-event tracking plan, so there is no list of events
 * to compare the container against and the check can never be made. It is
 * stated rather than quietly dropped, because the checklist used to claim
 * it had passed.
 */
function trackingPlanCheck(): ChecklistRow {
  return {
    id: "tracking-plan",
    label: "Not checked",
    tone: "neutral",
    detail:
      "CCM holds no approved-event tracking plan, so there is no list of events to compare the container against.",
  };
}

/** The checklist for one container, or for a workspace with no capture. */
function checksFor(
  snapshot: GtmSnapshot | null,
  timezone: string,
): ChecklistRow[] {
  if (!snapshot) {
    return [
      {
        id: "capture",
        label: "Not checked",
        tone: "neutral",
        detail:
          "No container capture has been recorded, so there is no capture date to compare with a published version.",
      },
      {
        id: "measurement",
        label: "Not checked",
        tone: "neutral",
        detail:
          "No container capture has been recorded, so CCM cannot say whether a GA4 tag references the expected Measurement ID.",
      },
      {
        id: "duplicate",
        label: "Not checked",
        tone: "neutral",
        detail:
          "No container capture has been recorded, so duplicate GA4 tags cannot be ruled out.",
      },
      trackingPlanCheck(),
    ];
  }

  return [
    captureCheck(snapshot, timezone),
    measurementIdCheck(snapshot),
    duplicateCheck(snapshot),
    trackingPlanCheck(),
  ];
}

/**
 * Tag Manager inventory and tracking health.
 *
 * CCM reads the container; it never publishes one. Publishing requires a
 * preview, an authorised approver, a before/after version reference and an
 * audit record, and that workflow does not exist yet — so there is no
 * publish button to mislead anyone.
 *
 * The checklist below is computed from the captures that were actually
 * read. A check that the stored capture cannot answer says "Not checked"
 * rather than claiming a health nobody measured.
 */
export default async function GtmPage() {
  const session = await getSession();
  const guard = await requirePermission(session, "gtm.read");
  if (!guard.allowed) return guard.response;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tag_manager_snapshots")
    .select(
      "id, account_id, container_id, version_id, version_number, published_at, tags, triggers, variables, workspaces, environments, expected_measurement_ids, captured_at",
    )
    .eq("workspace_id", session.workspaceId!)
    .order("captured_at", { ascending: false })
    .limit(20);

  // A failed query is **not** an empty result: "the inventory could not be
  // read" and "there is no inventory" are different facts, and the screen
  // must not confuse them.
  const failure = error
    ? `The container inventory could not be read: ${error.message}`
    : null;

  const snapshots = (data ?? []) as GtmSnapshot[];

  // The newest capture of each container. The rows are ordered by capture
  // time, so the first row seen for a container is its latest one.
  const latestByContainer = new Map<string, GtmSnapshot>();
  for (const snapshot of snapshots) {
    if (!latestByContainer.has(snapshot.container_id)) {
      latestByContainer.set(snapshot.container_id, snapshot);
    }
  }
  const containers = [...latestByContainer.values()];

  const checklist: Array<{ key: string; snapshot: GtmSnapshot | null }> =
    containers.map((snapshot) => ({ key: snapshot.container_id, snapshot }));
  if (checklist.length === 0) {
    // Nothing has been captured, so the checklist says so instead of
    // disappearing.
    checklist.push({ key: "no-capture", snapshot: null });
  }

  const now = new Date();
  const timezone = session.workspaceTimezone;

  return (
    <div className="space-y-6">
      <PageHeader
        title="GTM & Tracking"
        subtitle="Container inventory, tags, triggers and validation."
      />

      <Notice tone="warning" title="Publishing is not available">
        CCM inventories the container and checks the expected GA4 Measurement
        ID. Publishing a version requires a preview, an authorised approver, a
        before/after version reference and an audit record, so the publish
        action is absent rather than merely disabled.
      </Notice>

      {failure ? (
        <ErrorState detail={failure} className="border-0" />
      ) : (
        <>
          <Card>
            <CardHeader
              title="Container versions"
              subtitle="Most recent inventory per container"
            />
            <CardBody className="p-0">
              {snapshots.length === 0 ? (
                <EmptyState
                  title="No container inventory yet"
                  description="Connect a Tag Manager container. The Medical Bay site currently ships GTM-WF77DFJD."
                  icon={<Tags className="size-5" />}
                  className="border-0"
                />
              ) : (
                <DataTable
                  label="GTM container versions"
                  rows={snapshots}
                  rowKey={(row) => row.id}
                  columns={[
                    {
                      key: "container",
                      header: "Container",
                      mobile: "primary",
                      render: (row) => (
                        <span className="font-semibold text-tertiary">
                          {row.container_id}
                        </span>
                      ),
                    },
                    {
                      key: "version",
                      header: "Version",
                      mobile: "secondary",
                      render: (row) =>
                        row.version_number === null
                          ? "—"
                          : String(row.version_number),
                    },
                    {
                      key: "tags",
                      header: "Tags",
                      numeric: true,
                      mobile: "secondary",
                      render: (row) => countText(row.tags),
                    },
                    {
                      key: "triggers",
                      header: "Triggers",
                      numeric: true,
                      mobile: "hidden",
                      render: (row) => countText(row.triggers),
                    },
                    {
                      key: "measurement",
                      header: "Expected GA4 ID",
                      mobile: "hidden",
                      render: (row) =>
                        row.expected_measurement_ids.length > 0
                          ? row.expected_measurement_ids.join(", ")
                          : "—",
                    },
                    {
                      key: "captured",
                      header: "Captured",
                      mobile: "secondary",
                      render: (row) => ageLabel(row.captured_at, now),
                    },
                  ]}
                />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Tracking checklist"
              subtitle="Each row is decided on the capture that was read; a check that cannot be computed says so"
            />
            <CardBody className="space-y-4">
              {checklist.map((group) => (
                <div key={group.key} className="space-y-2">
                  {group.snapshot ? (
                    <p className="text-label-md font-semibold text-tertiary">
                      Container {group.snapshot.container_id}
                      <span className="font-normal text-muted-text">
                        {" · captured "}
                        {ageLabel(group.snapshot.captured_at, now)}
                      </span>
                    </p>
                  ) : null}

                  <ul className="space-y-2 text-body-sm text-secondary">
                    {checksFor(group.snapshot, timezone).map((check) => (
                      <li
                        key={check.id}
                        className="flex flex-wrap items-start gap-2"
                      >
                        <Chip tone={check.tone}>{check.label}</Chip>
                        <span className="min-w-0 flex-1">{check.detail}</span>
                      </li>
                    ))}
                  </ul>

                  {group.snapshot ? (
                    <p className="text-body-sm text-muted-text">
                      The capture counted{" "}
                      {countPhrase(
                        countOf(group.snapshot.tags),
                        "tag",
                        "tags",
                      )}{" "}
                      and{" "}
                      {countPhrase(
                        countOf(group.snapshot.triggers),
                        "trigger",
                        "triggers",
                      )}
                      .
                    </p>
                  ) : null}
                </div>
              ))}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
