# Open-source reference notes

Five projects were reviewed as **references for architecture and product
patterns**, not as code to copy. This document records what was actually
inspected, what was taken, what was deliberately left, and the licence
position for each.

Reviewed on **20 October 2026**. Re-verify before relying on any of it.

---

## 1. `jafforgehq/site-analytics-tool`

* <https://github.com/jafforgehq/site-analytics-tool>
* Licence: **MIT**. TypeScript, SQL/PLpgSQL, some CSS/HTML.
* Maturity: very early — 2 stars, 1 contributor, created June 2026.

**What it is.** A self-hosted dashboard for GA4, Google Search Console and
Bing Webmaster Tools across multiple sites, with daily scheduled syncs,
sync history, stale-data detection, sanitised errors, data-retention
controls, CSV/ZIP and PDF exports, and a privacy mode for screen sharing.

**What was taken.**

- **The shape of a narrow vertical slice.** The project is deliberately
  "single-admin by design" — no signup, no billing, no workspaces, no roles.
  That is exactly the right size for a first slice, and CCM adopts the
  discipline (a narrow slice, done completely) while adding the multi-user
  layer the brief requires.
- **MFA as a read gate, not a login gate.** Its RLS requires *both* an
  allowlisted admin **and** an MFA-verified (`aal2`) session before browser
  reads succeed. CCM applies the same idea: the session claim is checked
  server-side, and a future requirement for an `aal2` assertion is a policy
  change, not an application rewrite.
- **"Data coverage" as a first-class panel.** The portfolio view surfaces
  coverage gaps, not just totals. CCM's `coverage` field on every
  aggregation and the Data Freshness panel come from this pattern.
- **Privacy mode for exports and screenshots.** Adopted as CCM's
  "share safe" mode.
- **Sanitised error surfaces.** Sync failures show a sanitised message and a
  last-good-data timestamp rather than a raw provider response. CCM's
  `sync_errors` table and the Stale Data notice follow this.

**What was deliberately left.**

- The static-frontend + Edge Functions shape. CCM needs authenticated,
  server-rendered workspaces with RLS-scoped reads on every request, so it
  uses the Next.js server rather than a static bundle talking to PostgREST.
- The allowlist model. CCM uses a role matrix plus per-account grants,
  because a medical-tourism business has more than one kind of user (an
  analyst and a mailbox-only operator) and a flat allowlist cannot express
  that.

**Caveat.** With two stars and one contributor, this is a reference for
*shape*, not for production readiness. Nothing was copied.

---

## 2. `PostHog/posthog`

* <https://github.com/PostHog/posthog>
* Licence: **"Other"** — the repository is *not* uniformly permissive. It
  contains areas with separate licensing, including enterprise directories.
  Review any specific folder before reuse; assume no reuse without a
  licence review.
* Very large, very active (40k+ stars), polyglot (Go, Python, Rust, TS).

**What was taken.**

- **The separation of aggregate behaviour from session replay.** PostHog
  treats replay as a distinct surface with its own privacy model. CCM
  follows: it links to the native Clarity project for replay and heatmaps
  and does **not** store recordings, form fields or page text in its own
  store. The privacy boundary is a design decision, not a later retrofit.
- **Event models that separate the raw event from the rolled-up metric.**
  PostHog's "events" table and its derived aggregates are distinct
  concepts. CCM mirrors this with `social_post_metrics` (per-post facts)
  beside `social_account_metrics` (per-day aggregates), and with
  `metric_source_references` preserving lineage back to the source record.
- **A queryable context layer.** PostHog's direction is "let agents query
  your data with sources attached". CCM's AI analyst contract is the same
  shape: an answer with an inspectable list of the records behind it, and
  no answer when there are no records.

**What was deliberately left.**

- Self-hosting PostHog. It is a product, not a library, and it would
  duplicate what the Clarity integration already provides for this
  workspace. The brief lists it as an *optional* additional source, to be
  considered only after checking data region, budget and legal
  requirements.

---

## 3. `gitroomhq/postiz-app`

* <https://github.com/gitroomhq/postiz-app>
* Licence: **AGPL-3.0**. TypeScript, Next.js, Redis, Postgres.
* 37k+ stars, active, 223 open issues.

**What was taken.**

- **A unified account registry across heterogeneous social platforms.**
  Postiz's provider model — one integration per platform, each with its own
  credentials, capabilities and publish permissions — is the right shape for
  CCM's social workspace and its `provider_connections` /
  `external_accounts` split.
