import type { Metadata } from "next";
import { Fragment, type ReactNode } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { PeopleManager } from "@/components/settings/people-manager";
import { getSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { getTranslator } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

/**
 * Render a translated sentence with some of its placeholders emphasised.
 *
 * The access-model sentence names three levels in bold. The words move
 * around in French and Arabic, so the emphasis follows the placeholder
 * rather than a fixed position in the sentence.
 */
function emphasise(
  template: string,
  values: Record<string, string>,
  bold: readonly string[],
): ReactNode[] {
  return template.split(/(\{\w+\})/).map((part, index) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    if (!name) return part;

    const value = values[name] ?? part;
    return (
      <Fragment key={index}>
        {bold.includes(name) ? (
          <strong className="font-semibold">{value}</strong>
        ) : (
          value
        )}
      </Fragment>
    );
  });
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t("pages.people.title") };
}

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

  const t = await getTranslator();

  const accessBody = emphasise(
    t("pages.people.howAccessWorksBody"),
    {
      view: t("pages.people.levelView"),
      use: t("pages.people.levelUse"),
      edit: t("pages.people.levelEdit"),
    },
    ["view", "use", "edit"],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("pages.people.title")}
        subtitle={t("pages.people.subtitle")}
      />

      <Notice tone="info" title={t("pages.people.howAccessWorksTitle")}>
        {accessBody}
      </Notice>

      <Card>
        <CardBody>
          <PeopleManager currentUserId={session.userId!} />
        </CardBody>
      </Card>
    </div>
  );
}
