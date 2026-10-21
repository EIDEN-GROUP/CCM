"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

const LABELS = [
  { key: "inbox", label: "Inbox" },
  { key: "unread", label: "Unread" },
  { key: "starred", label: "Starred" },
  { key: "drafts", label: "Drafts" },
  { key: "sent", label: "Sent" },
] as const;

export function MailboxBrowser({
  mailboxes,
  canSend,
}: {
  mailboxes: MailboxSummary[];
  canSend: boolean;
}) {
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
          body?.error ?? `The request failed (HTTP ${response.status}).`,
        );
      }

      return {
        threads: body.threads ?? [],
        nextCursor: body.nextCursor ?? null,
        resultSizeEstimate: body.resultSizeEstimate ?? null,
      };
    },
    [mailboxId, label, query],
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
            : "CCM could not reach the server.",
        );
      } finally {
        setLoading(false);
      }
    },
    [fetchThreads],
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
            : "CCM could not reach the server.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchThreads]);

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
        setError(body?.error ?? `The request failed (HTTP ${response.status}).`);
        setMessages([]);
        return;
      }

      setMessages(body.messages ?? []);
    } catch {
      setError("CCM could not reach the server.");
      setMessages([]);
    } finally {
      setLoadingThread(false);
    }
  }

  async function toggleStar(message: MailMessage) {
    try {
      const params = new URLSearchParams({ mailboxId });
      await fetch(
        `/api/mailbox/messages/${encodeURIComponent(message.id)}?${params.toString()}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ starred: !message.isStarred }),
        },
      );
      setMessages((current) =>
        current.map((item) =>
          item.id === message.id
            ? { ...item, isStarred: !item.isStarred }
            : item,
        ),
      );
    } catch {
      setError("CCM could not reach the server.");
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
        setError(body?.error ?? `The request failed (HTTP ${response.status}).`);
        return;
      }

      setPrepared(body);
    } catch {
      setError("CCM could not reach the server.");
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
        setError(body?.error ?? `The send failed (HTTP ${response.status}).`);
        return;
      }

      setSentNotice(
        `Sent to ${(body.to ?? []).join(", ")} — “${body.subject}”.`,
      );
      setComposing(false);
      setPrepared(null);
      setOpenThread(null);
      setMessages([]);
      void load(page, cursors[page] ?? null);
    } catch {
      setError("CCM could not reach the server.");
    } finally {
      setSending(false);
    }
  }

  // --- Render ---------------------------------------------------------------

  if (mailboxes.length === 0) {
    return (
      <EmptyState
        title="No mailbox connected"
        description="Connect a mailbox with the Gmail API in Integrations to bring the inbox into CCM."
        icon={<Inbox aria-hidden="true" className="size-5" />}
      />
    );
  }

  return (
    <div className="space-y-4">
      {sentNotice ? (
        <Notice tone="success" title="Message sent">
          {sentNotice}
        </Notice>
      ) : null}

      {error ? (
        <Notice tone="danger" title="The mailbox request failed">
          {error}
        </Notice>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <label
            htmlFor="mailbox-select"
            className="mb-1 block text-label-md font-semibold text-secondary"
          >
            Mailbox
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
            Search
          </label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-text"
            />
            <Input
              id="mailbox-search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="from:, subject:, is:unread, or a term"
              className="pl-9"
            />
          </div>
        </div>

        <Button
          variant="ghost"
          size="md"
          onClick={() => void load(page, cursors[page] ?? null)}
          disabled={loading}
          title="Refresh"
        >
          {loading ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <RefreshCw aria-hidden="true" className="size-4" />
          )}
          <span className="sr-only">Refresh</span>
        </Button>

        {canSend ? (
          <Button variant="primary" size="md" onClick={startCompose}>
            <Send aria-hidden="true" className="size-4" />
            Compose
          </Button>
        ) : null}
      </div>

      <div
        role="tablist"
        aria-label="Mailbox sections"
        className="flex flex-wrap gap-2"
      >
        {LABELS.map((entry) => (
          <button
            key={entry.key}
            role="tab"
            type="button"
            aria-selected={label === entry.key}
            onClick={() => {
              setLoading(true);
              setLabel(entry.key);
            }}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-label-md font-semibold transition-colors",
              label === entry.key
                ? "border-primary/40 bg-pale text-primary-ink"
                : "border-border bg-surface text-muted-text hover:bg-surface-muted",
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        {/* The list */}
        <div className="rounded-lg border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-label-lg font-semibold text-secondary">
              {LABELS.find((entry) => entry.key === label)?.label}
            </h3>
            {loading ? <InlineSpinner /> : null}
          </div>

          {threads.length === 0 && !loading ? (
            <EmptyState
              title="Nothing here"
              description={
                query
                  ? "No message matched that search."
                  : "This mailbox section is empty."
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
                          aria-label="Unread"
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
                          {thread.subject ?? "(no subject)"}
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
                Previous
              </Button>
              <span className="text-body-sm text-muted-text">
                Page {page + 1}
                {estimate !== null ? ` · about ${estimate} in total` : ""}
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
                Next
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
                  {replyTo ? "Reply" : "New message"}
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
                  <span className="sr-only">Close</span>
                </Button>
              </div>

              {prepared ? (
                <div className="space-y-3">
                  <Notice tone="warning" title="Confirm before sending">
                    <p>
                      This will send from{" "}
                      <strong className="font-semibold">{prepared.from}</strong>{" "}
                      ({prepared.fromLabel}) to{" "}
                      <strong className="font-semibold">
                        {prepared.to.join(", ")}
                      </strong>
                      {prepared.cc.length > 0
                        ? `, cc ${prepared.cc.join(", ")}`
                        : ""}
                      , with the subject{" "}
                      <strong className="font-semibold">
                        “{prepared.subject}”
                      </strong>
                      .
                    </p>
                    <p className="mt-2">
                      A draft has been saved in the mailbox. It expires in{" "}
                      {prepared.expiresInSeconds} seconds if it is not
                      confirmed.
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
                      Confirm and send
                    </Button>
                    <Button
                      variant="ghost"
                      size="md"
                      onClick={() => setPrepared(null)}
                      disabled={sending}
                    >
                      Edit instead
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
                      To
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
                      Cc
                    </label>
                    <Input
                      id="compose-cc"
                      name="cc"
                      type="email"
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="compose-subject"
                      className="mb-1 block text-label-md font-semibold text-secondary"
                    >
                      Subject
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
                      Message
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
                    Prepare to send
                  </Button>
                </form>
              )}
            </div>
          ) : openThread ? (
            <div>
              <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
                <div className="min-w-0">
                  <h3 className="truncate text-label-lg font-semibold text-secondary">
                    {openThread.subject ?? "(no subject)"}
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
                      Reply
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
                    <span className="sr-only">Close the thread</span>
                  </Button>
                </div>
              </div>

              {loadingThread ? (
                <div className="px-4 py-6">
                  <InlineSpinner />
                </div>
              ) : messages.length === 0 ? (
                <EmptyState
                  title="Nothing to read"
                  description="The provider returned no messages for this thread."
                  className="border-0"
                />
              ) : (
                <ul className="divide-y divide-border/70">
                  {messages.map((message) => (
                    <li key={message.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-body-md font-semibold text-tertiary">
                            {message.fromName ?? message.from ?? "Unknown sender"}
                          </p>
                          <p className="truncate text-body-sm text-muted-text">
                            {message.from ?? ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {message.date ? (
                            <span className="text-body-sm text-muted-text">
                              {new Date(message.date).toLocaleString()}
                            </span>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => void toggleStar(message)}
                            aria-label={
                              message.isStarred
                                ? "Remove the star"
                                : "Star this message"
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
                          The body could not be read from the provider.
                        </p>
                      )}

                      {message.hasAttachments ? (
                        <p className="mt-2">
                          <Chip tone="neutral">Has attachments</Chip>
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <EmptyState
              title="Select a conversation"
              description="Choose a message on the left to read it, or search the mailbox."
              icon={<MailOpen aria-hidden="true" className="size-5" />}
              className="border-0"
            />
          )}
        </div>
      </div>
    </div>
  );
}