- **Per-provider capability declaration rather than a global flag.** Postiz
  knows which networks support publishing, which support analytics, and
  which need extra app review. CCM's `ProviderDefinition.capabilities`
  array does the same, and every unimplemented capability in CCM carries a
  written limitation (enforced by a test).
- **The content calendar pattern** — account, format, copy, media, schedule,
  timezone, destination — as the model for CCM's publishing preview. CCM
  adopts the *shape of the preview* but ships no publish action.

**What was deliberately left.**

- The whole publishing engine, and the licence. AGPL-3.0 has copyleft
  obligations that make code reuse risky for a product intended for
  commercial deployment. CCM treats Postiz purely as a UX reference.
- Automatic publishing. The brief requires that a publishing action preview
  the exact target, media, copy, schedule/timezone and destination and
  require user confirmation. CCM has no publish action in this release, so
  there is nothing to confirm.

---

## 4. `umami-software/umami`

* <https://github.com/umami-software/umami>
* Licence: **MIT**. TypeScript, React, Postgres, Next.js.
* 39k+ stars, actively maintained.

**What was taken.**

- **A calm, low-noise analytics surface.** Umami's design instinct is the
  opposite of a dense BI tool: one page, the key metrics, no menu maze.
  This is the closest published relative of the Medicalbay Calm Care layout
  — white surface, generous whitespace, a small number of well-chosen
  panels, and the metric itself given the most weight on the card.
- **A single environment variable to run it.** Umami needs only
  `DATABASE_URL`. CCM's own configuration is deliberately similar in spirit:
  the handful of variables in `.env.example` are the real contract, and
  `/setup` names exactly which ones are missing.
- **MCP disabled by default.** Umami ships its MCP endpoint off unless
  explicitly enabled and API-key authenticated. CCM applies the same
  default-off principle to the AI analyst surface.

**What was deliberately left.**

- PostHog as the event store. CCM is a reporting command centre over
  *other people's* platforms, not a collector of raw events.

---

## 5. `plausible/analytics`

* <https://github.com/plausible/analytics>
* Licence: **AGPL-3.0** (community edition). Elixir/Phoenix, Clickhouse,
  Postgres, TypeScript, Tailwind.
* 29k+ stars.

**What was taken.**

- **"Measure traffic, not individuals" as a product principle.** Plausible
  stores no IP addresses and no persistent identifiers. CCM's marketing
  analytics holds only aggregate daily facts — no visitor-level rows, no
  IP addresses, no user identifiers anywhere in the metric tables.
- **A deliberately small, readable dashboard.** Every key insight on one
  screen. Applied to CCM's Overview: KPI row, one trend chart, one campaign
  table, one alerts panel, one freshness panel.
- **Source-based reporting, shown next to the report.** Plausible shows the
  referrer source in the same view as the metric. CCM shows the connector,
  the source field, the fetched-at timestamp and the metric definition
  alongside every number.

**What was deliberately left.**

- The licence. AGPL-3.0 again makes this a design reference only.
- The self-hosted Clickhouse deployment. CCM's storage is Postgres via
  Supabase, which is enough for aggregate daily facts at this scale and
  keeps the VPS path simple.

---

## Cross-cutting lessons applied to CCM

1. **Show coverage, not just totals.** Every aggregation in CCM returns a
   `coverage` figure and a `missing` count. A number without its coverage is
   not finished.
2. **Stale data must be visible.** CCM computes freshness per connection and
   renders a "last known good data" notice, with the age of that data.
3. **Sanitise provider errors.** Provider error bodies are truncated and
   classified into a small set of codes; raw responses never reach the UI.
4. **A privacy mode for exports.** "Share safe" masks customer, mailbox and
   sensitive account identifiers.
5. **Per-provider capability declarations, each with a written limitation.**
   Enforced by `tests/unit/launch-urls.test.ts`.
6. **Keep the configuration surface small and name what is missing.** The
   `/setup` screen lists the exact variables that are absent.
7. **Default-off for anything that touches user content.** The AI analyst
   and per-mailbox AI processing are off until enabled.

## Licence inventory

| Project | Licence | Reuse in CCM |
|---|---|---|
| `site-analytics-tool` | MIT | Patterns only. No code copied. |
| `umami` | MIT | Patterns only. No code copied. |
| `PostHog` | "Other" (mixed) | Design reference only. No code copied. |
| `postiz-app` | AGPL-3.0 | UX reference only. No code copied. |
| `plausible/analytics` | AGPL-3.0 | Design reference only. No code copied. |

CCM's own dependencies are listed in `package.json` and pinned exactly. Every
runtime dependency is MIT, ISC or Apache-2.0; there is no copyleft
dependency in the shipped application.
