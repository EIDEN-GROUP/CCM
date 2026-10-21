# Connector capability matrix

What each provider connector can actually do today, what it needs from the
owner before it can report live data, and where its numbers stop being
trustworthy.

**Verified 20 October 2026 against the provider's own documentation.** API
versions change; re-verify before each release.

**Credential state on the live project (measured with `npm run doctor`):**
Supabase, the app encryption key, the cron secret, the Gemini key and the
Search Console property URL are populated. The **Google Cloud project, the
Google OAuth client, GA4, Google Ads, GTM, YouTube, Meta, LinkedIn, Ahrefs
and Clarity are not yet set**, so those connectors are `Needs setup`. The
launch signing key pair is present but truncated and must be regenerated
before the account launcher can sign a ticket.

---

## Summary

| Connector | API version | Read metrics | Read accounts | Launch | Write | Live today |
|---|---|---|---|---|---|---|
| Google Ads | `v25` | yes | no | yes | no | Needs setup |
| GA4 | `v1beta` | yes | no | yes | no | Needs setup |
| Search Console | `v1` | yes | no | yes | no | Needs setup |
| GTM | `v2` | yes (inventory) | yes | yes | no | Needs setup |
| Gmail / Workspace | `v1` | yes (metadata) | yes | yes | no | Needs setup |
| Meta / Facebook | `v23.0` | yes (organic) | yes | yes | no | Needs setup |
| Instagram | `v23.0` | yes (organic) | via Page | yes | no | Needs setup |
| LinkedIn | `2026-10` | yes (restricted API) | yes | yes | no | Needs setup |
| Ahrefs | `v3` | yes (rank tracker) | no | yes | no | Needs setup |
| Clarity | `export-v1` | no | no | yes | no | Needs setup |
| PageSpeed | `v5` | no | no | yes | no | Needs setup |
| Uptime / SSL | n/a | no | no | yes | no | Needs setup |

"Needs setup" is the honest state: the adapter, the schema, the contract
tests and the setup checklist exist; no provider is connected to a live
account yet. No connector reports `Connected` without a working token.

**"Read metrics" means the adapter exists and returns normalised daily
facts.** It does not mean the numbers are on screen — that needs a live
token, an account id and a completed sync.

---

## Google Ads

| | |
|---|---|
| **API** | `v25`, `POST /customers/{customerId}/googleAds:searchStream` |
| **Auth** | OAuth 2.0 (user or service account) against one Google Cloud project |
| **Access model** | **Developer tokens were sunset on 9 September 2026.** Access levels are now granted on the Google Cloud project: *Test* (15,000 ops/day, test accounts only), *Explorer* (≤2,880 ops/day, production, automated review), *Basic* (brand verification + manual review), *Standard* (manual review). The connector sends **no** `developer-token` header. |
| **Scopes** | `adwords` |
| **Reads** | Campaign / ad group / ad / keyword / search-term metrics: impressions, clicks, cost, conversions, conversion value, CTR, average CPC. Device, geo and network segments. Budget and pacing from the campaign budget resource. |
| **Does not read** | Change history, policy statuses, and asset-level policy review state are not implemented in this slice. |
| **Writes** | **None.** Read-only in v1. |
| **Blocks the owner must clear** | 1. Enable the Google Ads API on the Google Cloud project. 2. Apply for *Explorer* access (production read) on the **Google Ads API Overview** page of the Cloud Console — **not** in the Ads API Center, which no longer processes applications. 3. For *Basic* or *Standard*, complete brand verification. 4. Link the target customer to a manager account if you need cross-account reporting. |
| **Gotcha** | A project on *Test* access fails against a production account with `AuthorizationError.CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION` (v25+). The contract test asserts the connector sends no developer token. |

**Money and time.** Cost is reported in micros of the account currency. The
connector stores `cost_micros` and `conversion_value_micros` and never
converts. The account's own timezone and currency are stored on the
connection.

**Comparability.** Ads conversions use the Google Ads attribution model and
the conversion actions configured in the account. They are **not** comparable
with GA4 key events. CCM shows both and never merges them.

---

## GA4

