"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  Inbox,
  LoaderCircle,
  MailOpen,
  RefreshCw,
  Search,
  Send,
  Star,
  TriangleAlert,
  X,
} from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Chip } from "@/components/ui/chip";
import { EmptyState, InlineSpinner } from "@/components/ui/states";
import { Notice } from "@/components/ui/notice";
import { cn } from "@/lib/cn";

/**
 * The mailbox browser.
 *
 * What it does:
 *   - searches the mailbox through the provider's own search syntax,
 *   - pages through the results with the provider's cursor,
 *   - opens a thread and reads the message bodies **on demand**,
 *   - prepares a message as a draft and requires an explicit confirmation
 *     before anything is sent.
 *
 * What it deliberately does not do: cache message bodies, offer an
 * unattended send, or claim that a message was sent before the provider
 * confirmed it.
 */

export interface MailboxSummary {
  id: string;
  email: string;
  displayLabel: string;
  status: string;
}

interface ThreadSummary {
  id: string;
  subject: string | null;
  snippet: string | null;
  messageCount: number;
  participantCount: number;
  isUnread: boolean;
  isStarred: boolean;
  lastMessageAt: string | null;
  participants: string[];
}

interface MailMessage {
  id: string;
  threadId: string;
  from: string | null;
  fromName: string | null;
  to: string[];
  subject: string | null;
  date: string | null;
  snippet: string | null;
  isUnread: boolean;
  isStarred: boolean;
  isDraft: boolean;
  hasAttachments: boolean;
  body: string | null;
}

interface PreparedSend {
  confirmation: string;
  draftId: string;
  from: string;
  fromLabel: string;
  to: string[];
  cc: string[];
  subject: string;
  expiresInSeconds: number;
}

/** The mailbox sections, in the order Gmail shows them. */
const LABELS = [
  { key: "inbox", label: "pages.inbox.inbox" },
  { key: "unread", label: "pages.inbox.unread" },
  { key: "starred", label: "pages.inbox.starred" },
  { key: "drafts", label: "pages.inbox.drafts" },
  { key: "sent", label: "pages.inbox.sent" },
] as const;

/**
 * Fill a translated template with React nodes.
 *
 * The catalogue holds the sentence; the values — the sending identity, the
 * subject — stay React nodes so they keep the emphasis the screen gives
 * them.
 */
function fill(template: string, parts: Record<string, ReactNode>): ReactNode[] {
  return template.split(/(\{\w+\})/g).map((chunk, index) => {
    const name = /^\{(\w+)\}$/.exec(chunk)?.[1];
    const content = name ? (parts[name] ?? chunk) : chunk;
    return <Fragment key={index}>{content}</Fragment>;
  });
}

