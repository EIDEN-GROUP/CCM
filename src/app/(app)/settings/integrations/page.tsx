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

export const metadata: Metadata = { title: "Integrations setup" };
export const dynamic = "force-dynamic";

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
        title="Provider apps"
        subtitle="Add the client id and secret of each provider's app, then connect it."
      />

      <Notice tone="info" title="What this replaces">
        These values used to live in the deployment environment, so
        connecting a provider meant editing a file and redeploying. They are
        stored here instead, encrypted, and the Connect button works as soon
        as the form is saved.
      </Notice>

      <Card>
        <CardHeader
          title="Apps"
          subtitle="One app per provider. Google covers Analytics, Search Console, Tag Manager, Ads, YouTube and Gmail."
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