| | |
|---|---|
| **API** | `v1beta`, `POST /v1beta/properties/{propertyId}:runReport` |
| **Auth** | OAuth 2.0, same Google Cloud project |
| **Scopes** | `https://www.googleapis.com/auth/analytics.readonly` |
| **Reads** | Sessions, active users, new users, engaged sessions, screen page views, key events, revenue. Dimensions: date, session source/medium, campaign, landing page, page path, device, country, city, event name. |
| **Caveats surfaced by the connector** | *Cardinality thresholding* — rows may be grouped into `(other)`. *Data loss from other row* — totals may be withheld to protect a user. Both are reported in `ReportResult.notes` and shown in the UI. |
| **Writes** | None. |
| **Blocks the owner must clear** | Enable the Analytics Data API on the Cloud project. Grant the OAuth client Viewer access to the property. |
| **Property discovery** | Not implemented. The property id is configured by the owner. |
| **Note on this site** | `medicalbay.ma` ships **no** `G-` measurement id in its HTML; GA4 is configured inside GTM container `GTM-WF77DFJD`. The measurement id is therefore discovered from the GTM container, or supplied directly in `GA4_MEASUREMENT_ID`. |

---

## Search Console

| | |
|---|---|
| **API** | `v1`, `POST /webmasters/v3/sites/{siteUrl}/searchAnalytics/query` |
| **Auth** | OAuth 2.0 |
| **Scopes** | `https://www.googleapis.com/auth/webmasters.readonly` |
| **Reads** | Clicks, impressions, CTR, average position by date, query, page, country, device and search type. |
| **Hard limitation** | **The query endpoint returns aggregated rows.** It does not return every query. A site with many long-tail queries is sampled and grouped. CCM states this in the connector notes and in the SEO screen, and never presents the result as a complete query list. |
| **Row limit** | 25,000 rows per request. The connector clamps to that and reports a partial view when the limit is reached. |
| **Blocks the owner must clear** | Enable the Search Console API. The property must be verified — `medicalbay.ma` already carries a `google-site-verification` tag, so this is done. |
| **Property form** | `sc-domain:medicalbay.ma` or the full URL `https://www.medicalbay.ma/`. |

---

## Google Tag Manager

| | |
|---|---|
| **API** | `v2` |
| **Scopes** | `https://www.googleapis.com/auth/tagmanager.readonly` (read); `tagmanager.manage` (write — **not used**) |
| **Reads** | Container and workspace inventory, tag / trigger / variable lists, container versions, environments. |
| **Writes** | **None.** Publishing a container version requires a preview, an authorised approver, a before/after version reference and an audit record. That workflow does not exist yet, so there is no publish action in the UI — not a disabled button, an absent one. |
| **Tracking checks** | Presence of a GA4 tag, duplicate GA4 configuration tags, coverage of the approved event list, and whether the capture is newer than the last published version. |
| **Blocks the owner must clear** | Enable the Tag Manager API and share the container with the OAuth client. |
| **This site** | Container `GTM-WF77DFJD`. |

---

## Gmail / Google Workspace

| | |
|---|---|
| **API** | `v1` |
| **Scopes** | `gmail.readonly` (read); `gmail.send` (send, **not used** in v1) |
| **Reads** | Threads, messages, labels, drafts, attachments metadata. |
| **Writes** | **None.** Sending requires a confirmation step showing the recipient and the sending identity, plus an audit record. |
| **Host** | `medicalbay.ma` runs on **Google Workspace** — the MX record is `SMTP.GOOGLE.COM`. There is therefore no IMAP/SMTP path to design for. A different mail host would need its own connector and the owner's explicit approval. |
| **Restricted-scope warning** | If the scopes used are restricted, Google requires verification or a security assessment before production use. This is a **launch blocker** and must be tracked as one. |
| **Privacy** | Message bodies and attachments are **not** stored**. Only metadata and a short preview are cached, in tables with their own RLS policies. AI summarisation is opt-in per mailbox and defaults to off. |

---

## Meta / Facebook and Instagram

