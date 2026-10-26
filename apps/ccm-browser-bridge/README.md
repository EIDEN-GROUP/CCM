# CCM Browser Bridge

A minimal Chromium (Manifest V3) extension that lets CCM open Medical Bay's
connected accounts in **the browser profile where the extension is installed**,
and proves that each request really came from CCM.

---

## Why this exists

A hosted web app can open a new tab with `window.open()`. That tab opens in
the same browser profile as the page that called it, so a provider session
that is still valid in that profile is reused. That covers most cases.

It does **not** cover:

- verifying afterwards that the right destination was actually opened;
- opening an account in a *different* browser profile than the one running CCM;
- telling the user, reliably, whether the provider session is still signed in.

This extension closes the first two gaps. The third is a provider decision and
CCM never claims otherwise.

## What it deliberately cannot do

- It does **not** request `cookies`, `history`, `<all_urls>`, `webRequest`,
  `passwords` or `formData` permissions. It uses `storage` for pairing and
  replay protection, plus `scripting` and exact provider login-host access to
  fill credentials after an explicit user action.
- It never reads, exports or stores provider cookies or MFA codes. Saved
  usernames and passwords are fetched directly from CCM using a short-lived,
  single-use ticket, kept in extension memory only for the active launch, and
  never written to extension storage or logs.
- Credential fill is limited to a visible username/password form on an
  exact provider login host. After the explicit "Open account and sign in"
  action, it submits only when both fields are present on that form. It does
  not bypass MFA or CAPTCHA; those challenges remain with the provider.
- It does **not** accept a URL from a web page. It accepts a *signed launch
  ticket* and reconstructs the destination from the ticket's own `host` and
  `path` claims, then re-checks the host against its own allowlist.

## Security model

```
CCM page                    Extension                     Provider
    |                            |                             |
    | POST /api/launch/ticket    |                             |
    |  { accountId, mode }       |                             |
    |---------------------------->| (no URL is sent)           |
    |                            |                             |
    | server loads identifiers,  |                             |
    | builds the URL itself,     |                             |
    | validates the host,        |                             |
    | signs a 60 s ES256 ticket  |                             |
    |                            |                             |
    | chrome.runtime             |                             |
    | .sendMessage(EXT_ID,       |                             |
    |   { type:'ccm.launch',     |                             |
    |     ticket })              |                             |
    |---------------------------->|                             |
    |                            | 1. sender.origin pinned?    |
    |                            | 2. signature valid?         |
    |                            | 3. not expired?             |
    |                            | 4. not replayed?            |
    |                            | 5. host on allowlist?       |
    |                            | 6. tabs.create(url) -------->|
    |                            |                             |
    | { ok, host, tabId }        |                             |
    |<----------------------------|                             |
```

Both sides validate independently:

- the **server** decides which URL is correct and refuses to mint a ticket for
  a host outside the provider allowlist;
- the **extension** holds its own copy of the allowlist and refuses to open
  anything that is not on it.

A ticket is single-use on both sides: the extension keeps a session-scoped
replay set, and the server marks the ticket consumed in Postgres.

TikTok is supported for browser launching and optional sign-in fill on
`www.tiktok.com`. The bridge does not access TikTok cookies or claim API
analytics/account discovery support.

## Install locally

1. Download and extract the packaged bridge from **Account Launcher → Set up
   account launching**, or use the source folder below.
2. Open `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the extracted folder or this source folder
   (`apps/ccm-browser-bridge`).
5. Open the extension's **Options** page (right-click → *Options*, or the
   toolbar icon → *Open setup*).
6. Enter your CCM origin — `http://localhost:3000` in development, or the
   production origin — and press **Save and verify key**.
7. Copy the **instance id** shown on that page.

The extension ID is fixed by the `key` in `manifest.json` and matches the
ID used by the CCM app and credential handoff. Keep that field when packaging.
Replacing an older installation that was loaded without this key may change
its extension ID; remove the old extension, install this package, then pair
the new instance id again.

Then in CCM: **Account Launcher → Set up account launching**, paste the
instance id, and map each account to the browser profile that holds its
provider session.

## Origins

`manifest.json` pins the origins the extension will accept messages from:

```json
"externally_connectable": {
  "matches": [
    "http://localhost:3000/*",
    "https://ccm.medicalbay.ma/*",
    "https://ccm.eiden-group.com/*"
  ]
}
```

**Change `https://ccm.medicalbay.ma/*` to your real production origin before
publishing.** The allowlist in `lib/allowlist.js` must also be kept in step
with `src/providers/registry.ts` in the main app; adding a provider means
adding it in both places, deliberately.

## Test it

1. Start CCM (`npm run dev`) and sign in.
2. Open **Account Launcher**, pick an account and press **Open account**.
   - Without the extension: a tab opens directly. CCM reports *"tab opened"* —
     not *"signed in"*.
   - With the extension: CCM routes the launch through the bridge, and the
     extension replies with the host it actually opened.
3. Press **Test launch** to confirm the bridge received the ticket, validated
   the destination and opened the mapped target. The result says nothing
   about whether the provider session is authenticated — that is the
   provider's call.

## Package for the Chrome Web Store

```bash
cd apps/ccm-browser-bridge
zip -r ccm-browser-bridge.zip manifest.json background.js popup.html popup.js options.html options.js lib
```

Then upload the zip at <https://chrome.google.com/webstore/devconsole>. Before
publishing:

- replace the production origin in `manifest.json`;
- add a real icon set (`icons/icon-16.png` … `icons/icon-128.png`);
- fill in the store listing and privacy policy.

## Browser support

| Browser | Extension | Notes |
|---|---|---|
| Chrome / Edge / Brave (Chromium 116+) | Supported | `chrome.storage.session` requires 102+. |
| Firefox | Not supported as-is | Firefox uses a different extension manifest (`browser_specific_settings`) and does not support `chrome.runtime.onMessageExternal` with the same `externally_connectable` shape. A separate build would be needed. |
| Safari | Not supported | Safari's WebExtension support is still limited. |

Without the extension, CCM still launches accounts through a normal new tab
and says so honestly.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest, minimum permissions, pinned origins |
| `background.js` | Message handling, ticket verification, tab creation |
| `lib/jws.js` | ES256 verification using Web Crypto only |
| `lib/allowlist.js` | Provider host allowlist |
| `lib/config.js` | Origin, instance id, cached public key |
| `options.html` / `options.js` | Pairing setup |
| `popup.html` / `popup.js` | Toolbar status |
