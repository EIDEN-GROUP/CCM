import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import {
  ProviderSetupPanel,
  type CredentialSummary,
  type ProviderSetup,
} from "@/components/settings/provider-setup-panel";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth/guard";
import { listAppCredentials } from "@/lib/providers/app-credentials";
import { OAUTH_PROVIDER_LIST } from "@/lib/oauth/registry";
import { serverEnv } from "@/lib/env";
import { getTranslator } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t("pages.settings.integrations.title") };
}

/**
 * The provider app setup.
 *
 * The client id and the client secret of a provider's app used to live in
 * `.env`, which meant a redeploy to connect a provider. They live here
 * now: the secret is encrypted before it is stored, and the Connect button
 * works the moment the form is saved.
 */
export default async function IntegrationsSetupPage() {
  const session = await getSession();
  const guard = await requirePermission(session, "settings.manage");
  if (!guard.allowed) return guard.response;

  const t = await getTranslator();

  const db = createAdminClient();

  const credentials = (await listAppCredentials(
    db,
    session.workspaceId!,
  ).catch(() => [])) as CredentialSummary[];

  const origin = serverEnv.appOrigin();

  const providers: ProviderSetup[] = OAUTH_PROVIDER_LIST.map((config) => ({
    key: config.key,
    displayName: config.displayName,
    clientIdLabel: config.clientIdLabel,
    secretLabel: config.secretLabel,
    secretRequired: config.secretRequired,
    setupUrl: config.setupUrl,
    docsUrl: config.docsUrl,
    requirement: config.requirement,
    redirectUriPath: config.redirectUriPath,
    products: config.products.map((product) => ({
      key: product.key,
      label: product.label,
    })),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("pages.settings.integrations.title")}
        subtitle={t("pages.settings.integrations.subtitle")}
      />

      <Notice
        tone="info"
        title={t("pages.settings.integrations.replacesTitle")}
      >
        {t("pages.settings.integrations.replacesBody")}
      </Notice>

      <Card>
        <CardHeader
          title={t("pages.settings.integrations.appsTitle")}
          subtitle={t("pages.settings.integrations.appsSubtitle")}
        />
        <CardBody>
          <ProviderSetupPanel
            providers={providers}
            credentials={credentials}
            origin={origin}
          />
        </CardBody>
      </Card>
    </div>
  );
}
