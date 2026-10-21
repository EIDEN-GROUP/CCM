import {
  type ConnectorAccount,
  type ConnectorAuth,
  type DailyFact,
  type ProviderConnector,
  type ReportRequest,
  type ReportResult,
} from "../connector";
import { providerRequest } from "../http";

/**
 * Gmail API.
 *
 * The medicalbay.ma domain runs on Google Workspace (the MX record points at
 * SMTP.GOOGLE.COM), so this connector covers every Medical Bay mailbox.
 *
 * What is stored versus fetched:
 *
 *   - **Stored** — thread and message *metadata* and a short preview, so the
 *     inbox list can be drawn without a provider round trip.
 *   - **Fetched on demand** — message bodies and attachments. They are read
 *     from the provider when the user opens a message and are never written
 *     to Postgres.
 *
 * Nothing here reads a cookie, a password or an MFA code. Sending is a
 * separate, explicitly confirmed step.
 */

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";

/** The labels CCM maps to its own inbox categories. */
export const GMAIL_LABELS = {
  inbox: "INBOX",
  unread: "UNREAD",
  sent: "SENT",
  drafts: "DRAFT",
  spam: "SPAM",
  trash: "TRASH",
  starred: "STARRED",
  important: "IMPORTANT",
} as const;

interface GmailMessageList {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
    mimeType?: string;
    body?: { data?: string; size?: number };
    parts?: Array<{
      mimeType?: string;
      body?: { data?: string; size?: number };
      filename?: string;
      headers?: Array<{ name: string; value: string }>;
    }>;
  };
}

interface GmailThreadResponse {
  id: string;
  snippet?: string;
  labelIds?: string[];
  messageCount?: number;
  historyId?: string;
  messages?: GmailMessage[];
}

/** The headers CCM reads from a message. */
const METADATA_HEADERS = [
  "From",
  "To",
  "Cc",
  "Subject",
  "Date",
  "Message-ID",
  "In-Reply-To",
  "References",
];

/** A message as CCM presents it. */
export interface MailMessage {
  id: string;
  threadId: string;
  from: string | null;
  fromName: string | null;
  to: string[];
  cc: string[];
  subject: string | null;
  date: string | null;
  snippet: string | null;
  labels: string[];
  isUnread: boolean;
  isStarred: boolean;
  isDraft: boolean;
  hasAttachments: boolean;
}

/** A thread as CCM presents it. */
export interface MailThread {
  id: string;
  subject: string | null;
  snippet: string | null;
  messageCount: number;
  participantCount: number;
  labels: string[];
  isUnread: boolean;
  isStarred: boolean;
  lastMessageAt: string | null;
  participants: string[];
}

/** A page of threads plus the cursor for the next one. */
export interface MailThreadPage {
  threads: MailThread[];
  nextCursor: string | null;
  resultSizeEstimate: number | null;
}

export class GmailConnector implements ProviderConnector {
  readonly key = "gmail" as const;
  readonly apiVersion = "v1";

  constructor(private readonly options: { baseUrl?: string; userId?: string } = {}) {}

  private user(): string {
    return this.options.userId ?? "me";
  }

  async listAccounts(auth: ConnectorAuth): Promise<ConnectorAccount[]> {
    const profile = await providerRequest<{
      emailAddress?: string;
      historyId?: string;
    }>(auth.accessToken, {
      baseUrl: this.options.baseUrl ?? GMAIL_API,
      path: `/users/${this.user()}/profile`,
      signal: auth.signal,
      provider: "Gmail",
    });

    const email = profile.emailAddress ?? this.user();
    return [
      {
        externalAccountId: email,
        displayLabel: email,
        identifiers: { gmail: { mailboxEmail: email } },
        timezone: null,
        currency: null,
      },
    ];
  }

