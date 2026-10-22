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
import { getLocale, getTranslator } from "@/lib/i18n-server";
import { formatMessage, intlLocale, type Translator } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t("pages.gtm.title") };
}

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
 * What the checklist needs to speak the signed-in language.
 *
 * The checklist rows are built by helpers that sit outside the component, so
 * the translator and the date locale travel with them rather than being
 * read from a global.
 */
interface GtmContext {
  /** Translator bound to the signed-in locale. */
  t: Translator;
  /** BCP-47 tag used to format the timestamps inside the checklist. */
  locale: string;
  /** Timezone the workspace works in, so a capture reads in local time. */
  timezone: string;
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
  value: unknown,
  ctx: GtmContext,
  singular: string,
  plural: string,
): string {
  const count = countOf(value);
  if (count === null) return ctx.t("pages.gtm.unknownCountOf");
  return `${count} ${count === 1 ? singular : plural}`;
}

/** How long ago an instant was, or the em dash when it cannot be read. */
function ageLabel(instant: string, now: Date): string {
  const at = Date.parse(instant);
  if (!Number.isFinite(at)) return "—";
  return formatAge((now.getTime() - at) / 1000);
}

/** A timestamp, in the timezone the workspace works in. */
function formatTimestamp(
  value: string,
  timezone: string,
  locale: string,
): string {
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
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
function captureCheck(snapshot: GtmSnapshot, ctx: GtmContext): ChecklistRow {
  const { t } = ctx;
  const capturedAt = snapshot.captured_at;
  const publishedAt = snapshot.published_at;
  const captured = Date.parse(capturedAt);
  const published = publishedAt === null ? Number.NaN : Date.parse(publishedAt);

  if (!Number.isFinite(captured)) {
    return {
      id: "capture",
      label: t("pages.gtm.notChecked"),
      tone: "neutral",
      detail: t("pages.gtm.captureNoDate"),
    };
  }
  if (!publishedAt || !Number.isFinite(published)) {
    return {
      id: "capture",
      label: t("pages.gtm.notChecked"),
      tone: "neutral",
      detail: t("pages.gtm.captureNoPublishedVersion"),
    };
  }
  if (captured < published) {
    return {
      id: "capture",
      label: t("pages.gtm.stale"),
      tone: "danger",
      detail: formatMessage(t("pages.gtm.capturePredatesPublished"), {
        captured: formatTimestamp(capturedAt, ctx.timezone, ctx.locale),
        published: formatTimestamp(publishedAt, ctx.timezone, ctx.locale),
      }),
    };
  }
  return {
    id: "capture",
    label: t("pages.gtm.pass"),
    tone: "success",
    detail: formatMessage(t("pages.gtm.captureNewerThanPublished"), {
      captured: formatTimestamp(capturedAt, ctx.timezone, ctx.locale),
      published: formatTimestamp(publishedAt, ctx.timezone, ctx.locale),
    }),
  };
}

/**
 * Does a GA4 tag in the capture reference the expected Measurement ID?
 *
 * The answer needs the tag definitions. When the capture stored a count
 * instead, the answer is unknown — and unknown is not a pass.
 */
function measurementIdCheck(
  snapshot: GtmSnapshot,
  ctx: GtmContext,
): ChecklistRow {
  const { t } = ctx;
  const tags = tagDefinitions(snapshot.tags);
  const expected = snapshot.expected_measurement_ids ?? [];

  if (!tags) {
    return {
      id: "measurement",
      label: t("pages.gtm.notChecked"),
      tone: "neutral",
      detail: t("pages.gtm.measurementNoDefinitions"),
    };
  }
  if (expected.length === 0) {
    return {
      id: "measurement",
      label: t("pages.gtm.notChecked"),
      tone: "neutral",
      detail: t("pages.gtm.measurementNoExpectedId"),
    };
  }

  const found = collectMeasurementIds(tags);
  const missing = expected.filter((id) => !found.includes(id));
  if (missing.length > 0) {
    return {
      id: "measurement",
      label: t("pages.gtm.fail"),
      tone: "danger",
      detail: formatMessage(t("pages.gtm.measurementMissingIds"), {
        ids: missing.join(", "),
      }),
    };
  }
  return {
    id: "measurement",
    label: t("pages.gtm.pass"),
    tone: "success",
    detail: formatMessage(t("pages.gtm.measurementAllIds"), {
      ids: expected.join(", "),
    }),
  };
}

/**
 * Do two GA4 configuration tags fire on the same trigger?
 *
 * A duplicate GA4 tag sends the same event twice, so this check needs the
 * tag definitions and their triggers. Without them it stays unchecked.
 */
function duplicateCheck(
  snapshot: GtmSnapshot,
  ctx: GtmContext,
): ChecklistRow {
  const { t } = ctx;
  const tags = tagDefinitions(snapshot.tags);
  if (!tags) {
    return {
      id: "duplicate",
      label: t("pages.gtm.notChecked"),
      tone: "neutral",
      detail: t("pages.gtm.duplicateNoDefinitions"),
    };
  }

  const ga4Tags = tags.filter(
    (tag) => collectMeasurementIds([tag]).length > 0,
  );
  if (ga4Tags.length === 0) {
    return {
      id: "duplicate",
      label: t("pages.gtm.notChecked"),
      tone: "neutral",
      detail: t("pages.gtm.duplicateNoTags"),
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
      label: t("pages.gtm.fail"),
      tone: "danger",
      detail: formatMessage(
        sharedIds.length === 1
          ? t("pages.gtm.duplicateSharedIdOne")
          : t("pages.gtm.duplicateSharedIdMany"),
        { ids: sharedIds.join(", ") },
      ),
    };
  }

  const sharedTriggers = [...perTrigger].filter(([, count]) => count > 1);
  if (sharedTriggers.length > 0) {
    return {
      id: "duplicate",
      label: t("pages.gtm.fail"),
      tone: "danger",
      detail: formatMessage(
        sharedTriggers.length === 1
          ? t("pages.gtm.duplicateSharedTriggerOne")
          : t("pages.gtm.duplicateSharedTriggerMany"),
        { count: sharedTriggers.length },
      ),
    };
  }

  return {
    id: "duplicate",
    label: t("pages.gtm.pass"),
    tone: "success",
    detail: formatMessage(
      ga4Tags.length === 1
        ? t("pages.gtm.duplicateCleanOne")
        : t("pages.gtm.duplicateCleanMany"),
      { count: ga4Tags.length },
    ),
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
function trackingPlanCheck(ctx: GtmContext): ChecklistRow {
  return {
    id: "tracking-plan",
    label: ctx.t("pages.gtm.notChecked"),
    tone: "neutral",
    detail: ctx.t("pages.gtm.trackingPlanMissing"),
  };
}

/** The checklist for one container, or for a workspace with no capture. */
function checksFor(
  snapshot: GtmSnapshot | null,
  ctx: GtmContext,
): ChecklistRow[] {
  if (!snapshot) {
    return [
      {
        id: "capture",
        label: ctx.t("pages.gtm.notChecked"),
        tone: "neutral",
        detail: ctx.t("pages.gtm.noCaptureNoDate"),
      },
      {
        id: "measurement",
        label: ctx.t("pages.gtm.notChecked"),
        tone: "neutral",
        detail: ctx.t("pages.gtm.noCaptureNoMeasurement"),
      },
      {
        id: "duplicate",
        label: ctx.t("pages.gtm.notChecked"),
        tone: "neutral",
        detail: ctx.t("pages.gtm.noCaptureNoDuplicates"),
      },
      trackingPlanCheck(ctx),
    ];
  }

  return [
    captureCheck(snapshot, ctx),
    measurementIdCheck(snapshot, ctx),
    duplicateCheck(snapshot, ctx),
    trackingPlanCheck(ctx),
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
  const t = await getTranslator();
  const timezone = session.workspaceTimezone;
  const ctx: GtmContext = {
    t,
    locale: intlLocale(await getLocale()),
    timezone,
  };

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
    ? formatMessage(t("pages.gtm.inventoryError"), { message: error.message })
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("pages.gtm.title")}
        subtitle={t("pages.gtm.subtitle")}
      />

      <Notice
        tone="warning"
        title={t("pages.gtm.publishingUnavailableTitle")}
      >
        {t("pages.gtm.publishingUnavailableBody")}
      </Notice>

      {failure ? (
        <ErrorState detail={failure} className="border-0" />
      ) : (
        <>
          <Card>
            <CardHeader
              title={t("pages.gtm.containerVersions")}
              subtitle={t("pages.gtm.containerVersionsSubtitle")}
            />
            <CardBody className="p-0">
                <DataTable
                  label={t("pages.gtm.containerVersions")}
                  rows={snapshots}
                  empty={
                    <EmptyState
                      title={t("pages.gtm.noInventoryTitle")}
                      description={t("pages.gtm.noInventoryBody")}
                      icon={<Tags className="size-5" />}
                      className="border-0"
                    />
                  }
                  rowKey={(row) => row.id}
                  columns={[
                    {
                      key: "container",
                      header: t("pages.gtm.container"),
                      mobile: "primary",
                      render: (row) => (
                        <span className="font-semibold text-tertiary">
                          {row.container_id}
                        </span>
                      ),
                    },
                    {
                      key: "version",
                      header: t("pages.gtm.version"),
                      mobile: "secondary",
                      render: (row) =>
                        row.version_number === null
                          ? "—"
                          : String(row.version_number),
                    },
                    {
                      key: "tags",
                      header: t("pages.gtm.tags"),
                      numeric: true,
                      mobile: "secondary",
                      render: (row) => countText(row.tags),
                    },
                    {
                      key: "triggers",
                      header: t("pages.gtm.triggers"),
                      numeric: true,
                      mobile: "secondary",
                      render: (row) => countText(row.triggers),
                    },
                    {
                      key: "measurement",
                      header: t("pages.gtm.expectedGa4Id"),
                      mobile: "secondary",
                      render: (row) =>
                        row.expected_measurement_ids.length > 0
                          ? row.expected_measurement_ids.join(", ")
                          : "—",
                    },
                    {
                      key: "captured",
                      header: t("pages.gtm.captured"),
                      mobile: "secondary",
                      render: (row) => ageLabel(row.captured_at, now),
                    },
                  ]}
                />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={t("pages.gtm.trackingChecklist")}
              subtitle={t("pages.gtm.trackingChecklistSubtitle")}
            />
            <CardBody className="space-y-4">
              {checklist.map((group) => (
                <div key={group.key} className="space-y-2">
                  {group.snapshot ? (
                    <p className="text-label-md font-semibold text-tertiary">
                      {formatMessage(t("pages.gtm.containerLabel"), {
                        container: group.snapshot.container_id,
                      })}
                      <span className="font-normal text-muted-text">
                        {formatMessage(t("pages.gtm.capturedSuffix"), {
                          age: ageLabel(group.snapshot.captured_at, now),
                        })}
                      </span>
                    </p>
                  ) : null}

                  <ul className="space-y-2 text-body-sm text-secondary">
                    {checksFor(group.snapshot, ctx).map((check) => (
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
                      {formatMessage(t("pages.gtm.captureCounted"), {
                        tags: countPhrase(
                          countOf(group.snapshot.tags),
                          ctx,
                          t("pages.gtm.tagSingular"),
                          t("pages.gtm.tagsPlural"),
                        ),
                        triggers: countPhrase(
                          countOf(group.snapshot.triggers),
                          ctx,
                          t("pages.gtm.triggerSingular"),
                          t("pages.gtm.triggersPlural"),
                        ),
                      })}
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
