"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronDown, LoaderCircle, Pencil, Plus, X } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Dropdown } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

export type WorkspaceChoice = { id: string; name: string; role: string };

export function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
  canCreateWorkspace,
  canRenameWorkspace,
}: {
  workspaces: WorkspaceChoice[];
  activeWorkspaceId: string;
  canCreateWorkspace: boolean;
  canRenameWorkspace: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [mode, setMode] = useState<"closed" | "create" | "rename">("closed");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0];
  if (!active) return null;
  const currentWorkspaceId = active.id;

  async function switchWorkspace(id: string, close: () => void) {
    if (id === currentWorkspaceId) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/workspaces/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: id }),
      });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? t("shell.workspaceActionError"));
      close();
      startTransition(() => router.refresh());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("shell.workspaceActionError"));
    } finally {
      setBusy(false);
    }
  }

  async function saveWorkspace(event: FormEvent<HTMLFormElement>, close: () => void) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/workspaces", {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? t("shell.workspaceActionError"));
      setName("");
      setMode("closed");
      close();
      startTransition(() => router.refresh());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("shell.workspaceActionError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dropdown
      label={t("shell.workspace")}
      panelRole="group"
      align="start"
      className="min-w-0"
      trigger={({ toggle, open, id, panelId, triggerRef }) => (
        <button
          ref={triggerRef}
          type="button"
          id={id}
          onClick={toggle}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          aria-label={`${t("shell.workspace")}: ${active.name}`}
          title={active.name}
          className={cn(
            "inline-flex h-11 min-w-0 max-w-[min(240px,calc(100vw-10rem))] items-center gap-2 rounded-lg border border-border bg-surface px-3",
            "text-label-md font-semibold text-secondary transition-[background-color,border-color] duration-150 hover:border-primary/40 hover:bg-pale/50",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink",
          )}
        >
          <Building2 aria-hidden="true" className="size-4 shrink-0 text-primary-ink" />
          <span className="min-w-0 flex-1 truncate text-start">{active.name}</span>
          <ChevronDown aria-hidden="true" className={cn("size-4 shrink-0 text-muted-text transition-transform duration-200", open && "rotate-180")} />
        </button>
      )}
    >
      {({ close }) => (
        <div className="w-[min(19rem,calc(100vw-2rem))] space-y-1 p-1">
          <p className="px-3 pb-1 pt-2 text-label-sm font-semibold uppercase tracking-wide text-muted-text">
            {t("shell.workspaces")}
          </p>
          <div className="max-h-52 space-y-0.5 overflow-y-auto">
            {workspaces.map((workspace) => (
              <button
                key={workspace.id}
                type="button"
                disabled={busy}
                onClick={() => void switchWorkspace(workspace.id, close)}
                className="flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-start text-body-sm text-secondary transition-colors hover:bg-pale disabled:opacity-60"
              >
                <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
                {workspace.id === active.id ? <Check aria-hidden="true" className="size-4 shrink-0 text-primary-ink" /> : null}
              </button>
            ))}
          </div>

          {(canCreateWorkspace || canRenameWorkspace) && mode === "closed" ? (
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border pt-2">
              {canCreateWorkspace ? (
                <button
                  type="button"
                  onClick={() => { setError(null); setName(""); setMode("create"); }}
                  className="flex min-h-10 items-center justify-center gap-1.5 rounded-md px-2 text-label-sm font-semibold text-primary-ink transition-colors hover:bg-pale"
                >
                  <Plus aria-hidden="true" className="size-4" />{t("shell.addWorkspace")}
                </button>
              ) : null}
              {canRenameWorkspace ? (
                <button
                  type="button"
                  onClick={() => { setError(null); setName(active.name); setMode("rename"); }}
                  className="flex min-h-10 items-center justify-center gap-1.5 rounded-md px-2 text-label-sm font-semibold text-secondary transition-colors hover:bg-surface-muted"
                >
                  <Pencil aria-hidden="true" className="size-3.5" />{t("shell.renameWorkspace")}
                </button>
              ) : null}
            </div>
          ) : null}

          {mode !== "closed" ? (
            <form onSubmit={(event) => void saveWorkspace(event, close)} className="mt-2 space-y-2 border-t border-border px-2 pt-3">
              <label htmlFor="workspace-name" className="block text-label-sm font-semibold text-secondary">
                {t("shell.workspaceName")}
              </label>
              <Input
                id="workspace-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                minLength={2}
                maxLength={80}
                autoFocus
                required
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setMode("closed")} className="flex size-10 items-center justify-center rounded-md text-muted-text hover:bg-surface-muted" aria-label={t("common.cancel")}>
                  <X aria-hidden="true" className="size-4" />
                </button>
                <button type="submit" disabled={busy || name.trim().length < 2} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-3 text-label-md font-semibold text-tertiary transition-colors hover:bg-primary-60 disabled:cursor-not-allowed disabled:opacity-60">
                  {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Check aria-hidden="true" className="size-4" />}
                  {mode === "create" ? t("shell.createWorkspace") : t("shell.saveWorkspaceName")}
                </button>
              </div>
              {error ? <p role="alert" className="pb-1 text-body-sm text-error-ink">{error}</p> : null}
            </form>
          ) : error ? <p role="alert" className="px-3 py-2 text-body-sm text-error-ink">{error}</p> : null}
        </div>
      )}
    </Dropdown>
  );
}
