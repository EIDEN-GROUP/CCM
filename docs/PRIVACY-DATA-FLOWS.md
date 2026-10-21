# Privacy and data flows

Medical Bay operates in a **health-adjacent** context: medical tourism,
cosmetic dentistry and hair transplantation. Some of the people who
contact the business are patients. That shapes how CCM may handle data.

> **This document describes what the software does. It is not legal advice
> and it is not a compliance statement.** Morocco's Law 09-08 and the CNDP's
> guidance, together with the rules of any destination country, must be
> assessed by qualified counsel before CCM processes real personal data. The
> engineering controls below are designed to make that assessment easier —
> not to replace it.

---

## 1. The boundary CCM draws

**CCM is a marketing and business-operations command centre. It is not an
electronic health record, not a patient-management system and not a
clinical decision tool.**

Consequently CCM never stores, and is designed so that it cannot store:

- clinical records, diagnoses, treatment data or clinical notes;
- patient identity beyond what a marketing form already collected;
- free-text patient enquiries in the analytics layer;
- names, email addresses, phone numbers or health details as analytics
  event names, event parameters, URL parameters or dimensions.

The rule is structural, not procedural: the metric tables have no column in
which such a value could sensibly be stored, and the connector adapters
only ever request aggregate dimensions from the providers.

## 2. What flows where

### 2.1 The website → the analytics layer

```
Visitor  →  medicalbay.ma  →  GA4 / GTM  →  Google
              │
              └─ form submission ─→  the site's own handler  →  mailbox
                                        (never to GA4, never to CCM)
```

**What may be sent to GA4, Google Ads, Search Console, Meta, LinkedIn or
any third-party analytics:** aggregate events only, with no personal data
as the event name or a parameter.

The approved event taxonomy is deliberately small and non-identifying:

| Event | Meaning | Parameters allowed |
|---|---|---|
| `quote_request_submitted` | A quotation request form was submitted | none |
| `contact_form_submitted` | A contact form was submitted | none |
| `whatsapp_click` | The WhatsApp button was used | none |
| `phone_click` | A phone number was clicked | none |
| `newsletter_signup` | A newsletter signup completed | none |

`quote_request_submitted` and `contact_form_submitted` are counted as
**aggregate conversions**. The name, the email address, the phone number
and the free-text question stay in the site's own backend and in the
mailbox. They never reach an ad platform, an analytics dimension, a URL, a
UTM parameter or an AI prompt.

### 2.2 The mailbox → CCM

```
Mail provider  →  CCM mailbox tables  →  the authorised user
```

The mailbox is a **separate subsystem** with its own tables, its own
permission (`inbox.read` / `inbox.send`) and its own Row Level Security
policies. Mailbox content is never joined into the analytics layer.

| Stored | Not stored by default |
|---|---|
| Thread id, subject, participants, labels, timestamps, read/starred flags | Message bodies |
| Message ids, from/to/cc addresses, timestamps, sizes | Attachments |
| A short preview snippet (may contain sensitive content) | Full message text |

The snippet is the one piece of free text CCM caches, because a mailbox
list is unusable without a preview. It is treated accordingly:

- it lives only in the mailbox tables, never in a metric table, an export,
  a report, a log line or an analytics dimension;
- it is readable only by users with `inbox.read` **and** an explicit grant
  on that mailbox;
- it is never included in an AI request.

### 2.2a Reading and sending mail

Reading a message is a **provider round trip**. When someone opens a
thread, CCM asks Gmail for the bodies, shows them, and forgets them: a body
is never written to Postgres, never cached, and never placed in a log line
or an error report. The only thing that is stored is the metadata, so the
mailbox list can be drawn without a request per thread.

Sending is a **two-step, confirmed** action:

```
Compose → Prepare (creates a draft in the provider)
        → the interface shows the resolved recipient and sending identity
        → Confirm (sends the draft)
```

The prepare step returns a **sealed confirmation** that binds the draft to
that user, that workspace and that mailbox for five minutes. The send step
refuses a confirmation that is missing, tampered with, expired, minted for
another user or minted for another workspace. A draft is left in the
provider either way, so nothing is lost if the confirmation expires — the
owner can finish the message in Gmail.

Every send is written to the audit log with the recipient, the subject and
the provider's message id, so the trail shows who sent what and from where.

### 2.3 The provider apps

The client id and the client secret of a provider's app are stored, so
that connecting a provider does not need a redeploy.

| Stored | Not stored |
|---|---|
| The client id — it is not a secret, it identifies the app | Anything the owner pasted that is not the app's own secret |
| The client secret, encrypted with AES-256-GCM under the application encryption key, bound to its row | The secret in clear, in any table, in any response or in any log line |

The secret is never returned by an endpoint. The settings screen shows
*whether* a secret is stored, not the secret, and the input field says
"leave blank to keep the stored one".

Only somebody with `settings.manage` may read or change a credential, and
the change is written to the audit log as a warning — it is the one action
that gives a new party access to a provider.

### 2.4 The AI analyst

```
Question + synced metric records  →  model  →  Answer + source list
```

