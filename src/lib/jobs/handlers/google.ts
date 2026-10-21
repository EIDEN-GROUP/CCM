import type { JobHandler, JobContext } from "@/lib/jobs/runner";
import type { ConnectorAccount } from "@/providers/connector";
import { Ga4Connector } from "@/providers/google/ga4";
import { GscConnector } from "@/providers/google/gsc";
import { GoogleAdsConnector } from "@/providers/google/google-ads";
import { GtmConnector } from "@/providers/google/gtm";
import { GmailConnector } from "@/providers/google/gmail";
import {
  toAdsFact,
  toGa4Fact,
  toGscFact,
  upsertAdsFacts,
  upsertGa4Facts,
  upsertGscFacts,
  upsertTagManagerSnapshot,
} from "@/lib/providers/upsert";

/**
 * The Google job handlers.
 *
 * Each one:
 *   1. reads a bounded slice of the period,
 *   2. normalises the provider's rows into daily facts,
 *   3. writes them, keyed so a retry overwrites rather than duplicates.
 */

/** Turn the stored account into the shape a connector expects. */
export function toConnectorAccount(
  account: JobContext["account"],
  overrides: Partial<ConnectorAccount> = {},
): ConnectorAccount {
  return {
    externalAccountId: account.external_account_id ?? account.id,
    displayLabel: account.display_label,
    identifiers: account.identifiers,
    timezone: null,
    currency: null,
    ...overrides,
  };
}

