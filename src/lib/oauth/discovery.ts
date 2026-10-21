import { serverEnv } from "@/lib/env";

/**
 * Finding the accounts a token can reach.
 *
 * The authorisation tells CCM that the owner allowed the app. It does not
 * tell CCM *which* Page, Instagram account, organisation or mailbox the
 * token is for. That is a second step, and it is where a connection either
 * becomes real or quietly becomes empty.
 *
 * Each discovery function returns the accounts the token can actually
 * reach. If it finds none, the connection is not created — a connection
 * that reports "connected" but can read nothing is the failure mode this
 * whole module exists to prevent.
 */

export interface DiscoveredAccount {
  /** The provider key this account belongs to. */
  providerKey: string;
  /** The provider's own id for the account. */
  externalAccountId: string;
  /** What the owner will see on the tile. */
  displayLabel: string;
  /** The identifiers the launcher and the connectors need. */
  identifiers: Record<string, unknown>;
}

/**
 * Discover the accounts for a provider.
 */
export async function discoverAccounts(
  providerKey: string,
  accessToken: string,
): Promise<DiscoveredAccount[]> {
  switch (providerKey) {
    case "google":
      return discoverGoogleAccounts(accessToken);
    case "meta":
      return discoverMetaAccounts(accessToken);
    case "linkedin":
      return discoverLinkedInAccounts(accessToken);
    default:
      return [];
  }
}

/**
 * Google.
 *
 * One authorisation covers several products, so the account for each
 * product comes from the owner's configuration: the GA4 property id, the
 * Search Console property, the GTM container, the Ads customer, the YouTube
 * channel. The mailbox is different — the token itself says which mailbox
 * it is, so it is read from the Gmail profile.
 */
async function discoverGoogleAccounts(
  accessToken: string,
): Promise<DiscoveredAccount[]> {
  const accounts: DiscoveredAccount[] = [];

  const propertyId = serverEnv.ga4PropertyId();
  if (propertyId) {
    accounts.push({
      providerKey: "ga4",
      externalAccountId: propertyId,
      displayLabel: `GA4 ${propertyId}`,
      identifiers: { ga4: { propertyId } },
    });
  }

  const propertyUrl = serverEnv.gscPropertyUrl();
  if (propertyUrl) {
    accounts.push({
      providerKey: "gsc",
      externalAccountId: propertyUrl,
      displayLabel: `Search Console ${propertyUrl}`,
      identifiers: { gsc: { propertyUrl } },
    });
  }

  const containerId = serverEnv.gtmContainerId();
  if (containerId) {
    accounts.push({
      providerKey: "gtm",
      externalAccountId: containerId,
      displayLabel: `Tag Manager ${containerId}`,
      identifiers: { gtm: { containerId } },
    });
  }

  const customerId = serverEnv.googleAdsCustomerId();
  if (customerId) {
    accounts.push({
      providerKey: "google_ads",
      externalAccountId: customerId,
      displayLabel: `Google Ads ${customerId}`,
      identifiers: {
        google_ads: {
          customerId,
          managerCustomerId: customerId,
        },
      },
    });
  }

  const channelId = serverEnv.youtubeChannelId();
  if (channelId) {
    accounts.push({
      providerKey: "youtube",
      externalAccountId: channelId,
      displayLabel: `YouTube ${channelId}`,
      identifiers: { youtube: { channelId } },
    });
  }

  // The mailbox comes from the token itself.
  const mailbox = await readGmailProfile(accessToken);
  if (mailbox) {
    accounts.push({
      providerKey: "gmail",
      externalAccountId: mailbox.email,
      displayLabel: mailbox.email,
      identifiers: { gmail: { mailboxEmail: mailbox.email } },
    });
  }

  return accounts;
}

/**
 * The Gmail profile, which is the mailbox the token belongs to.
 */
async function readGmailProfile(
  accessToken: string,
): Promise<{ email: string } | null> {
  try {
    const response = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!response.ok) return null;

    const body = (await response.json()) as { emailAddress?: string };
    return body.emailAddress ? { email: body.emailAddress } : null;
  } catch {
    return null;
  }
}

/**
 * Meta — Facebook Pages and the Instagram professional accounts behind
 * them.
 */
async function discoverMetaAccounts(
  accessToken: string,
): Promise<DiscoveredAccount[]> {
  const accounts: DiscoveredAccount[] = [];

  const response = await fetch(
    "https://graph.facebook.com/v23.0/me/accounts?fields=id,name,access_token,instagram_business_account,followers_count,category&limit=100&access_token=" +
      encodeURIComponent(accessToken),
  );

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    throw new Error(
      `Meta could not list the Pages: ${body.error?.message ?? `HTTP ${response.status}`}`,
    );
  }

  const body = (await response.json()) as {
    data?: Array<{
      id: string;
      name: string;
      access_token?: string;
      instagram_business_account?: { id: string; username?: string };
    }>;
  };

  for (const page of body.data ?? []) {
    accounts.push({
      providerKey: "meta",
      externalAccountId: page.id,
      displayLabel: page.name,
      identifiers: { meta: { pageId: page.id } },
    });

    // The Instagram professional account behind the page. Its insights
    // need a token scoped to the IG account, which the page token is not
    // — the account is still listed, so the owner can see it and connect
    // it properly.
    const instagram = page.instagram_business_account;
    if (instagram) {
      accounts.push({
        providerKey: "instagram",
        externalAccountId: instagram.id,
        displayLabel: instagram.username
          ? `@${instagram.username}`
          : `Instagram ${instagram.id}`,
        identifiers: {
          meta: {
            igBusinessAccountId: instagram.id,
            pageId: page.id,
            username: instagram.username ?? null,
          },
        },
      });
    }
  }

  return accounts;
}

/**
 * LinkedIn — the organisations the app is allowed to administer.
 */
async function discoverLinkedInAccounts(
  accessToken: string,
): Promise<DiscoveredAccount[]> {
  const response = await fetch(
    "https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&roleAssignee=me&state=APPROVED&limit=100",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    throw new Error(
      `LinkedIn could not list the organisations: ${body.message ?? `HTTP ${response.status}`}`,
    );
  }

  const body = (await response.json()) as {
    elements?: Array<{ organization?: string; roleAssignee?: string }>;
  };

  const accounts: DiscoveredAccount[] = [];

  for (const element of body.elements ?? []) {
    const id = (element.organization ?? "").split(":").pop() ?? "";
    if (!id) continue;

    const name = await readLinkedInOrganisationName(accessToken, id);

    accounts.push({
      providerKey: "linkedin",
      externalAccountId: id,
      displayLabel: name ?? `Organisation ${id}`,
      identifiers: { linkedin: { organizationId: id } },
    });
  }

  return accounts;
}

/**
 * The organisation's name, when the token may read it.
 */
async function readLinkedInOrganisationName(
  accessToken: string,
  organizationId: string,
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.linkedin.com/v2/organizations/${encodeURIComponent(organizationId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!response.ok) return null;

    const body = (await response.json()) as { name?: string };
    return body.name ?? null;
  } catch {
    return null;
  }
}