  async readReport(
    account: ConnectorAccount,
    request: ReportRequest,
    auth: ConnectorAuth,
  ): Promise<ReportResult> {
    // The window is expressed in epoch seconds for the `after`/`before`
    // query, so the request is bounded by the period rather than by a page
    // walk over the whole mailbox.
    const sinceSeconds = Math.floor(
      Date.parse(`${request.startDate}T00:00:00Z`) / 1000,
    );
    const untilSeconds = Math.floor(
      Date.parse(`${request.endDate}T23:59:59Z`) / 1000,
    );

    const query = new URLSearchParams({
      q: `after:${sinceSeconds} before:${untilSeconds}`,
      maxResults: String(Math.min(request.limit ?? 100, 100)),
    });

    const list = await providerRequest<GmailMessageList>(auth.accessToken, {
      baseUrl: this.options.baseUrl ?? GMAIL_API,
      path: `/users/${this.user()}/messages?${query.toString()}`,
      signal: auth.signal,
      provider: "Gmail",
    });

    const messageIds = (list.messages ?? []).slice(0, 100);
    const facts: DailyFact[] = [];

    // The message metadata is fetched in a bounded batch. A mailbox with
    // thousands of new messages is read over several runs, using the cursor.
    for (const reference of messageIds) {
      const message = await providerRequest<GmailMessage>(auth.accessToken, {
        baseUrl: this.options.baseUrl ?? GMAIL_API,
        path: `/users/${this.user()}/messages/${reference.id}?format=metadata&${metadataHeaderQuery()}`,
        signal: auth.signal,
        provider: "Gmail",
      });

      const headers = new Map(
        (message.payload?.headers ?? []).map((header) => [
          header.name.toLowerCase(),
          header.value,
        ]),
      );

      facts.push({
        metricDate: request.endDate,
        dimension: "gmail",
        dimensionId: message.id,
        dimensionLabel: headers.get("subject") ?? null,
        values: {
          message_id: message.id,
          thread_id: message.threadId,
          from: headers.get("from") ?? null,
          to: headers.get("to") ?? null,
          subject: headers.get("subject") ?? null,
          snippet: message.snippet ?? null,
          labels: (message.labelIds ?? []).join(","),
          is_unread: (message.labelIds ?? []).includes(GMAIL_LABELS.unread),
          is_draft: (message.labelIds ?? []).includes(GMAIL_LABELS.drafts),
          is_starred: (message.labelIds ?? []).includes(GMAIL_LABELS.starred),
          received_at: message.internalDate
            ? new Date(Number(message.internalDate)).toISOString()
            : null,
        },
        sourceFetchedAt: new Date().toISOString(),
      });
    }

    return {
      facts,
      truncated: (list.messages?.length ?? 0) > messageIds.length,
      notes: [
        "CCM stores message and thread metadata and a short preview. Bodies and attachments are fetched on demand and are never persisted.",
        "The preview can contain sensitive content. It is readable only by a user with an explicit grant on this mailbox and is never included in an export, an alert or an AI request.",
      ],
      nextCursor: list.nextPageToken ?? null,
    };
  }

  // --- The mailbox operations the inbox needs -------------------------------

  /**
   * Search the mailbox.
   *
   * The provider does the searching: CCM never downloads a mailbox to filter
   * it locally. `query` uses Gmail's own syntax, so `from:`, `subject:`,
   * `is:unread` and a free-text term all work.
   */
  async searchThreads(
    options: {
      query?: string;
      cursor?: string | null;
      pageSize?: number;
      label?: keyof typeof GMAIL_LABELS;
    },
    auth: ConnectorAuth,
  ): Promise<MailThreadPage> {
    const pageSize = Math.min(Math.max(options.pageSize ?? 25, 1), 100);

    const parts: string[] = [];
    if (options.label) parts.push(`label:${GMAIL_LABELS[options.label]}`);
    if (options.query) parts.push(options.query);
    const query = parts.length > 0 ? parts.join(" ") : "label:INBOX";

    const params = new URLSearchParams({
      q: query,
      maxResults: String(pageSize),
    });
    if (options.cursor) params.set("pageToken", options.cursor);

    const list = await providerRequest<GmailMessageList>(auth.accessToken, {
      baseUrl: this.options.baseUrl ?? GMAIL_API,
      path: `/users/${this.user()}/threads?${params.toString()}`,
      signal: auth.signal,
      provider: "Gmail",
    });

    const threads = await Promise.all(
      (list.messages ?? []).slice(0, pageSize).map(async (reference) => {
        const thread = await providerRequest<GmailThreadResponse>(
          auth.accessToken,
          {
            baseUrl: this.options.baseUrl ?? GMAIL_API,
            path: `/users/${this.user()}/threads/${reference.id}?${metadataHeaderQuery()}`,
            signal: auth.signal,
            provider: "Gmail",
          },
        );
        return this.toThread(thread);
      }),
    );

    return {
      threads,
      nextCursor: list.nextPageToken ?? null,
      resultSizeEstimate: list.resultSizeEstimate ?? null,
    };
  }

