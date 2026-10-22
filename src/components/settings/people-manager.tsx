"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import {
  Copy,
  LoaderCircle,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Chip } from "@/components/ui/chip";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { EmptyState } from "@/components/ui/states";
import { useI18n } from "@/components/providers/i18n-provider";
import type { NavLabelKey } from "@/domain/tabs";
import type { MessagePathRoot, Translator } from "@/lib/i18n";

/**
 * People and roles.
 *
 * The owner adds people, gives them a role, and decides for each role how
 * far into each tab it may go: **view**, **use** or **edit**.
 *
 * The levels are not decorative. They are derived into the feature
 * permissions the database enforces, so a tab level is the friendly surface
 * of the real authorisation. The owner sees tabs; the database sees
 * permissions; there is only one of each.
 */

/** A message key inside the `pages.people` namespace. */
type PeoplePath = Extract<MessagePathRoot, `pages.people.${string}`>;

/** A message key inside the shared role-label vocabulary. */
type RoleLabelPath = Extract<MessagePathRoot, `pages.people.roleLabels.${string}`>;

interface Member {
  id: string;
  userId: string;
  email: string | null;
  role: string;
  roleLabel: string;
  status: string;
  invitedAt: string | null;
  createdAt: string;
}

interface RoleDefinition {
  key: string;
  label: string;
  permissions: string[];
  levels: Record<string, string>;
  immutable: boolean;
}

interface TabSummary {
  key: string;
  labelKey: NavLabelKey;
  section: string;
  ownerOnly: boolean;
  immutable: boolean;
}

/**
 * The role labels.
 *
 * The role *key* stays in English — it is what the database and the
 * permissions are keyed on — while the label a person reads is translated.
 */
const ROLE_LABEL: Record<string, RoleLabelPath> = {
  owner: "pages.people.roleLabels.owner",
  admin: "pages.people.roleLabels.admin",
  marketing_analyst: "pages.people.roleLabels.marketing_analyst",
  seo: "pages.people.roleLabels.seo",
  ads_manager: "pages.people.roleLabels.ads_manager",
  social_manager: "pages.people.roleLabels.social_manager",
  mailbox_user: "pages.people.roleLabels.mailbox_user",
  read_only: "pages.people.roleLabels.read_only",
};

const MEMBER_STATUS: Record<string, PeoplePath> = {
  active: "pages.people.statusActive",
  invited: "pages.people.statusInvited",
  suspended: "pages.people.statusSuspended",
};

/**
 * The access levels.
 *
 * The key is what the database stores; the label is what the owner reads.
 */
const LEVELS = [
  { key: "none", path: "pages.people.levelNone" },
  { key: "view", path: "pages.people.levelView" },
  { key: "use", path: "pages.people.levelUse" },
  { key: "edit", path: "pages.people.levelEdit" },
] as const;

/** The navigation sections the tabs are grouped under. */
const SECTIONS = [
  { key: "overview", path: "nav.sectionOverview" },
  { key: "channels", path: "nav.sectionChannels" },
  { key: "operations", path: "nav.sectionOperations" },
  { key: "admin", path: "nav.sectionAdmin" },
] as const;

/**
 * The API reports its failures in English, because it is a developer-facing
 * surface. The screen translates the messages it knows and keeps the
 * developer's own detail — the file name, the table — untouched.
 */
function serverError(
  t: Translator,
  message: string,
  fallback: PeoplePath,
): string {
  if (message.includes("role_tab_access")) {
    return t("pages.people.tabMapMissing");
  }
  if (message.includes("supabase/repair.sql")) {
    return t("pages.people.repairRequired");
  }
  return t(fallback);
}

/** The translated name of a role, with the stored label as the fallback. */
function roleLabelFor(t: Translator, key: string, fallback: string): string {
  const path = ROLE_LABEL[key];
  return path ? t(path) : fallback;
}

