import type { Metadata } from "next";
import { Eye } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Notice } from "@/components/ui/notice";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guard";

export const metadata: Metadata = { title: "Heatmaps & UX" };
export const dynamic = "force-dynamic";

/**
 * Heatmaps and UX.
 *
 * CCM links to the native Clarity project for replay and heatmaps. It does
 * not store session recordings, form fields or page text, and it does not
 * claim to be a recording viewer.
 */
export default async function UxPage() {
  const session = await getSession();
  const guard = await requirePermission(session, "ux.read");
  if (!guard.allowed) return guard.response;

  const supabase = await createClient();
  const { data: connections } = await supabase
    .from("provider_connections")
    .select("id, provider_key, display_label, status, last_success_at")
    .eq("workspace_id", session.workspaceId!)
    .eq("provider_key", "clarity");

  const clarity = (connections ?? []) as Array<{
    id: string;
    display_label: string;
    status: string;
    last_success_at: string | null;
  }>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Heatmaps & UX"
        subtitle="Behaviour signals and friction points."
      />

      <Notice tone="info" title="What CCM stores">
        CCM keeps aggregate behaviour metrics and links to the native Clarity
        project for replay and heatmaps. It does not store session recordings,
        form fields, page text or private identifiers, and it follows the
        provider&apos;s own privacy and masking controls.
      </Notice>

      <Card>
        <CardHeader
          title="Clarity projects"
          subtitle="Aggregate metrics and links to the native dashboards"
        />
        <CardBody className="p-0">
          {clarity.length === 0 ? (
            <EmptyState
              title="No Clarity project connected"
              description="Connect a Microsoft Clarity project to bring in aggregate behaviour metrics and links to recordings and heatmaps."
              icon={<Eye className="size-5" />}
              className="border-0"
            />
          ) : (
            <ul className="divide-y divide-border">
              {clarity.map((project) => (
                <li key={project.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-body-md font-semibold text-tertiary">
                      {project.display_label}
                    </p>
                    <p className="text-body-sm text-muted-text">
                      {project.last_success_at
                        ? `Last sync ${project.last_success_at.slice(0, 10)}`
                        : "Never synced"}
                    </p>
                  </div>
                  <a
                    href="https://clarity.microsoft.com/projects"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-label-md font-semibold text-primary-ink hover:underline"
                  >
                    Open Clarity
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {["Recordings", "Heatmaps", "Scroll depth", "Rage clicks"].map(
          (label) => (
            <Card key={label} className="p-4">
              <h3 className="text-label-md font-semibold text-secondary">
                {label}
              </h3>
              <p className="mt-1 text-headline-md font-bold text-tertiary">—</p>
              <p className="mt-1 text-body-sm text-muted-text">
                No Clarity data synced yet
              </p>
            </Card>
          ),
        )}
      </div>
    </div>
  );
}