/** The date window a job covers, defaulting to the last 28 days. */
export function windowFor(
  job: JobContext["job"],
  fallbackDays = 28,
): { startDate: string; endDate: string } {
  const payload = job.payload as {
    startDate?: string;
    endDate?: string;
  };
  if (payload.startDate && payload.endDate) {
    return { startDate: payload.startDate, endDate: payload.endDate };
  }
  const end = new Date();
  const start = new Date(end.getTime() - fallbackDays * 86_400_000);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

export const ga4SessionsHandler: JobHandler = async (context) => {
  const { startDate, endDate } = windowFor(context.job);
  const connector = new Ga4Connector({
    projectId:
      (context.account.identifiers.ga4 as { propertyId?: string } | undefined)
        ?.propertyId,
  });

  const result = await connector.readReport(
    toConnectorAccount(context.account),
    { startDate, endDate, dimension: "date" },
    { accessToken: context.accessToken },
  );

  const facts = result.facts
    .map((fact) =>
      toGa4Fact(
        { ...fact, dimension: "ga4" },
        { workspaceId: context.job.workspace_id, accountId: context.account.id },
      ),
    )
    .filter((fact): fact is NonNullable<typeof fact> => fact !== null);

  const rowsWritten = await upsertGa4Facts(context.db, facts);

  return { rowsWritten, notes: result.notes, providerCalls: 1 };
};

export const ga4EventsHandler: JobHandler = async (context) => {
  const { startDate, endDate } = windowFor(context.job);
  const connector = new Ga4Connector({
    projectId:
      (context.account.identifiers.ga4 as { propertyId?: string } | undefined)
        ?.propertyId,
  });

  const result = await connector.readReport(
    toConnectorAccount(context.account),
    { startDate, endDate, dimension: "event" },
    { accessToken: context.accessToken },
  );

  const facts = result.facts
    .map((fact) =>
      toGa4Fact(
        { ...fact, dimension: "ga4" },
        { workspaceId: context.job.workspace_id, accountId: context.account.id },
      ),
    )
    .filter((fact): fact is NonNullable<typeof fact> => fact !== null);

  const rowsWritten = await upsertGa4Facts(context.db, facts);
  return { rowsWritten, notes: result.notes, providerCalls: 1 };
};

export const gscQueryHandler: JobHandler = async (context) => {
  const { startDate, endDate } = windowFor(context.job);
  const connector = new GscConnector({
    propertyUrl:
      (context.account.identifiers.gsc as { propertyUrl?: string } | undefined)
        ?.propertyUrl,
  });

  const result = await connector.readReport(
    toConnectorAccount(context.account),
    { startDate, endDate, dimension: "query" },
    { accessToken: context.accessToken },
  );

  const facts = result.facts
    .map((fact) =>
      toGscFact(
        { ...fact, dimension: "gsc" },
        { workspaceId: context.job.workspace_id, accountId: context.account.id },
      ),
    )
    .filter((fact): fact is NonNullable<typeof fact> => fact !== null);

  const rowsWritten = await upsertGscFacts(context.db, facts);
  return { rowsWritten, notes: result.notes, providerCalls: 1 };
};

export const adsCampaignHandler: JobHandler = async (context) => {
  const { startDate, endDate } = windowFor(context.job);
  const connector = new GoogleAdsConnector({
    loginCustomerId:
      (context.account.identifiers.google_ads as
        | { managerCustomerId?: string }
        | undefined)?.managerCustomerId,
  });

  const result = await connector.readReport(
    toConnectorAccount(context.account),
    { startDate, endDate, dimension: "campaign" },
    { accessToken: context.accessToken },
  );

  const facts = result.facts
    .map((fact) =>
      toAdsFact(fact, {
        workspaceId: context.job.workspace_id,
        accountId: context.account.id,
        currency: context.connection.account_currency,
      }),
    )
    .filter((fact): fact is NonNullable<typeof fact> => fact !== null);

  const rowsWritten = await upsertAdsFacts(context.db, facts);
  return { rowsWritten, notes: result.notes, providerCalls: 1 };
};

export const gtmInventoryHandler: JobHandler = async (context) => {
  const { endDate } = windowFor(context.job);
  const connector = new GtmConnector();

  const result = await connector.readReport(
    toConnectorAccount(context.account),
    { startDate: endDate, endDate, dimension: "gtm" },
    { accessToken: context.accessToken },
  );

  const fact = result.facts[0];
  if (!fact) return { rowsWritten: 0, notes: result.notes };

  await upsertTagManagerSnapshot(context.db, {
    workspaceId: context.job.workspace_id,
    accountId: context.account.id,
    containerId: String(fact.values.container_id ?? context.account.id),
    versionId:
      typeof fact.values.version_id === "string" ? fact.values.version_id : null,
    versionNumber:
      typeof fact.values.version_number === "number"
        ? fact.values.version_number
        : null,
    publishedAt:
      typeof fact.values.published_at === "string"
        ? fact.values.published_at
        : null,
    tags: fact.values.tag_count ?? 0,
    triggers: fact.values.trigger_count ?? 0,
    variables: fact.values.variable_count ?? 0,
    workspaces: fact.values.workspace_count ?? 0,
    environments: fact.values.environment_count ?? 0,
    expectedMeasurementIds:
      typeof fact.values.measurement_ids === "string" &&
      fact.values.measurement_ids.length > 0
        ? fact.values.measurement_ids.split(",")
        : [],
    capturedAt: fact.sourceFetchedAt,
  });

  // The account, container, version, workspace and environment reads.
  return { rowsWritten: 1, notes: result.notes, providerCalls: 5 };
};

export const mailSyncHandler: JobHandler = async (context) => {
  const { startDate, endDate } = windowFor(context.job, 7);
  const connector = new GmailConnector({
    userId:
      (context.account.identifiers.gmail as { mailboxEmail?: string } | undefined)
        ?.mailboxEmail,
  });

  const result = await connector.readReport(
    toConnectorAccount(context.account),
    { startDate, endDate, dimension: "gmail", limit: 100 },
    { accessToken: context.accessToken },
  );

  // Mailbox metadata is written to the mailbox tables, not to the analytics
  // tables. The analytics warehouse never receives message content.
  let rowsWritten = 0;
  for (const fact of result.facts) {
    const values = fact.values;
    const messageId = String(values.message_id ?? fact.dimensionId);
    const threadId = String(values.thread_id ?? messageId);

    const { error: threadError } = await context.db
      .from("mailbox_threads")
      .upsert(
        {
          workspace_id: context.job.workspace_id,
          mailbox_id: context.account.id,
          provider_thread_id: threadId,
          subject: (values.subject as string | null) ?? null,
          snippet: (values.snippet as string | null) ?? null,
          is_unread: Boolean(values.is_unread),
          is_starred: Boolean(values.is_starred),
          has_attachments: false,
          last_message_at:
            (values.received_at as string | null) ??
            new Date().toISOString(),
          labels: String(values.labels ?? "")
            .split(",")
            .filter(Boolean),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "mailbox_id,provider_thread_id" },
      );
    if (threadError) {
      console.error("could not write the mailbox thread", threadError.message);
      continue;
    }

    const { error: messageError } = await context.db.from("mailbox_messages").upsert(
      {
        workspace_id: context.job.workspace_id,
        mailbox_id: context.account.id,
        provider_message_id: messageId,
        subject: (values.subject as string | null) ?? null,
        from_address: (values.from as string | null) ?? null,
        to_addresses: String(values.to ?? "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        snippet: (values.snippet as string | null) ?? null,
        sent_at: (values.received_at as string | null) ?? null,
        received_at: (values.received_at as string | null) ?? null,
        is_unread: Boolean(values.is_unread),
        is_draft: Boolean(values.is_draft),
        labels: String(values.labels ?? "")
          .split(",")
          .filter(Boolean),
        body_storage: "none",
        source_fetched_at: fact.sourceFetchedAt,
      },
      { onConflict: "mailbox_id,provider_message_id" },
    );
    if (messageError) {
      console.error("could not write the mailbox message", messageError.message);
      continue;
    }
    rowsWritten += 1;
  }

  return { rowsWritten, notes: result.notes, providerCalls: 1 + result.facts.length };
};