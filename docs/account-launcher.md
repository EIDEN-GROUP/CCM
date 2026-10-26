# The account launcher

The release-blocking feature. When a user clicks a launcher account, CCM
opens **the exact account destination** in a browser profile where the
provider session may still be valid.

---

## 1. The honest boundary

A hosted web page cannot read another site's cookies, cannot guarantee that
a third-party session has not expired, and cannot force a different browser
profile to open. Anyone who says otherwise is wrong.

What CCM *can* do, and does:

1. Open the **precise** destination for an account — the right Google Ads
   customer, the right GA4 property, the right Search Console property, the
   right GTM container, the right Instagram or TikTok profile, the right LinkedIn Page.
2. Open it in the browser profile the user is already using, so a valid
   provider session is reused.
3. With the browser bridge extension, open it in **a specific** profile and
   *verify* that the request came from CCM.
4. Tell the truth about the result: "a tab was opened" — never "you are
   signed in".
5. Hand off cleanly when the session has expired, so the user completes a
   normal sign-in, MFA or CAPTCHA.

CCM never reads, exports or stores provider cookies or MFA codes. An
integrations manager may create a browser-only launcher account with a
provider, account label, username and password; API-connected accounts can
also save a login on their tile. Browser-only entries have no API connection
or reporting data, and use a fixed provider entry URL from CCM's allowlist.
The password is encrypted with AES-256-GCM under the server-only
`APP_ENCRYPTION_KEY`, bound to that workspace and account, and is never
returned to the CCM page or written to extension storage. On an explicit
"Open account and fill sign-in" action, the paired extension redeems a
short-lived, single-use signed ticket and fills visible fields only on that
provider's exact login-host allowlist. When both username and password are
present on the same visible form, the extension submits that form as part of
the user's explicit action. Multi-step sign-in stops for the user to continue;
MFA and CAPTCHA remain with the provider.

## 2. Two independent state machines

This distinction is the core of the feature, and the UI shows both
separately on every tile.

| | API connection | Browser session |
|---|---|---|
| **Means** | CCM can read metrics from the provider in the background | The provider will reuse an existing login in that browser profile |
| **Stored in** | `provider_connections.status` | `account_launch_profiles.status` |
| **Values** | `connected` · `needs_setup` · `token_refresh_failed` · `permission_revoked` · `provider_outage` · `rate_limited` · `sync_stale` | `ready` · `profile_unmapped` · `extension_not_paired` · `helper_unavailable` · `browser_unsupported` |
| **Depends on** | An OAuth token and its scopes | The user's browser state |

A green API badge next to a red browser badge is **normal and
informative**. A revoked API token degrades the API status and leaves the
browser status alone, because they fail for different reasons.

## 3. The launch path

```
CCM tile  →  POST /api/launch/ticket { accountId, mode }
                │
                ├─ 1. authenticate; require `launch.execute`
                ├─ 2. load the account under RLS (404 if absent OR not permitted)
                ├─ 3. build the URL from stored identifiers via the provider registry
                ├─ 4. assert https + hostname ∈ provider allowlist
                ├─ 5. mint an ES256 ticket (60 s TTL, unique jti)
                ├─ 6. persist the ticket; record a `launch_events` row
                ▼
            { url, ticket, jti, expiresAt, host, path }
                │
                ├─ extension present?  → chrome.runtime.sendMessage(EXT_ID, { type:'ccm.launch', ticket })
                │                          extension verifies the signature and the host,
                │                          then chrome.tabs.create() in its own profile
                │
                └─ otherwise          → window.open(url, '_blank', 'noopener,noreferrer')
                ▼
            POST /api/launch/result { jti, outcome, token?, host? }
                → server re-verifies the ticket, marks it consumed, records the outcome
```

### The rule that makes it safe

**The browser never supplies a URL.** It sends an account id. The server
reads the account's stored identifiers, calls the provider registry's target
builder, and validates the result. A client cannot ask CCM to open
`https://evil.test/` because there is no code path that accepts a URL from
the client.