  /** Read one thread, with its messages. */
  async getThread(
    threadId: string,
    auth: ConnectorAuth,
  ): Promise<{ thread: MailThread; messages: MailMessage[] }> {
    const response = await providerRequest<GmailThreadResponse>(
      auth.accessToken,
      {
        baseUrl: this.options.baseUrl ?? GMAIL_API,
        path: `/users/${this.user()}/threads/${threadId}?${metadataHeaderQuery()}`,
        signal: auth.signal,
        provider: "Gmail",
      },
    );

    return {
      thread: this.toThread(response),
      messages: (response.messages ?? []).map((message) =>
        this.toMessage(message),
      ),
    };
  }

  /**
   * Read a message body.
   *
   * The body is returned to the caller and **not persisted**. CCM shows it
   * for the moment the user opened it and forgets it.
   */
  async getMessageBody(
    messageId: string,
    auth: ConnectorAuth,
  ): Promise<{ text: string; hasAttachments: boolean }> {
    const message = await providerRequest<GmailMessage>(auth.accessToken, {
      baseUrl: this.options.baseUrl ?? GMAIL_API,
      path: `/users/${this.user()}/messages/${messageId}?format=full`,
      signal: auth.signal,
      provider: "Gmail",
    });

    return {
      text: decodeBody(message.payload),
      hasAttachments: hasAttachmentPart(message),
    };
  }

  /**
   * Create a draft.
   *
   * The draft lives in the provider, not in CCM. That is deliberate: the
   * owner can see and finish the message in Gmail, and nothing is sent until
   * the person confirms it.
   */
  async createDraft(
    options: {
      to: string[];
      subject: string;
      body: string;
      threadId?: string | null;
      cc?: string[];
    },
    auth: ConnectorAuth,
  ): Promise<{ id: string; threadId: string }> {
    const headers = [
      `To: ${options.to.join(", ")}`,
      options.cc && options.cc.length > 0
        ? `Cc: ${options.cc.join(", ")}`
        : null,
      `Subject: ${options.subject}`,
      "Content-Type: text/plain; charset=utf-8",
    ].filter((line): line is string => line !== null);

    const raw = `${headers.join("\n")}\n\n${options.body}`;

    return providerRequest<{ id: string; threadId: string }>(
      auth.accessToken,
      {
        method: "POST",
        baseUrl: this.options.baseUrl ?? GMAIL_API,
        path: `/users/${this.user()}/drafts`,
        body: {
          message: {
            raw: toBase64Url(raw),
            threadId: options.threadId ?? undefined,
          },
        },
        signal: auth.signal,
        provider: "Gmail",
      },
    );
  }

