import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { PeopleManager } from "@/components/settings/people-manager";
import { getSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";

export const metadata: Metadata = { title: "People & roles" };
export const dynamic = "force-dynamic";

/**
 * People and roles.
 *
 * The owner adds people, gives them a role, and decides for each role how
 * far into each tab it may go. The levels are derived into the feature
 * permissions the database enforces, so the tab map and the authorisation
 * can never disagree.
 */
export default async function PeoplePage() {
  const session = await getSession();
  const guard = await requirePermission(session, "roles.manage");
  if (!guard.allowed) return guard.response;

  return (
    <div className="space-y-6">
      <PageHeader
        title="People & roles"
        subtitle="Who is in the workspace, and how far into each tab they may go."
      />

      <Notice tone="info" title="How access works">
        A role says how far into a tab it may go: <strong>view</strong> to
        read it, <strong>use</strong> for its actions, and <strong>edit</strong> to
        change its configuration. Those levels are derived into the feature
        permissions the database enforces, so what you see here is what the
        Row Level Security policies will actually allow.
      </Notice>

      <Card>
        <CardBody>
          <PeopleManager currentUserId={session.userId!} />
        </CardBody>
      </Card>
    </div>
  );
}