`tests/unit/launch-urls.test.ts` asserts:

- an `http:` URL is rejected;
- `javascript:` is rejected;
- `evil-analytics.google.com` is rejected (suffix match is not used);
- `analytics.google.com.evil.test` is rejected (substring match is not used);
- a host belonging to a different provider is rejected;
- a provider with no stored identifier returns `null` — the launcher says
  "identifier missing" rather than opening the provider homepage.

## 4. Launch tickets

A ticket is a short-lived, signed permission to open one page.

| Claim | Meaning |
|---|---|
| `iss` | `ccm` |
| `aud` | `ccm-launcher` |
| `sub` | the authenticated CCM user |
| `acc` | the external account being opened |
| `prv` | the provider key |
| `hst` | the destination hostname |
| `pth` | the destination path |
| `wsp` | the workspace |
| `jti` | a unique identifier, for single use |
| `iat` / `exp` | 60-second lifetime by default |

Signed with **ES256** (ECDSA P-256 / SHA-256). P-256 rather than Ed25519
because WebCrypto support for Ed25519 is still uneven across Chromium
builds, and the extension must verify tickets with the platform crypto API
and no third-party library at all.

`tests/unit/launch-tickets.test.ts` asserts: a valid ticket verifies; each
ticket has a unique `jti`; a ticket expires; a tampered payload fails; a
ticket signed by a different key fails; a malformed token fails; an
`alg: none` token fails; and the destination is rebuilt from the ticket
rather than trusted from the caller.

## 5. The browser bridge extension

`apps/ccm-browser-bridge/` — a Manifest V3 extension with **one**
permission: `storage`.

It does not request `cookies`, `history`, `<all_urls>`, `webRequest`,
`passwords` or `formData`. For optional saved-login fill, it requests
`scripting` and host access only for the exact provider login domains listed
in `manifest.json`; the extension's own provider map checks the host again.

### What it does when it receives a message

1. Checks `sender.origin` against its own pinned allowlist — independent of
   the manifest's `externally_connectable`.
2. Verifies the ticket signature with the **public** key. It never holds
   the signing secret, so it can verify but never mint.
3. Checks the issuer, the audience, the expiry and the `jti` against a
   session-scoped replay set in `chrome.storage.session`.
4. Checks the destination host against **its own** copy of the provider
   allowlist.
5. **Rebuilds the URL** from the ticket's `hst` and `pth` — it never accepts
   a URL from the message.
6. `chrome.tabs.create({ url })`, which opens in the profile where the
   extension is installed.
7. Replies `{ ok, host, provider, accountId, tabId, openedAt }`.

Both sides validate independently: the server decides which URL is correct,
and the extension decides whether it is willing to open it. Both must agree.

### Installing it

1. Download and extract the CCM Browser Bridge from the Account Launcher
   setup page, then open `chrome://extensions` → Developer mode →
   **Load unpacked** → select the extracted folder. Developers can load
   `apps/ccm-browser-bridge` directly.
2. Open the extension's options page, enter the CCM origin, press
   **Save and verify key**. The extension fetches the public verification
   key from `<origin>/api/launch/public-key` and caches it.
3. Copy the **instance id** shown on that page.
4. In CCM: **Account Launcher → Set up account launching** → paste the
   instance id → map the account to a browser profile.

The instance id identifies one browser profile. Installing the extension in
a second profile gives a second instance id, which is how CCM maps two
identities on the same provider to two profiles.

### Publishing it

```bash
cd apps/ccm-browser-bridge
zip -r ccm-browser-bridge.zip manifest.json background.js popup.html popup.js options.html options.js lib
```

Before publishing: replace `https://ccm.medicalbay.ma/*` in
`manifest.json` with the real production origin, and add an icon set.

## 6. Multiple browser profiles

A web page cannot force a different browser profile to open. The supported
workflows are:

| Situation | Solution |
|---|---|
| One profile, one identity | Nothing to do. A direct link opens a tab in the current profile. |
| Two identities on one provider | Install the bridge extension in both profiles and map each account to its instance id. |
| The account lives in a profile where the extension cannot be installed | The optional **local helper** (below). |
| Firefox / Safari | No extension build. A direct link opens in the current profile. The limitation is stated in the UI rather than hidden. |

### The optional local helper

A small, explicitly installed local service for the case where a
deterministic cross-profile launch is genuinely required. Its design
constraints:

- binds to `127.0.0.1` only;
- paired by pasting its instance id into CCM; the helper pins CCM's public
  verification key and the server records the pairing;
- accepts only a **signed launch ticket** from the paired origin — never a
  URL;
- verifies the ticket's signature, issuer, audience and expiry itself;
- validates the destination against the same provider allowlist;
- launches `chrome.exe --profile-directory="<name>" <url>` — the browser
  opens the profile with its own cookies, and the helper never reads them;
- records every launch in the audit log.

**Status: implemented** in `apps/ccm-helper/`, and **not yet run** — the
helper has never been started against a real browser profile, so the
cross-profile launch itself is unverified.

One design note differs from the first draft of this document. The helper is
driven by the **browser**, not by the CCM server. A Vercel deployment cannot
reach `127.0.0.1` on the owner's machine, so the flow is:

1. The user clicks **Open account** in CCM.
2. CCM asks the server for a short-lived, signed launch ticket.
3. The browser posts that ticket to `http://127.0.0.1:8787/launch`.
4. The helper verifies the ticket and opens the profile.
5. The browser reports the outcome back to CCM.

`http://127.0.0.1` is a potentially trustworthy origin, so the browser allows
the request from an HTTPS page without a mixed-content block; the helper
answers with a CORS header restricted to the paired origin.

The helper's own README is at `apps/ccm-helper/README.md`.

## 7. The user experience

Each account tile shows:

- the provider icon and the account label;
- the **browser session** status;
- the **API status**;
- the assigned browser profile;
- `Open account` and `Open management` buttons;
- a `Test launch` action.

`Test launch` verifies that the bridge **received the ticket, validated the
destination and opened the mapped target**. It says nothing about whether
the provider session is authenticated, and the UI keeps those two results
visibly separate.

### The messages

| Situation | What the user sees |
|---|---|
| Launch succeeded | "Tab opened" — plus the note that CCM cannot tell whether the provider session is signed in. |
| The browser blocked the popup | "The browser blocked the new tab", with a direct link to open it manually. |
| The extension refused the request | The refusal reason, and a pointer to the launch log. |
| No extension installed | "Browser bridge extension not detected", explaining that direct links still work. |
| The account is mapped to another profile | "Local helper not paired", with the two remedies. |
| The provider session expired | The provider's own sign-in screen. CCM's copy says: providers expire sessions and may require sign-in, MFA or a CAPTCHA at any time. |

## 8. The audit trail

`launch_events` records every attempt: the workspace, the account, the
user, the ticket, the mode, the outcome, the host and a reason. Outcomes:

```
opened · blocked
rejected_expired · rejected_replayed · rejected_host_not_allowed
rejected_invalid_ticket · rejected_wrong_account
```

`audit_events` additionally records mapping changes, helper pairing events
and account launch attempts, **without** recording sensitive URL query
tokens, cookies or provider credentials.

## 9. Browser support

| Browser | Extension | Notes |
|---|---|---|
| Chrome / Edge / Brave (Chromium 116+) | Supported | `chrome.storage.session` needs 102+. |
| Firefox | Not supported as-is | Different manifest (`browser_specific_settings`); `onMessageExternal` with `externally_connectable` does not have the same shape. A separate build would be needed. |
| Safari | Not supported | Safari's WebExtension support is still limited. |

Without the extension, CCM still launches accounts through a normal tab and
says so honestly. The limitation is documented in the product, not hidden.