The analyst is grounded in data CCM has already synced. It receives metric
records and their metadata — never mailbox content, never a credential,
never a patient identifier.

Its contract:

- an answer cites the records behind it, and `ai_insight_sources` holds
  that trail;
- an answer with no sources is not shown as an answer;
- freshness, filters and caveats are shown with the answer;
- missing data is reported as missing, never inferred;
- observation, hypothesis and recommendation are visibly separated;
- it may **propose** a task. It cannot send mail, publish content, change a
  budget, publish a GTM container, delete anything or change a permission.

AI processing of mailbox content is **opt-in per mailbox** and defaults to
off. A mailbox with it off never sends a body or an attachment to a model.

### 2.5 Provider credentials

```
CCM server  →  provider token (in memory, per request)  →  provider API
     │
     └─ AES-256-GCM encrypted at rest, key held outside the database
```

Provider tokens are never sent to the browser, never written to a log,
never included in an export, and never visible to an authenticated
database client.

### 2.6 The account launcher

```
CCM tile  →  signed ticket  →  browser / extension  →  provider page
```

The launcher sends an account id and a short-lived signed ticket. It never
transmits a cookie, a password, an MFA code or a session token, and it
never reads one.

## 3. Data minimisation in the analytics layer

| Principle | How it is applied |
|---|---|
| No visitor-level rows | Every metric table is keyed by `(workspace, account, date, dimension)`. There is no table of individual sessions. |
| No IP addresses | CCM never requests, stores or derives them. |
| No persistent identifiers | No user id, no client id, no session id is stored for a website visitor. |
| No cross-site tracking | CCM is a first-party reporting tool; it does not embed a tracker on `medicalbay.ma`. |
| Aggregate only | GA4, Ads and Search Console facts are daily aggregates. |
| No free text in dimensions | The connector adapters request named dimensions. A dimension value is a country, a device, a query or a campaign — never a message. |

## 4. Retention

| Data | Default | Configurable |
|---|---|---|
| Daily metric facts | 25 months | Yes — `user_preferences.data_retention` |
| Sync runs and errors | 90 days | Yes |
| Launch events | 12 months | Yes |
| Audit events | 24 months | Yes — audit retention is a compliance decision and should be reviewed before it is shortened |
| Mailbox metadata | 12 months | Yes, per mailbox |
| Mailbox message bodies | **not stored** | n/a |
| Launch tickets | 60 seconds | Fixed by design |
| Provider credentials | Until the connection is disconnected | Deleted on disconnect |

Disconnecting a provider deletes its credentials. A full data-deletion
request removes the workspace's rows through the cascade on `workspaces`.

## 5. Access to sensitive data

| Role | Websites | Ads / GA4 / SEO | Mailbox | Settings | Audit log |
|---|---|---|---|---|---|
| Owner | ✔ | ✔ | only with a grant | ✔ | ✔ |
| Admin | ✔ | ✔ | only with a grant | ✔ | ✔ |
| Marketing Analyst | ✔ | ✔ | ✘ | ✘ | ✘ |
| SEO | ✔ | ✔ | ✘ | ✘ | ✘ |
| Ads Manager | ✔ | ✔ | ✘ | ✘ | ✘ |
| Social Manager | ✔ | social only | ✔ | ✘ | ✘ |
| Mailbox User | ✘ | ✘ | only granted mailboxes | ✘ | ✘ |
| Read-only | ✔ | ✔ | ✘ | ✘ | ✘ |

The matrix is enforced in the database (`role_permissions` plus
`external_account_grants`), not in the interface.

## 6. Third parties and data residency

| Processor | What it receives | Where |
|---|---|---|
| Supabase | Application data, credentials (encrypted), mailbox metadata | Your chosen Supabase region |
| Vercel | Request metadata, session cookies | Vercel edge |
| Google (GA4, Ads, GSC, GTM, Gmail) | Aggregate metrics; mailbox content for authorised mailboxes | Google |
| Meta, LinkedIn, Ahrefs, Clarity | Aggregate metrics, when connected | Their regions |

Running on a VPS with **self-hosted Supabase** moves the first two rows to
infrastructure you control. It does not move the Google, Meta or LinkedIn
rows — those remain with the provider, and that is the privacy-relevant
fact.

## 7. Checks before going live with real data

1. Counsel has assessed Morocco's Law 09-08 / CNDP obligations and any
   applicable destination-country transfer rules.
2. The form submission handler has been reviewed to confirm that names,
   emails, phone numbers and free-text questions never reach GA4, Google
   Ads, a URL parameter or a UTM parameter.
3. The event taxonomy in §2.1 matches the events the site actually fires.
4. Google OAuth scopes are confirmed to be minimum-necessary, and any
   restricted-scope verification has been completed.
5. `ACCOUNT_ENCRYPTION_KEY` and the launch signing keys are in the host's
   secret store, and their rotation procedures have been rehearsed.
6. The RLS suite has been run against the live database and its output
   recorded.
7. Mailbox AI processing is left **off** unless a specific mailbox has been
   explicitly approved for it.
8. A retention schedule has been set and the audit-retention period
   reviewed.
