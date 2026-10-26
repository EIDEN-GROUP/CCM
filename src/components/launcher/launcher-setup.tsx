"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import { CircleCheck, Download, LoaderCircle, TriangleAlert } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
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
 * Fill a translated template with React nodes.
 *
 * The catalogue holds the sentence; the values — a file path, a command — stay
 * React nodes so they keep the code formatting the screen gives them, and a
 * command stays copyable.
 */
function fill(template: string, parts: Record<string, ReactNode>): ReactNode[] {
  return template.split(/(\{\w+\})/g).map((chunk, index) => {
    const name = /^\{(\w+)\}$/.exec(chunk)?.[1];
    const content = name ? (parts[name] ?? chunk) : chunk;
    return <Fragment key={index}>{content}</Fragment>;
  });
}

/**
 * The pairing step of the launcher setup.
 *
 * The extension's instance id identifies one browser profile. The operator
 * copies it here and CCM records it against the accounts that live in that
 * profile.
 */
export function LauncherSetup({ accounts }: { accounts: LaunchableAccount[] }) {
  const { t } = useI18n();
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
          title={t("pages.launcher.step1Title")}
          subtitle={t("pages.launcher.step1Subtitle")}
        />
        <CardBody className="space-y-3">
          {extensionPresent === null ? (
            <p className="flex items-center gap-2 text-body-sm text-muted-text">
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              {t("pages.launcher.checkingExtension")}
            </p>
          ) : extensionPresent ? (
            <p className="flex items-center gap-2 text-body-sm text-primary-ink">
              <CircleCheck aria-hidden="true" className="size-4" />
              {t("pages.launcher.extensionInstalled")}
            </p>
          ) : (
            <Notice tone="warning" title={t("pages.launcher.extensionNotDetectedTitle")}>
              <p>
                {fill(t("pages.launcher.loadExtensionBody"), {
                  bridgePath: (
                    <code className="rounded bg-surface px-1.5 py-0.5 text-label-sm">
                      apps/ccm-browser-bridge
                    </code>
                  ),
                  extensionsUrl: (
                    <code className="rounded bg-surface px-1.5 py-0.5 text-label-sm">
                      chrome://extensions
                    </code>
                  ),
                })}
              </p>
            </Notice>
          )}

          {detected ? (
            <div className="space-y-1.5">
              <p className="text-label-md font-semibold text-secondary">
                {t("pages.launcher.instanceIdLabel")}
              </p>
              <code className="block select-all rounded-md border border-border bg-surface-muted px-3 py-2 font-mono text-body-sm text-secondary">
                {detected}
              </code>
            </div>
          ) : null}

          <a
            href="/downloads/ccm-browser-bridge.zip"
            download="ccm-browser-bridge.zip"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-primary/35 bg-pale px-4 text-label-md font-semibold text-primary-ink transition-[background-color,border-color,transform] duration-150 hover:-translate-y-px hover:border-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink"
          >
            <Download aria-hidden="true" className="size-4" />
            {t("pages.launcher.downloadBridgeExtension")}
          </a>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t("pages.launcher.step2Title")}
          subtitle={t("pages.launcher.step2Subtitle")}
        />
        <CardBody className="space-y-4">
          {accounts.length === 0 ? (
            <Notice tone="info" title={t("pages.launcher.noAccountsTitle")}>
              {t("pages.launcher.noAccountsBody")}
            </Notice>
          ) : (
            <>
              <Field label={t("pages.launcher.accountLabel")} htmlFor="account" required>
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
          title={t("pages.launcher.multiProfileTitle")}
          subtitle={t("pages.launcher.multiProfileSubtitle")}
        />
        <CardBody className="space-y-3 text-body-sm text-secondary">
          <p>{t("pages.launcher.multiProfileBody")}</p>
          <p className="flex items-start gap-2">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning-ink" />
            {t("pages.launcher.multiProfileHelperBody")}
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t("pages.launcher.helperTitle")}
          subtitle={t("pages.launcher.helperSubtitle")}
        />
        <CardBody className="space-y-3 text-body-sm text-secondary">
          <p>{t("pages.launcher.helperIntro")}</p>
          <ol className="ms-4 list-decimal space-y-1.5">
            <li>
              {fill(t("pages.launcher.helperRunCommand"), {
                command: (
                  <code className="rounded bg-surface px-1.5 py-0.5 text-label-sm">
                    cd apps/ccm-helper &amp;&amp; npm install &amp;&amp; npm start
                  </code>
                ),
              })}
            </li>
            <li>
              {fill(t("pages.launcher.helperPairBody"), {
                code: <strong>{t("pages.launcher.pairingCode")}</strong>,
                command: (
                  <code className="rounded bg-surface px-1.5 py-0.5 text-label-sm">
                    {
                      'curl -X POST http://127.0.0.1:8787/pair -H "Content-Type: application/json" -d \'{"origin":"https://your-ccm-origin","pairingToken":"<the code it printed>"}\''
                    }
                  </code>
                ),
              })}
            </li>
            <li>
              {fill(t("pages.launcher.helperChooseBody"), {
                mode: (
                  <strong>{t("pages.launcher.modeHelperShort")}</strong>
                ),
                version: (
                  <code className="rounded bg-surface px-1.5 py-0.5 text-label-sm">
                    chrome://version
                  </code>
                ),
                example: (
                  <code className="rounded bg-surface px-1.5 py-0.5 text-label-sm">
                    Profile 1
                  </code>
                ),
                fallback: (
                  <code className="rounded bg-surface px-1.5 py-0.5 text-label-sm">
                    Default
                  </code>
                ),
              })}
            </li>
          </ol>
          <p className="flex items-start gap-2">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning-ink" />
            {t("pages.launcher.helperWarning")}
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
  const { t, tp } = useI18n();

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
            body?.error ??
            tp("pages.launcher.mappingSaveFailed", { status: response.status }),
        });
        return;
      }
      setState({ kind: "saved" });
    } catch {
      setState({
        kind: "error",
        message: t("pages.launcher.serverUnreachable"),
      });
    }
  }

  return (
    <div className="space-y-4">
      <Field
        label={t("pages.launcher.instanceIdLabelField")}
        htmlFor="instance-id"
        hint={t("pages.launcher.instanceIdHint")}
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
          {t("pages.launcher.useDetectedInstance")}
        </Button>
      ) : null}

      <Field
        label={t("pages.launcher.profileLabelLabel")}
        htmlFor="profile-label"
        hint={t("pages.launcher.profileLabelHint")}
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
        label={t("pages.launcher.profileDirectoryLabel")}
        htmlFor="profile-directory"
        hint={t("pages.launcher.profileDirectoryHint")}
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
        label={t("pages.launcher.launchModeLabel")}
        htmlFor="launch-mode"
        hint={t("pages.launcher.launchModeHint")}
      >
        <Select
          id="launch-mode"
          value={mode}
          onChange={(event) => {
            setMode(event.target.value as "direct" | "extension" | "helper");
            setState({ kind: "idle" });
          }}
        >
          <option value="direct">{t("pages.launcher.modeDirect")}</option>
          <option value="extension">{t("pages.launcher.modeExtension")}</option>
          <option value="helper">{t("pages.launcher.modeHelper")}</option>
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
        {t("pages.launcher.saveMapping")}
      </Button>

      {state.kind === "saved" ? (
        <p className="flex items-center gap-2 text-body-sm text-primary-ink">
          <CircleCheck aria-hidden="true" className="size-4" />
          {t("pages.launcher.mappingSaved")}
        </p>
      ) : null}

      {state.kind === "error" ? (
        <p
          role="alert"
          className="flex items-center gap-2 text-body-sm text-error-ink"
        >
          <TriangleAlert aria-hidden="true" className="size-4" />
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
