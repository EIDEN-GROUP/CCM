"use client";

import { useEffect, useState } from "react";
import { CircleCheck, LoaderCircle, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import {
  getExtensionInstanceId,
  isExtensionAvailable,
} from "@/lib/launch/client";
import type { LaunchableAccount } from "@/lib/launch/service";

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

/**
 * The pairing step of the launcher setup.
 *
 * The extension's instance id identifies one browser profile. The operator
 * copies it here and CCM records it against the accounts that live in that
 * profile.
 */
export function LauncherSetup({ accounts }: { accounts: LaunchableAccount[] }) {
  const [extensionPresent, setExtensionPresent] = useState<boolean | null>(null);
  const [detected, setDetected] = useState<string | null>(null);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const present = await isExtensionAvailable();
      if (cancelled) return;
      setExtensionPresent(present);
      if (present) {
        const id = await getExtensionInstanceId();
        if (!cancelled) setDetected(id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = accounts.find((item) => item.id === accountId) ?? accounts[0];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Step 1 — install the browser bridge"
          subtitle="Optional, but it adds verified launches and profile mapping"
        />
        <CardBody className="space-y-3">
          {extensionPresent === null ? (
            <p className="flex items-center gap-2 text-body-sm text-muted-text">
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              Checking for the extension…
            </p>
          ) : extensionPresent ? (
            <p className="flex items-center gap-2 text-body-sm text-primary-ink">
              <CircleCheck aria-hidden="true" className="size-4" />
              The browser bridge is installed in this browser profile.
            </p>
          ) : (
            <Notice tone="warning" title="Extension not detected">
              <p>
                Load the unpacked extension from{" "}
                <code className="rounded bg-surface px-1.5 py-0.5 text-[13px]">
                  apps/ccm-browser-bridge
                </code>{" "}
                in <code className="rounded bg-surface px-1.5 py-0.5 text-[13px]">chrome://extensions</code>,
                open its options page and enter this CCM origin. Account
                launching still works without it — the tab simply opens in the
                current profile.
              </p>
            </Notice>
          )}

          {detected ? (
            <div className="space-y-1.5">
              <p className="text-label-md font-semibold text-secondary">
                This profile&apos;s instance id
              </p>
              <code className="block select-all rounded-md border border-border bg-surface-muted px-3 py-2 font-mono text-body-sm text-secondary">
                {detected}
              </code>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Step 2 — map a browser profile"
          subtitle="Tie an account to the profile that holds its provider session"
        />
        <CardBody className="space-y-4">
          {accounts.length === 0 ? (
            <Notice tone="info" title="No accounts yet">
              Register a provider account from Integrations first, then come
              back to map it to a browser profile.
            </Notice>
          ) : (
            <>
              <Field label="Account" htmlFor="account" required>
                <Select
                  id="account"
                  value={accountId}
                  onChange={(event) => setAccountId(event.target.value)}
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.providerName} — {account.displayLabel}
                    </option>
                  ))}
                </Select>
              </Field>

              {selected ? (
                <MappingForm
                  key={selected.id}
                  account={selected}
                  detectedInstanceId={detected}
                />
              ) : null}
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Multiple browser profiles"
          subtitle="What is and is not possible"
        />
        <CardBody className="space-y-3 text-body-sm text-secondary">
          <p>
            A normal web page cannot force Chrome, Edge or Firefox to open a
            different profile. The bridge extension can, because it opens the
            tab in the profile where it is installed — so the reliable
            workflow for a second identity is to install the extension in that
            profile and map the account to that instance id.
          </p>
          <p className="flex items-start gap-2">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
            The optional local helper exists for the case where the account
            lives in a profile you cannot install the extension into. It is
            explicitly installed and paired by you, it only accepts
            allow-listed hosts and configured profile directories, and it never
            reads, exports or modifies cookies or passwords.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="The local helper"
          subtitle="For a profile the extension cannot be installed in"
        />
        <CardBody className="space-y-3 text-body-sm text-secondary">
          <p>
            The helper is a small program that runs on your own machine. It
            opens the account in a named browser profile — the one case a web
            page and the extension both cannot cover.
          </p>
          <ol className="ml-4 list-decimal space-y-1.5">
            <li>
              Run it from the repository:{" "}
              <code className="rounded bg-surface px-1.5 py-0.5 text-[13px]">
                cd apps/ccm-helper &amp;&amp; npm install &amp;&amp; npm start
              </code>
            </li>
            <li>
              Pair it with this deployment:{" "}
              <code className="rounded bg-surface px-1.5 py-0.5 text-[13px]">
                {
                  'curl -X POST http://127.0.0.1:8787/pair -H "Content-Type: application/json" -d \'{"origin":"https://your-ccm-origin"}\''
                }
              </code>
            </li>
            <li>
              Choose <strong>Local helper</strong> as the launch mode above
              and name the browser profile directory — the one shown in{" "}
              <code className="rounded bg-surface px-1.5 py-0.5 text-[13px]">
                chrome://version
              </code>
              , for example <code>Profile 1</code> or <code>Default</code>.
            </li>
          </ol>
          <p className="flex items-start gap-2">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
            The helper accepts only a signed launch ticket, checks the
            destination against the provider allowlist, and opens the browser
            with the browser&apos;s own cookie store. It never reads a cookie,
            a password or an MFA code.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

/**
 * The mapping form for one account.
 *
 * Keyed by the account id, so switching accounts remounts the form and it
 * re-initialises from the newly selected account's saved mapping.
 */
function MappingForm({
  account,
  detectedInstanceId,
}: {
  account: LaunchableAccount;
  detectedInstanceId: string | null;
}) {
  // The saved mapping is the starting point. Without this, saving the form
  // would silently wipe the instance id the operator had already recorded.
  const [instanceId, setInstanceId] = useState(
    account.extensionInstanceId ?? "",
  );
  const [profileLabel, setProfileLabel] = useState(
    account.browserProfileLabel ?? "",
  );
  const [profileDirectory, setProfileDirectory] = useState(
    account.browserProfileDirectory ?? "",
  );
  const [mode, setMode] = useState<"direct" | "extension" | "helper">(
    account.launchMode,
  );
  const [state, setState] = useState<SaveState>({ kind: "idle" });

  async function save() {
    setState({ kind: "saving" });
    try {
      const response = await fetch("/api/launch/profiles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: account.id,
          launchMode: mode,
          browserProfileLabel: profileLabel.trim() || null,
          browserProfileDirectory: profileDirectory.trim() || null,
          extensionInstanceId: instanceId.trim() || null,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        status?: string;
      } | null;

      if (!response.ok) {
        setState({
          kind: "error",
          message:
            body?.error ?? `The mapping could not be saved (HTTP ${response.status}).`,
        });
        return;
      }
      setState({ kind: "saved" });
    } catch {
      setState({
        kind: "error",
        message: "CCM could not reach the server to save the mapping.",
      });
    }
  }

  return (
    <div className="space-y-4">
      <Field
        label="Extension instance id"
        htmlFor="instance-id"
        hint="Paste the id from the extension's options page, or use the button above."
      >
        <Input
          id="instance-id"
          value={instanceId}
          onChange={(event) => {
            setInstanceId(event.target.value);
            setState({ kind: "idle" });
          }}
          placeholder="00000000-0000-0000-0000-000000000000"
        />
      </Field>

      {detectedInstanceId ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setInstanceId(detectedInstanceId);
            setState({ kind: "idle" });
          }}
        >
          Use this browser profile&apos;s instance id
        </Button>
      ) : null}

      <Field
        label="Profile label"
        htmlFor="profile-label"
        hint="How this profile appears to your team, e.g. “Chrome — Work”."
      >
        <Input
          id="profile-label"
          value={profileLabel}
          onChange={(event) => {
            setProfileLabel(event.target.value);
            setState({ kind: "idle" });
          }}
          placeholder="Chrome — Work"
        />
      </Field>

      <Field
        label="Profile directory"
        htmlFor="profile-directory"
        hint="The Chrome/Edge profile directory (for example “Profile 1”). Only used by the optional local helper; leave blank for a direct launch."
      >
        <Input
          id="profile-directory"
          value={profileDirectory}
          onChange={(event) => {
            setProfileDirectory(event.target.value);
            setState({ kind: "idle" });
          }}
          placeholder="Default"
        />
      </Field>

      <Field
        label="Launch mode"
        htmlFor="launch-mode"
        hint="How the account should be opened."
      >
        <Select
          id="launch-mode"
          value={mode}
          onChange={(event) => {
            setMode(event.target.value as "direct" | "extension" | "helper");
            setState({ kind: "idle" });
          }}
        >
          <option value="direct">Direct — open a tab in this browser</option>
          <option value="extension">
            Extension — open in the profile where the bridge is installed
          </option>
          <option value="helper">
            Local helper — open in a specific browser profile
          </option>
        </Select>
      </Field>

      <Button
        variant="primary"
        size="md"
        onClick={save}
        disabled={state.kind === "saving"}
      >
        {state.kind === "saving" ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : null}
        Save mapping
      </Button>

      {state.kind === "saved" ? (
        <p className="flex items-center gap-2 text-body-sm text-primary-ink">
          <CircleCheck aria-hidden="true" className="size-4" />
          Mapping saved. The account tile now shows this profile.
        </p>
      ) : null}

      {state.kind === "error" ? (
        <p
          role="alert"
          className="flex items-center gap-2 text-body-sm text-error"
        >
          <TriangleAlert aria-hidden="true" className="size-4" />
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