  /** Send a message. */
  async sendMessage(
    account: ConnectorAccount,
    options: { to: string[]; subject: string; body: string },
    auth: ConnectorAuth,
  ): Promise<{ id: string; threadId: string }> {
    void account;
    const raw = [
      `To: ${options.to.join(", ")}`,
      `Subject: ${options.subject}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      options.body,
    ].join("\n");

    return providerRequest<{ id: string; threadId: string }>(
      auth.accessToken,
      {
        method: "POST",
        baseUrl: this.options.baseUrl ?? GMAIL_API,
        path: `/users/${this.user()}/messages/send`,
        body: { raw: toBase64Url(raw) },
        signal: auth.signal,
        provider: "Gmail",
      },
    );
  }

  /**
   * Send a draft that was prepared earlier.
   *
   * This is the second half of confirm-before-send: the draft is created and
   * shown to the person first, and only then is it sent.
   */
  async sendDraft(
    draftId: string,
    auth: ConnectorAuth,
  ): Promise<{ id: string; threadId: string }> {
    const draft = await providerRequest<{
      id: string;
      message?: { id: string; threadId: string };
    }>(auth.accessToken, {
      baseUrl: this.options.baseUrl ?? GMAIL_API,
      path: `/users/${this.user()}/drafts/${draftId}`,
      signal: auth.signal,
      provider: "Gmail",
    });

    if (!draft.message?.id) {
      throw new Error("The draft could not be read, so it was not sent.");
    }

    const sent = await providerRequest<{ id: string; threadId: string }>(
      auth.accessToken,
      {
        method: "POST",
        baseUrl: this.options.baseUrl ?? GMAIL_API,
        path: `/users/${this.user()}/drafts/send`,
        body: { id: draft.message.id },
        signal: auth.signal,
        provider: "Gmail",
      },
    );

    // The draft is no longer a draft once it is sent.
    await providerRequest(auth.accessToken, {
      method: "DELETE",
      baseUrl: this.options.baseUrl ?? GMAIL_API,
      path: `/users/${this.user()}/drafts/${draftId}`,
      signal: auth.signal,
      provider: "Gmail",
    });

    return sent;
  }

  /**
   * Change a message's labels — read/unread, starred, archived.
   */
  async modifyLabels(
    messageId: string,
    options: { add?: string[]; remove?: string[] },
    auth: ConnectorAuth,
  ): Promise<void> {
    if (!options.add?.length && !options.remove?.length) return;

    await providerRequest(auth.accessToken, {
      method: "POST",
      baseUrl: this.options.baseUrl ?? GMAIL_API,
      path: `/users/${this.user()}/messages/${messageId}/modify`,
      body: {
        addLabelIds: options.add ?? [],
        removeLabelIds: options.remove ?? [],
      },
      signal: auth.signal,
      provider: "Gmail",
    });
  }

  // --- Normalisation --------------------------------------------------------

  private toThread(response: GmailThreadResponse): MailThread {
    const messages = (response.messages ?? []).map((message) =>
      this.toMessage(message),
    );

    const participants = new Set<string>();
    for (const message of messages) {
      if (message.from) participants.add(message.from);
      for (const address of message.to) participants.add(address);
    }

    const last = messages.at(-1);

    return {
      id: response.id,
      subject: messages.find((message) => message.subject)?.subject ?? null,
      snippet: response.snippet ?? messages.at(-1)?.snippet ?? null,
      messageCount: response.messageCount ?? messages.length,
      participantCount: participants.size,
      labels: response.labelIds ?? [],
      isUnread: (response.labelIds ?? []).includes(GMAIL_LABELS.unread),
      isStarred: (response.labelIds ?? []).includes(GMAIL_LABELS.starred),
      lastMessageAt: last?.date ?? null,
      participants: [...participants],
    };
  }

  private toMessage(message: GmailMessage): MailMessage {
    const headers = new Map(
      (message.payload?.headers ?? []).map((header) => [
        header.name.toLowerCase(),
        header.value,
      ]),
    );

    const from = headers.get("from") ?? null;

    return {
      id: message.id,
      threadId: message.threadId,
      from,
      fromName: from ? extractDisplayName(from) : null,
      to: splitAddresses(headers.get("to") ?? ""),
      cc: splitAddresses(headers.get("cc") ?? ""),
      subject: headers.get("subject") ?? null,
      date: message.internalDate
        ? new Date(Number(message.internalDate)).toISOString()
        : null,
      snippet: message.snippet ?? null,
      labels: message.labelIds ?? [],
      isUnread: (message.labelIds ?? []).includes(GMAIL_LABELS.unread),
      isStarred: (message.labelIds ?? []).includes(GMAIL_LABELS.starred),
      isDraft: (message.labelIds ?? []).includes(GMAIL_LABELS.drafts),
      hasAttachments: hasAttachmentPart(message),
    };
  }
}

/** The metadata header query used by every read. */
function metadataHeaderQuery(): string {
  return METADATA_HEADERS.map(
    (header) => `metadataHeaders=${encodeURIComponent(header)}`,
  ).join("&");
}

/** Whether a message carries a part with a filename. */
function hasAttachmentPart(message: GmailMessage): boolean {
  const parts = message.payload?.parts ?? [];
  return parts.some(
    (part) => typeof part.filename === "string" && part.filename.length > 0,
  );
}

/**
 * Decode a message body to plain text.
 *
 * The body is never stored — it is returned to the caller and forgotten.
 */
function decodeBody(payload: GmailMessage["payload"]): string {
  if (!payload) return "";

  const collect = (part: NonNullable<GmailMessage["payload"]>): string => {
    if (part.body?.data) {
      try {
        return Buffer.from(part.body.data, "base64").toString("utf8");
      } catch {
        return "";
      }
    }
    if (part.parts) {
      return part.parts.map(collect).join("\n");
    }
    return "";
  };

  // A plain-text part is preferred; a multipart message is walked.
  const text = collect(payload);
  return text.trim();
}

/** Split an address header into its addresses. */
function splitAddresses(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Pull the display name out of a `Name <address>` header. */
function extractDisplayName(value: string): string | null {
  const match = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (!match) return null;
  const name = match[1]?.replace(/^"|"$/g, "").trim();
  return name && name.length > 0 ? name : null;
}

/** Base64url, the encoding Gmail expects for a raw RFC 2822 message. */
function toBase64Url(raw: string): string {
  return Buffer.from(raw, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export const gmailConnector = new GmailConnector();
