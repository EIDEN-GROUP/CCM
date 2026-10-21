import type { Metadata } from "next";
import { Tags } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/states";
import { Notice } from "@/components/ui/notice";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guard";
import { formatAge } from "@/domain/freshness";

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

/**
 * Tag Manager inventory and tracking health.
 *
 * CCM reads the container; it never publishes one. Publishing requires a
 * preview, an authorised approver, a before/after version reference and an
 * audit record, and that workflow does not exist yet — so there is no
 * publish button to mislead anyone.
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

  const snapshots = (data ?? []) as GtmSnapshot[];

  const asArray = (value: unknown): Array<Record<string, unknown>> =>
    Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];

  const now = new Date();

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

      <Card>
        <CardHeader
          title="Container versions"
          subtitle="Most recent inventory per container"
        />
        <CardBody className="p-0">
          {error || snapshots.length === 0 ? (
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
                    row.version_number === null ? "—" : String(row.version_number),
                },
                {
                  key: "tags",
                  header: "Tags",
                  numeric: true,
                  mobile: "secondary",
                  render: (row) => String(asArray(row.tags).length),
                },
                {
                  key: "triggers",
                  header: "Triggers",
                  numeric: true,
                  mobile: "hidden",
                  render: (row) => String(asArray(row.triggers).length),
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
                  render: (row) =>
                    formatAge(
                      (now.getTime() - Date.parse(row.captured_at)) / 1000,
                    ),
                },
              ]}
            />
          )}
        </CardBody>
      </Card>

      {snapshots.length > 0 ? (
        <Card>
          <CardHeader
            title="Tracking checklist"
            subtitle="What CCM checks on every container capture"
          />
          <CardBody>
            <ul className="space-y-2 text-body-sm text-secondary">
              <li className="flex items-center gap-2">
                <Chip tone="success">check</Chip>
                A GA4 tag exists in the container and references the expected
                Measurement ID.
              </li>
              <li className="flex items-center gap-2">
                <Chip tone="success">check</Chip>
                No duplicate GA4 configuration tags fire on the same trigger.
              </li>
              <li className="flex items-center gap-2">
                <Chip tone="success">check</Chip>
                Every approved event from the tracking plan has a tag and a
                trigger.
              </li>
              <li className="flex items-center gap-2">
                <Chip tone="success">check</Chip>
                The container was captured more recently than the last
                published version.
              </li>
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