| | |
|---|---|
| **API** | Graph API `v23.0` |
| **Reads** | **Implemented.** Page insights (`page_impressions`, `page_engaged_users`, `page_post_engagements`, `page_consumptions`, `page_views_total`) and Instagram professional-account insights (`reach`, `impressions`, `profile_views`, `follower_count`, `media_count`, `total_interactions`), by day. The connector groups the provider's per-metric rows back into one daily account row. |
| **Window limitation** | Instagram only reports `reach` and `impressions` for a recent window. Older days are left empty, never zero. |
| **Organic vs paid** | Organic Instagram insights and paid Meta ads come from **different surfaces** with different permissions. CCM models them as separate series (`social_account_metrics.organic`) and never merges them. |
| **Writes** | **None.** Publishing requires app review and a confirmed target preview. |
| **Blocks the owner must clear** | A Meta app with the pages and insights permissions; app review for any publishing permission. An Instagram professional account linked to a Facebook Page. |
| **This site** | Meta pixel `911001063319751`; Facebook Page `100085861093531`; Instagram `medicalbay.maroc`. |

---

## LinkedIn

| | |
|---|---|
| **API** | Marketing API `2026-10` (pinned centrally) |
| **Version policy** | LinkedIn Marketing API versions are **time-based** and require scheduled migration. The version lives in the provider registry, not scattered through the code, so a migration is a one-file change. |
| **Reads** | **Implemented.** Organisation page statistics — `organicImpressionsImpressionsIndexed`, `organicImpressionsUniqueMembersImpressed`, `engagement` — at daily granularity. **The endpoint is a restricted partnership API.** A standard app receives a 403; the connector turns that into an explicit "no LinkedIn numbers" rather than substituting a different figure. |
| **Writes** | **None.** |
| **Blocks the owner must clear** | A LinkedIn app with organisation admin access and approved Marketing API scopes. |
| **This site** | Company Page `medical-bay-agadir`. |

---

## Ahrefs (rank tracking)

| | |
|---|---|
| **API** | `v3` — Site Explorer, Keywords Explorer, SERP Overview, **Rank Tracker**, Site Audit, Brand Radar, Batch Analysis |
| **Plan limits** | Lite 200,000 API units/month, 100 rows/request · Standard 800,000 units, 250 rows · Advanced 2,000,000 units, 500 rows. One API call costs a minimum of 50 units; units are shared with the Ahrefs MCP and Connect. |
| **MCP** | The **remote** MCP server is the only supported form; local MCP setup was discontinued. CCM's runtime calls API v3 directly — production data is never routed through an MCP. |
| **Reads** | **Implemented for rank tracking.** `GET /v3/rank-tracker/overview` with `project_id`, `device` (`desktop` or `mobile`) and a column selection — keyword, position, previous position, difference, country, language, location, URL, search volume. The endpoint is documented as **free**: it does not consume API units. The other Ahrefs surfaces (Site Explorer, Keywords Explorer, SERP Overview, Site Audit, Brand Radar, Batch Analysis) are not implemented. |
| **Critical separation** | A provider-estimated rank is **not** a Search Console average position. CCM stores them in different tables (`rank_snapshots` vs `daily_gsc_metrics`) and never averages them together. |
| **Blocks the owner must clear** | An Ahrefs API key with units available on the subscribed plan; a configured Rank Tracker project. |

---

## Microsoft Clarity

| | |
|---|---|
| **API** | The documented export surface. |
| **Reads** | Not implemented. |
| **Writes** | None. |
| **Privacy** | CCM links to the native Clarity project for replay and heatmaps. It does **not** store session recordings, form fields, page text or private identifiers, and it follows the provider's own masking controls. Verify the current quota, date window and available fields against the plan before implementing. |

---

## PageSpeed Insights and Uptime / SSL

| | |
|---|---|
| **PageSpeed** | `v5`. Not scheduled in this slice. An API key is optional but recommended for quota. |
| **Uptime / SSL** | No third-party API. The target hosts come from the website registry. Not scheduled in this slice. |

---

## Rules the code enforces

`tests/unit/launch-urls.test.ts` asserts, for every provider:

- every capability that is **not implemented** carries a written limitation;
- no provider advertises a write capability in the read-only release;
- the launch capability is declared exactly when a destination exists;
- every allowlisted host is a bare hostname with no scheme or path;
- an API version is pinned.

`tests/contract/connectors.test.ts` asserts the request shape and the
normalisation for GA4, Search Console and Google Ads, including that the
Google Ads adapter sends **no** `developer-token` header.