export function PeopleManager({ currentUserId }: { currentUserId: string }) {
  const { t, tp } = useI18n();

  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [tabs, setTabs] = useState<TabSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [selectedRole, setSelectedRole] = useState<string>("admin");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [adding, setAdding] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("marketing_analyst");
  const [created, setCreated] = useState<{
    email: string;
    password: string;
    role: string;
    roleLabel: string;
  } | null>(null);

  /**
   * The fetch, with no state changes in it.
   *
   * Keeping the request separate from the state update is what lets the
   * effect below settle the results in a promise callback rather than
   * setting state while the effect is still running.
   */
  const fetchData = useCallback(async (): Promise<{
    members: Member[];
    roles: RoleDefinition[];
    tabs: TabSummary[];
    /** A failure in one of the two calls does not blank the other. */
    error: string | null;
  }> => {
    const [membersResponse, rolesResponse] = await Promise.all([
      fetch("/api/members"),
      fetch("/api/roles"),
    ]);

    const membersBody = (await membersResponse.json().catch(() => null)) as {
      members?: Member[];
      error?: string;
    } | null;
    const rolesBody = (await rolesResponse.json().catch(() => null)) as {
      roles?: RoleDefinition[];
      tabs?: TabSummary[];
      error?: string;
    } | null;

    // Each half is reported on its own, so a failure in one does not make
    // the other look empty.
    const errors: string[] = [];

    if (!membersResponse.ok || !membersBody?.members) {
      errors.push(
        serverError(
          t,
          membersBody?.error ?? "",
          "pages.people.membersReadFailed",
        ),
      );
    }
    if (!rolesResponse.ok || !rolesBody?.roles) {
      errors.push(
        serverError(t, rolesBody?.error ?? "", "pages.people.rolesReadFailed"),
      );
    }

    return {
      members: membersBody?.members ?? [],
      roles: rolesBody?.roles ?? [],
      tabs: rolesBody?.tabs ?? [],
      error: errors.length > 0 ? errors.join(" ") : null,
    };
  }, [t]);

  /** Reload, for a refresh after an action. */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchData();
      setMembers(data.members);
      setRoles(data.roles);
      setTabs(data.tabs);
      setError(data.error);
    } catch {
      setError(t("pages.people.serverUnreachable"));
    } finally {
      setLoading(false);
    }
  }, [fetchData, t]);

  useEffect(() => {
    let cancelled = false;

    void fetchData()
      .then((data) => {
        if (cancelled) return;
        setMembers(data.members);
        setRoles(data.roles);
        setTabs(data.tabs);
        setError(data.error);
      })
      .catch(() => {
        if (!cancelled) setError(t("pages.people.serverUnreachable"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchData, t]);

  const current = roles.find((role) => role.key === selectedRole);

  /** Select a role and start its editor from its current levels. */
  function selectRole(key: string) {
    const role = roles.find((item) => item.key === key);
    setSelectedRole(key);
    setDraft(role ? { ...role.levels } : {});
    setDirty(false);
  }

  async function saveRole() {
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: selectedRole, levels: draft }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        permissions?: string[];
      } | null;

      if (!response.ok) {
        setError(
          body?.error ??
            tp("pages.people.requestFailed", { status: response.status }),
        );
        return;
      }

      setNotice(
        tp("pages.people.roleSaved", {
          role: roleLabelFor(t, selectedRole, current?.label ?? selectedRole),
          count: body?.permissions?.length ?? 0,
        }),
      );
      setDirty(false);
      await load();
    } catch {
      setError(t("pages.people.serverUnreachable"));
    } finally {
      setSaving(false);
    }
  }

  async function addPerson(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, role: newRole }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        email?: string;
        password?: string;
        roleLabel?: string;
      } | null;

      if (!response.ok || !body?.password) {
        setError(
          body?.error ??
            tp("pages.people.requestFailed", { status: response.status }),
        );
        return;
      }

      setCreated({
        email: body.email ?? newEmail,
        password: body.password,
        role: newRole,
        roleLabel: body.roleLabel ?? newRole,
      });
      setNewEmail("");
      setAdding(false);
      await load();
    } catch {
      setError(t("pages.people.serverUnreachable"));
    } finally {
      setSaving(false);
    }
  }

  async function changeMember(member: Member, update: { role?: string; status?: string }) {
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: member.userId, ...update }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setError(
          body?.error ??
            tp("pages.people.requestFailed", { status: response.status }),
        );
        return;
      }

      setNotice(t("pages.people.updated"));
      await load();
    } catch {
      setError(t("pages.people.serverUnreachable"));
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-56 animate-pulse rounded-md bg-surface-muted/60" />
        <div className="h-40 animate-pulse rounded-lg bg-surface-muted/60" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {notice ? (
        <Notice tone="success" title={t("pages.people.doneTitle")}>
          {notice}
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="danger" title={t("pages.people.errorTitle")}>
          {error}
        </Notice>
      ) : null}

      {created ? (
        <Notice tone="warning" title={t("pages.people.passwordTitle")}>
          <p>
            <strong className="font-semibold">{created.email}</strong>{" "}
            {tp("pages.people.passwordBody", {
              role: roleLabelFor(t, created.role, created.roleLabel),
            })}
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-2">
            <code className="rounded bg-surface px-2 py-1 font-mono text-label-sm text-tertiary">
              {created.password}
            </code>
            <button
              type="button"
              onClick={() =>
                void navigator.clipboard
                  .writeText(created.password)
                  .catch(() => undefined)
              }
              className="inline-flex items-center gap-1 font-semibold text-primary-ink hover:underline"
            >
              <Copy aria-hidden="true" className="size-3.5" />
              {t("common.copy")}
            </button>
          </p>
        </Notice>
      ) : null}

      <Card>
        <CardHeader
          title={t("pages.people.peopleTitle")}
          subtitle={t("pages.people.peopleSubtitle")}
          actions={
            <Button
              variant="primary"
              size="md"
              onClick={() => setAdding((current) => !current)}
              disabled={saving}
            >
              <UserPlus aria-hidden="true" className="size-4" />
              {t("pages.people.addPerson")}
            </Button>
          }
        />
        <CardBody className="space-y-4">
          {adding ? (
            <form
              onSubmit={addPerson}
              className="rounded-md border border-border bg-surface-muted/50 p-4"
            >
              <div className="grid gap-3 md:grid-cols-[2fr_1fr_auto]">
                <div>
                  <label
                    htmlFor="member-email"
                    className="mb-1 block text-label-md font-semibold text-secondary"
                  >
                    {t("pages.people.workEmail")}
                  </label>
                  <Input
                    id="member-email"
                    type="email"
                    required
                    value={newEmail}
                    onChange={(event) => setNewEmail(event.target.value)}
                    placeholder="name@medicalbay.ma"
                  />
                </div>
                <div>
                  <label
                    htmlFor="member-role"
                    className="mb-1 block text-label-md font-semibold text-secondary"
                  >
                    {t("pages.people.role")}
                  </label>
                  <Select
                    id="member-role"
                    value={newRole}
                    onChange={(event) => setNewRole(event.target.value)}
                  >
                    {roles
                      .filter((role) => role.key !== "owner")
                      .map((role) => (
                        <option key={role.key} value={role.key}>
                          {roleLabelFor(t, role.key, role.label)}
                        </option>
                      ))}
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button type="submit" variant="secondary" size="md" disabled={saving}>
                    {saving ? (
                      <LoaderCircle
                        aria-hidden="true"
                        className="size-4 animate-spin"
                      />
                    ) : null}
                    {t("pages.people.create")}
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-body-sm text-muted-text">
                {t("pages.people.passwordHint")}
              </p>
            </form>
          ) : null}

          {members.length === 0 ? (
            <EmptyState
              title={t("pages.people.emptyTitle")}
              description={t("pages.people.emptyBody")}
              icon={<Users className="size-5" />}
              className="border-0"
            />
          ) : (
            <ul className="divide-y divide-border/70">
              {members.map((member) => {
                const isSelf = member.userId === currentUserId;
                const isOwner = member.role === "owner";

                return (
                  <li
                    key={member.id}
                    className="flex flex-wrap items-center gap-3 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-tertiary">
                        {member.email ?? member.userId.slice(0, 8)}
                        {isSelf ? (
                          <span className="ms-2 text-body-sm font-normal text-muted-text">
                            {t("pages.people.you")}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-body-sm text-muted-text">
                        {t("pages.people.joined")}{" "}
                        {new Date(member.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <Chip
                      tone={
                        member.status === "active"
                          ? "success"
                          : member.status === "suspended"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {MEMBER_STATUS[member.status]
                        ? t(MEMBER_STATUS[member.status]!)
                        : member.status}
                    </Chip>

                    {isOwner ? (
                      <Chip tone="teal">
                        <ShieldCheck aria-hidden="true" className="size-3" />
                        {t("pages.people.roleLabels.owner")}
                      </Chip>
                    ) : (
                      <>
                        <label htmlFor={`role-${member.id}`} className="sr-only">
                          {tp("pages.people.roleOf", {
                            name: member.email ?? t("pages.people.thisPerson"),
                          })}
                        </label>
                        <Select
                          id={`role-${member.id}`}
                          value={member.role}
                          onChange={(event) =>
                            void changeMember(member, { role: event.target.value })
                          }
                          className="h-[38px] w-auto"
                        >
                          {roles
                            .filter((role) => role.key !== "owner")
                            .map((role) => (
                              <option key={role.key} value={role.key}>
                                {roleLabelFor(t, role.key, role.label)}
                              </option>
                            ))}
                        </Select>

                        {!isSelf ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              void changeMember(member, {
                                status:
                                  member.status === "suspended"
                                    ? "active"
                                    : "suspended",
                              })
                            }
                          >
                            {member.status === "suspended"
                              ? t("pages.people.restore")
                              : t("pages.people.suspend")}
                          </Button>
                        ) : null}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t("pages.people.rolesTitle")}
          subtitle={t("pages.people.rolesSubtitle")}
        />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {roles.map((role) => (
              <button
                key={role.key}
                type="button"
                onClick={() => selectRole(role.key)}
                aria-pressed={selectedRole === role.key}
                className={
                  selectedRole === role.key
                    ? "rounded-full border border-primary/40 bg-pale px-3.5 py-1.5 text-label-md font-semibold text-primary-ink"
                    : "rounded-full border border-border bg-surface px-3.5 py-1.5 text-label-md font-semibold text-muted-text transition-colors hover:bg-surface-muted"
                }
              >
                {roleLabelFor(t, role.key, role.label)}
              </button>
            ))}
          </div>

          {current ? (
            current.immutable ? (
              <Notice tone="info" title={t("pages.people.ownerAccessTitle")}>
                {t("pages.people.ownerAccessBody")}
              </Notice>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-body-sm">
                    <caption className="sr-only">
                      {tp("pages.people.matrixCaption", {
                        role: roleLabelFor(t, current.key, current.label),
                      })}
                    </caption>
                    <thead>
                      <tr className="border-b border-border">
                        <th
                          scope="col"
                          className="px-2 py-2 text-start font-semibold text-secondary"
                        >
                          {t("pages.people.tabColumn")}
                        </th>
                        {LEVELS.map((level) => (
                          <th
                            key={level.key}
                            scope="col"
                            className="px-2 py-2 text-center font-semibold text-secondary"
                          >
                            {t(level.path)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {SECTIONS.map((section) => {
                        const sectionTabs = tabs.filter(
                          (tab) => tab.section === section.key,
                        );
                        if (sectionTabs.length === 0) return null;

                        return (
                          <Fragment key={section.key}>
                            <tr>
                              <th
                                scope="row"
                                colSpan={LEVELS.length + 1}
                                className="px-2 pt-4 pb-1 text-start text-label-md font-bold uppercase tracking-[0.06em] text-muted-text"
                              >
                                {t(section.path)}
                              </th>
                            </tr>
                            {sectionTabs.map((tab) => {
                              const level = draft[tab.key] ?? "none";
                              const locked =
                                tab.immutable || tab.ownerOnly;

                              return (
                                <tr
                                  key={tab.key}
                                  className="border-b border-border/50"
                                >
                                  <th
                                    scope="row"
                                    className="px-2 py-2 text-start font-normal text-secondary"
                                  >
                                    {t(tab.labelKey)}
                                    {tab.ownerOnly ? (
                                      <Chip tone="teal" className="ms-2">
                                        {t("pages.people.ownerOnly")}
                                      </Chip>
                                    ) : null}
                                  </th>
                                  {LEVELS.map((option) => (
                                    <td
                                      key={option.key}
                                      className="px-2 py-2 text-center"
                                    >
                                      <label
                                        className="inline-flex cursor-pointer items-center justify-center"
                                        title={t(option.path)}
                                      >
                                        <input
                                          type="radio"
                                          name={`level-${tab.key}`}
                                          className="size-4 accent-primary-ink"
                                          checked={level === option.key}
                                          disabled={locked}
                                          onChange={() => {
                                            setDraft((currentDraft) => ({
                                              ...currentDraft,
                                              [tab.key]: option.key,
                                            }));
                                            setDirty(true);
                                          }}
                                          aria-label={`${t(tab.labelKey)} — ${t(option.path)}`}
                                        />
                                      </label>
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => void saveRole()}
                    disabled={saving || !dirty}
                    title={
                      dirty
                        ? undefined
                        : t("pages.people.noChangesToSave")
                    }
                  >
                    {saving ? (
                      <LoaderCircle
                        aria-hidden="true"
                        className="size-4 animate-spin"
                      />
                    ) : dirty ? null : null}
                    {tp("pages.people.saveRole", {
                      role: roleLabelFor(t, current.key, current.label),
                    })}
                  </Button>
                  {dirty ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDraft({ ...current.levels });
                        setDirty(false);
                      }}
                    >
                      <X aria-hidden="true" className="size-4" />
                      {t("pages.people.discard")}
                    </Button>
                  ) : null}
                </div>

                <p className="text-body-sm text-muted-text">
                  {tp("pages.people.derivedPermissions", {
                    count: current.permissions.length,
                    permissions:
                      current.permissions.join(", ") ||
                      t("pages.people.noPermissions"),
                  })}
                </p>
              </>
            )
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
