# CCM local helper

An explicitly installed companion for the one case neither a web page nor the
browser bridge extension can cover: **opening an account in a specific browser
profile that the extension is not installed in**.

---

## What it does, and what it deliberately does not

| | |
|---|---|
| **Does** | Bind to `127.0.0.1` only, accept a signed launch ticket from a paired CCM origin, verify the ticket's signature, check the destination against the provider allowlist, and open the browser in the configured profile. |
| **Does not** | Read, export or modify cookies, passwords, sessions or MFA codes. Accept a URL from a web page. Listen on a routable interface. Sign in to any provider. Bypass a CAPTCHA or an MFA challenge. |

The browser opens the profile with its **own** cookie store. The helper never
touches it — it just asks the browser to open a tab, and the browser does the
rest.

## Install

```bash
cd apps/ccm-helper
npm install
npm start
```

The helper writes its configuration to `~/.ccm-helper/config.json`
(override with `CCM_HELPER_CONFIG`).

## Pair it with CCM

```bash
curl -X POST http://127.0.0.1:8787/pair \
  -H "Content-Type: application/json" \
  -d '{"origin":"https://ccm.medicalbay.ma"}'
```

The response contains the **instance id**. Paste that into CCM:
**Account Launcher → Set up account launching → Local helper**, and set the
browser profile directory (for example `Profile 1` or `Default`).

The helper fetches and pins CCM's public verification key from
`<origin>/api/launch/public-key`, so it can verify every ticket it is given.

## How a launch works

1. The user clicks **Open account** in CCM.
2. CCM asks the server for a short-lived, signed launch ticket.
3. The browser posts the ticket to `http://127.0.0.1:8787/launch`.
4. The helper verifies the signature, the issuer, the audience, the expiry and
   the host allowlist, then opens the browser in the mapped profile.
5. The browser reports the outcome back to CCM, which records it in the audit
   log.

The helper never receives a URL. It receives a ticket, and rebuilds the
destination from the ticket's own claims.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `CCM_HELPER_PORT` | `8787` | The loopback port. |
| `CCM_HELPER_CONFIG` | `~/.ccm-helper/config.json` | Where the pairing is stored. |
| `CCM_HELPER_LAUNCHER` | Chrome on the platform | The browser executable. |

## Platform notes

- **Windows** — the default launcher is
  `C:\Program Files\Google\Chrome\Application\chrome.exe`. Set
  `CCM_HELPER_LAUNCHER` for Edge, Brave or a portable Chrome.
- **macOS** — `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.
- **Linux** — `/usr/bin/google-chrome`.

`--profile-directory` is what selects the profile. The names are the ones
shown in `chrome://version` — `Default`, `Profile 1`, and so on.

## Security notes

- The helper is a **local** tool. It has no secrets of its own beyond the
  pinned public key, and it stores no browsing data.
- The paired origin is checked on every request, so another site cannot use
  the helper to launch anything.
- The ticket expires in 60 seconds and is single use.
- If the browser is closed and restarted, the pairing survives; if the
  configuration file is deleted, the helper must be paired again.