export function MailboxBrowser({
  mailboxes,
  canSend,
}: {
  mailboxes: MailboxSummary[];
  canSend: boolean;
}) {
  const { t, tp, intlLocale, dir } = useI18n();
  const [mailboxId, setMailboxId] = useState(mailboxes[0]?.id ?? "");
  const [label, setLabel] = useState<(typeof LABELS)[number]["key"]>("inbox");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [page, setPage] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openThread, setOpenThread] = useState<ThreadSummary | null>(null);
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);

  const [composing, setComposing] = useState(false);
  const [replyTo, setReplyTo] = useState<ThreadSummary | null>(null);
  const [prepared, setPrepared] = useState<PreparedSend | null>(null);
  const [sending, setSending] = useState(false);
  const [sentNotice, setSentNotice] = useState<string | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The section tabs. Only the one on screen is in the tab order; the
  // arrow keys move the focus from one to the next.
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // --- Listing --------------------------------------------------------------

  /**
   * The request, with no state changes in it.
   *
   * Keeping the fetch separate from the state update is what lets the
   * effect below settle the results in a promise callback rather than
   * setting state while the effect is still running.
   */
  const fetchThreads = useCallback(
    async (
      nextPage: number,
      cursor: string | null,
    ): Promise<{
      threads: ThreadSummary[];
      nextCursor: string | null;
      resultSizeEstimate: number | null;
    } | null> => {
      if (!mailboxId) return null;

      const params = new URLSearchParams({
        mailboxId,
        label,
        pageSize: "25",
      });
      if (query) params.set("q", query);
      if (cursor) params.set("cursor", cursor);

      const response = await fetch(`/api/mailbox/threads?${params.toString()}`);
      const body = (await response.json().catch(() => null)) as {
        threads?: ThreadSummary[];
        nextCursor?: string | null;
        resultSizeEstimate?: number | null;
        error?: string;
      } | null;

      if (!response.ok || !body) {
        throw new Error(
          body?.error ??
            tp("pages.inbox.requestFailed", { status: response.status }),
        );
      }

      return {
        threads: body.threads ?? [],
        nextCursor: body.nextCursor ?? null,
        resultSizeEstimate: body.resultSizeEstimate ?? null,
      };
    },
    [mailboxId, label, query, tp],
  );

  /** Load a page and put it on screen. Used by the buttons. */
  const load = useCallback(
    async (nextPage: number, cursor: string | null, reset = false) => {
      setLoading(true);
      setError(null);

      // A new mailbox, section or search starts again at the first page.
      if (reset) setCursors([null]);

      try {
        const result = await fetchThreads(nextPage, cursor);
        if (!result) return;
        setThreads(result.threads);
        setNextCursor(result.nextCursor);
        setEstimate(result.resultSizeEstimate);
        setPage(nextPage);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : t("pages.inbox.serverUnreachable"),
        );
      } finally {
        setLoading(false);
      }
    },
    [fetchThreads, t],
  );

  useEffect(() => {
    let cancelled = false;

    void fetchThreads(0, null)
      .then((result) => {
        if (cancelled || !result) return;
        setCursors([null]);
        setThreads(result.threads);
        setNextCursor(result.nextCursor);
        setEstimate(result.resultSizeEstimate);
        setPage(0);
      })
      .catch((requestError: unknown) => {
        if (cancelled) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : t("pages.inbox.serverUnreachable"),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchThreads, t]);

  // The search box is debounced, so a long query is not a request per key.
  function onSearchChange(value: string) {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setLoading(true);
      setQuery(value.trim());
    }, 400);
  }

  // --- Reading --------------------------------------------------------------

  async function openThreadDetail(thread: ThreadSummary) {
    setOpenThread(thread);
    setLoadingThread(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        mailboxId,
        bodies: "1",
      });
      const response = await fetch(
        `/api/mailbox/threads/${encodeURIComponent(thread.id)}?${params.toString()}`,
      );
      const body = (await response.json().catch(() => null)) as {
        messages?: MailMessage[];
        error?: string;
      } | null;

      if (!response.ok || !body) {
        setError(
          body?.error ?? tp("pages.inbox.requestFailed", { status: response.status }),
        );
        setMessages([]);
        return;
      }

      setMessages(body.messages ?? []);
    } catch {
      setError(t("pages.inbox.serverUnreachable"));
      setMessages([]);
    } finally {
      setLoadingThread(false);
    }
  }

  /**
   * Move between the sections with the arrow keys.
   *
   * The tab strip is a single stop in the tab order, so the arrow keys
   * carry the focus from one section to the next and the section that
   * takes the focus is the one that is then on screen. The direction
   * follows the writing direction, so the keys do the same thing in
   * Arabic as they do in English.
   */
  function onTabKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    const last = LABELS.length - 1;
    const forward = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
    const backward = dir === "rtl" ? "ArrowRight" : "ArrowLeft";

    let next: number | null = null;
    if (event.key === forward) {
      next = index === last ? 0 : index + 1;
    } else if (event.key === backward) {
      next = index === 0 ? last : index - 1;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = last;
    }

    if (next === null) return;

    const target = LABELS[next];
    if (!target) return;

    event.preventDefault();
    setLoading(true);
    setLabel(target.key);
    tabRefs.current[next]?.focus();
  }

  async function toggleStar(message: MailMessage) {
    setError(null);

    try {
      const params = new URLSearchParams({ mailboxId });
      const response = await fetch(
        `/api/mailbox/messages/${encodeURIComponent(message.id)}?${params.toString()}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ starred: !message.isStarred }),
        },
      );

      // The star is only flipped once the provider has accepted it.
      if (!response.ok) {
        setError(
          tp("pages.inbox.starFailed", { status: response.status }),
        );
        return;
      }

      setMessages((current) =>
        current.map((item) =>
          item.id === message.id
            ? { ...item, isStarred: !item.isStarred }
            : item,
        ),
      );
    } catch {
      setError(t("pages.inbox.serverUnreachable"));
    }
  }

  // --- Composing ------------------------------------------------------------

  function startCompose() {
    setComposing(true);
    setReplyTo(null);
    setPrepared(null);
    setSentNotice(null);
  }

  function startReply(thread: ThreadSummary) {
    setComposing(true);
    setReplyTo(thread);
    setPrepared(null);
    setSentNotice(null);
  }

  async function prepareSend(form: FormData) {
    setSending(true);
    setError(null);
    setPrepared(null);

    try {
      const response = await fetch("/api/mailbox/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mailboxId,
          to: String(form.get("to") ?? "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          cc: String(form.get("cc") ?? "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          subject: String(form.get("subject") ?? ""),
          body: String(form.get("body") ?? ""),
          threadId: replyTo?.id ?? undefined,
        }),
      });

      const body = (await response.json().catch(() => null)) as
        | (PreparedSend & { error?: string })
        | null;

      if (!response.ok || !body) {
        setError(
          body?.error ?? tp("pages.inbox.requestFailed", { status: response.status }),
        );
        return;
      }

      setPrepared(body);
    } catch {
      setError(t("pages.inbox.serverUnreachable"));
    } finally {
      setSending(false);
    }
  }

  async function confirmSend() {
    if (!prepared) return;

    setSending(true);
    setError(null);

    try {
      const response = await fetch("/api/mailbox/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: prepared.confirmation }),
      });

      const body = (await response.json().catch(() => null)) as {
        ok?: boolean;
        subject?: string;
        to?: string[];
        error?: string;
      } | null;

      if (!response.ok || !body?.ok) {
        setError(
          body?.error ?? tp("pages.inbox.sendFailed", { status: response.status }),
        );
        return;
      }

      setSentNotice(
        tp("pages.inbox.sentNotice", {
          to: (body.to ?? []).join(", "),
          subject: body.subject ?? "",
        }),
      );
      setComposing(false);
      setPrepared(null);
      setOpenThread(null);
      setMessages([]);
      void load(page, cursors[page] ?? null);
    } catch {
      setError(t("pages.inbox.serverUnreachable"));
    } finally {
      setSending(false);
    }
  }

  // --- Render ---------------------------------------------------------------

  if (mailboxes.length === 0) {
    return (
      <EmptyState
        title={t("pages.inbox.noMailboxTitle")}
        description={t("pages.inbox.noMailboxClientDescription")}
        icon={<Inbox aria-hidden="true" className="size-5" />}
      />
    );
  }

  return (
    <div className="space-y-4">
      {sentNotice ? (
        <Notice tone="success" title={t("pages.inbox.messageSentTitle")}>
          {sentNotice}
        </Notice>
      ) : null}

      {error ? (
        <Notice tone="danger" title={t("pages.inbox.requestFailedTitle")}>
          {error}
        </Notice>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <label
            htmlFor="mailbox-select"
            className="mb-1 block text-label-md font-semibold text-secondary"
          >
            {t("pages.inbox.mailbox")}
          </label>
          <select
            id="mailbox-select"
            value={mailboxId}
            onChange={(event) => {
              setLoading(true);
              setMailboxId(event.target.value);
              setOpenThread(null);
              setMessages([]);
            }}
            className="h-[42px] w-full rounded-md border border-border bg-surface px-3 text-body-md text-secondary focus:border-primary focus:outline-2 focus:outline-primary-ink/40"
          >
            {mailboxes.map((mailbox) => (
              <option key={mailbox.id} value={mailbox.id}>
                {mailbox.displayLabel} — {mailbox.email}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[240px] flex-[2]">
          <label
            htmlFor="mailbox-search"
            className="mb-1 block text-label-md font-semibold text-secondary"
          >
            {t("common.search")}
          </label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-text"
            />
            <Input
              id="mailbox-search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={t("pages.inbox.searchPlaceholder")}
              className="ps-9"
            />
          </div>
        </div>

        <Button
          variant="ghost"
          size="md"
          onClick={() => void load(page, cursors[page] ?? null)}
          disabled={loading}
          title={t("common.refresh")}
        >
          {loading ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <RefreshCw aria-hidden="true" className="size-4" />
          )}
          <span className="sr-only">{t("common.refresh")}</span>
        </Button>

        {canSend ? (
          <Button variant="primary" size="md" onClick={startCompose}>
            <Send aria-hidden="true" className="size-4" />
            {t("pages.inbox.compose")}
          </Button>
        ) : null}
      </div>

      {/*
        The section tabs.

        A complete tab set: the tabs name the panel they control, the
        panel names the tab that is on it, and the arrow keys move between
        them. Only the section on screen is in the tab order, so the strip
        costs one keystroke rather than five.
      */}
      <div
        role="tablist"
        aria-label={t("pages.inbox.sectionsLabel")}
        className="flex flex-wrap gap-2"
      >
        {LABELS.map((entry, index) => (
          <button
            key={entry.key}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            id={`mailbox-tab-${entry.key}`}
            role="tab"
            type="button"
            aria-selected={label === entry.key}
            aria-controls="mailbox-tabpanel"
            tabIndex={label === entry.key ? 0 : -1}
            onKeyDown={(event) => onTabKeyDown(event, index)}
            onClick={() => {
              setLoading(true);
              setLabel(entry.key);
            }}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-label-md font-semibold transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink",
              label === entry.key
                ? "border-primary/40 bg-pale text-primary-ink"
                : "border-border bg-surface text-muted-text hover:bg-surface-muted",
            )}
          >
            {t(entry.label)}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        {/* The list */}
        <div
          id="mailbox-tabpanel"
          role="tabpanel"
          aria-labelledby={`mailbox-tab-${label}`}
          className="rounded-lg border border-border bg-surface"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-label-lg font-semibold text-secondary">
              {t(LABELS.find((entry) => entry.key === label)?.label ?? "pages.inbox.inbox")}
            </h3>
            {loading ? <InlineSpinner /> : null}
          </div>

          {threads.length === 0 && !loading ? (
            <EmptyState
              title={t("pages.inbox.nothingHereTitle")}
              description={
                query
                  ? t("pages.inbox.noSearchMatchDescription")
                  : t("pages.inbox.sectionEmptyDescription")
              }
              icon={<MailOpen aria-hidden="true" className="size-5" />}
              className="border-0"
            />
          ) : (
            <ul className="divide-y divide-border/70">
              {threads.map((thread) => (
                <li key={thread.id}>
                  <button
                    type="button"
                    onClick={() => void openThreadDetail(thread)}
                    className={cn(
                      "w-full px-4 py-3 text-start transition-colors hover:bg-surface-muted",
                      openThread?.id === thread.id && "bg-pale",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {thread.isUnread ? (
                        <span
                          aria-label={t("pages.inbox.unread")}
                          className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                        />
                      ) : (
                        <span aria-hidden="true" className="mt-1.5 size-2 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "truncate text-body-md",
                            thread.isUnread
                              ? "font-bold text-tertiary"
                              : "font-semibold text-secondary",
                          )}
                        >
                          {thread.subject ?? t("pages.inbox.noSubject")}
                        </p>
                        <p className="truncate text-body-sm text-muted-text">
                          {thread.participants.slice(0, 2).join(", ") || "—"}
                        </p>
                        {thread.snippet ? (
                          <p className="mt-0.5 line-clamp-2 text-body-sm text-muted-text">
                            {thread.snippet}
                          </p>
                        ) : null}
                      </div>
                      {thread.isStarred ? (
                        <Star
                          aria-hidden="true"
                          className="mt-1 size-4 shrink-0 fill-warning text-warning-ink"
                        />
                      ) : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {threads.length > 0 ? (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <Button
                variant="ghost"
                size="sm"
                disabled={page === 0 || loading}
                onClick={() => {
                  const previous = Math.max(0, page - 1);
                  void load(previous, cursors[previous] ?? null);
                }}
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                {t("common.previous")}
              </Button>
              <span className="text-body-sm text-muted-text">
                {tp("pages.inbox.pageNumber", { page: page + 1 })}
                {estimate !== null
                  ? tp("pages.inbox.totalEstimate", { count: estimate })
                  : ""}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={!nextCursor || loading}
                onClick={() => {
                  const next = page + 1;
                  setCursors((current) => {
                    const copy = [...current];
                    copy[next] = nextCursor;
                    return copy;
                  });
                  void load(next, nextCursor);
                }}
              >
                {t("common.next")}
              </Button>
            </div>
          ) : null}
        </div>

        {/* The thread */}
        <div className="rounded-lg border border-border bg-surface">
          {composing ? (
            <div className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-label-lg font-semibold text-secondary">
                  {replyTo ? t("pages.inbox.reply") : t("pages.inbox.newMessage")}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setComposing(false);
                    setPrepared(null);
                  }}
                >
                  <X aria-hidden="true" className="size-4" />
                  <span className="sr-only">{t("common.close")}</span>
                </Button>
              </div>

              {prepared ? (
                <div className="space-y-3">
                  <Notice tone="warning" title={t("pages.inbox.confirmBeforeSendingTitle")}>
                    <p>
                      {fill(t("pages.inbox.confirmSendSummary"), {
                        from: (
                          <strong className="font-semibold">{prepared.from}</strong>
                        ),
                        label: prepared.fromLabel,
                        to: (
                          <strong className="font-semibold">
                            {prepared.to.join(", ")}
                          </strong>
                        ),
                        cc:
                          prepared.cc.length > 0
                            ? tp("pages.inbox.confirmSendCc", {
                                cc: prepared.cc.join(", "),
                              })
                            : "",
                        subject: (
                          <strong className="font-semibold">
                            “{prepared.subject}”
                          </strong>
                        ),
                      })}
                    </p>
                    <p className="mt-2">
                      {tp("pages.inbox.draftExpiry", {
                        seconds: prepared.expiresInSeconds,
                      })}
                    </p>
                  </Notice>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => void confirmSend()}
                      disabled={sending}
                    >
                      {sending ? (
                        <LoaderCircle
                          aria-hidden="true"
                          className="size-4 animate-spin"
                        />
                      ) : (
                        <Send aria-hidden="true" className="size-4" />
                      )}
                      {t("pages.inbox.confirmAndSend")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="md"
                      onClick={() => setPrepared(null)}
                      disabled={sending}
                    >
                      {t("pages.inbox.editInstead")}
                    </Button>
                  </div>
                </div>
              ) : (
                <form
                  action={(formData) => void prepareSend(formData)}
                  className="space-y-3"
                >
                  <div>
                    <label
                      htmlFor="compose-to"
                      className="mb-1 block text-label-md font-semibold text-secondary"
                    >
                      {t("pages.inbox.to")}
                    </label>
                    <Input
                      id="compose-to"
                      name="to"
                      type="email"
                      required
                      defaultValue={replyTo?.participants[0] ?? ""}
                      placeholder="name@example.ma"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="compose-cc"
                      className="mb-1 block text-label-md font-semibold text-secondary"
                    >
                      {t("pages.inbox.cc")}
                    </label>
                    <Input
                      id="compose-cc"
                      name="cc"
                      type="email"
                      placeholder={t("pages.inbox.optional")}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="compose-subject"
                      className="mb-1 block text-label-md font-semibold text-secondary"
                    >
                      {t("pages.inbox.subject")}
                    </label>
                    <Input
                      id="compose-subject"
                      name="subject"
                      required
                      defaultValue={
                        replyTo?.subject
                          ? `Re: ${replyTo.subject.replace(/^Re:\s*/, "")}`
                          : ""
                      }
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="compose-body"
                      className="mb-1 block text-label-md font-semibold text-secondary"
                    >
                      {t("pages.inbox.message")}
                    </label>
                    <Textarea
                      id="compose-body"
                      name="body"
                      required
                      rows={8}
                    />
                  </div>
                  <Button type="submit" variant="primary" size="md" disabled={sending}>
                    {sending ? (
                      <LoaderCircle
                        aria-hidden="true"
                        className="size-4 animate-spin"
                      />
                    ) : null}
                    {t("pages.inbox.prepareToSend")}
                  </Button>
                </form>
              )}
            </div>
          ) : openThread ? (
            <div>
              <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
                <div className="min-w-0">
                  <h3 className="truncate text-label-lg font-semibold text-secondary">
                    {openThread.subject ?? t("pages.inbox.noSubject")}
                  </h3>
                  <p className="text-body-sm text-muted-text">
                    {openThread.participants.join(", ")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {canSend ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startReply(openThread)}
                    >
                      <Send aria-hidden="true" className="size-4" />
                      {t("pages.inbox.reply")}
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setOpenThread(null);
                      setMessages([]);
                    }}
                  >
                    <X aria-hidden="true" className="size-4" />
                    <span className="sr-only">{t("pages.inbox.closeThread")}</span>
                  </Button>
                </div>
              </div>

              {loadingThread ? (
                <div className="px-4 py-6">
                  <InlineSpinner />
                </div>
              ) : messages.length === 0 ? (
                <EmptyState
                  title={t("pages.inbox.nothingToReadTitle")}
                  description={t("pages.inbox.nothingToReadDescription")}
                  className="border-0"
                />
              ) : (
                <ul className="divide-y divide-border/70">
                  {messages.map((message) => (
                    <li key={message.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-body-md font-semibold text-tertiary">
                            {message.fromName ?? message.from ?? t("pages.inbox.unknownSender")}
                          </p>
                          <p className="truncate text-body-sm text-muted-text">
                            {message.from ?? ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {message.date ? (
                            <span className="text-body-sm text-muted-text">
                              {new Date(message.date).toLocaleString(intlLocale)}
                            </span>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => void toggleStar(message)}
                            aria-label={
                              message.isStarred
                                ? t("pages.inbox.removeStar")
                                : t("pages.inbox.starMessage")
                            }
                            className="rounded p-1 text-muted-text transition-colors hover:bg-surface-muted hover:text-warning-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink"
                          >
                            <Star
                              aria-hidden="true"
                              className={cn(
                                "size-4",
                                message.isStarred && "fill-warning text-warning-ink",
                              )}
                            />
                          </button>
                        </div>
                      </div>

                      {message.body ? (
                        <p className="mt-2 whitespace-pre-wrap text-body-md text-secondary">
                          {message.body}
                        </p>
                      ) : (
                        <p className="mt-2 flex items-center gap-2 text-body-sm text-muted-text">
                          <TriangleAlert
                            aria-hidden="true"
                            className="size-4 shrink-0"
                          />
                          {t("pages.inbox.bodyUnreadable")}
                        </p>
                      )}

                      {message.hasAttachments ? (
                        <p className="mt-2">
                          <Chip tone="neutral">{t("pages.inbox.hasAttachments")}</Chip>
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <EmptyState
              title={t("pages.inbox.selectConversationTitle")}
              description={t("pages.inbox.selectConversationDescription")}
              icon={<MailOpen aria-hidden="true" className="size-5" />}
              className="border-0"
            />
          )}
        </div>
      </div>
    </div>
  );
}
