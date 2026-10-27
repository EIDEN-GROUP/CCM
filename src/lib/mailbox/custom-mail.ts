import { ImapFlow, type FetchMessageObject, type SearchObject } from "imapflow";
import PostalMime from "postal-mime";
import nodemailer from "nodemailer";
import { lookup } from "node:dns/promises";

export interface CustomMailSettings {
  email: string;
  imapHost: string;
  imapPort: number;
  imapUsername: string;
  imapPassword: string;
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpPassword: string;
}

/** Reject IP literals and DNS names resolving to loopback, private, or special-use IPv4. */
export async function assertPublicMailHost(host: string): Promise<void> {
  const normalized = host.trim().toLowerCase().replace(/\.$/, "");
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(normalized)) {
    throw new Error("Enter a mail server host name, not an IP address.");
  }
  const records = await lookup(normalized, { all: true, verbatim: true });
  if (!records.length || records.some(({ address }) => !isPublicIpv4(address))) {
    throw new Error("The mail server must resolve only to a public internet address.");
  }
}

function isPublicIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const a = parts[0] ?? -1;
  const b = parts[1] ?? -1;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51) ||
    (a === 203 && b === 0));
}

function imapClient(settings: CustomMailSettings) {
  return new ImapFlow({
    host: settings.imapHost,
    port: settings.imapPort,
    secure: settings.imapPort === 993,
    doSTARTTLS: settings.imapPort === 143,
    auth: { user: settings.imapUsername, pass: settings.imapPassword },
    logger: false,
    connectionTimeout: 12_000,
    greetingTimeout: 8_000,
    socketTimeout: 20_000,
  });
}

async function folderFor(client: ImapFlow, label: string): Promise<string> {
  if (label !== "sent" && label !== "drafts") return "INBOX";
  const expected = label === "sent" ? "\\Sent" : "\\Drafts";
  const folders = await client.list();
  const specialUse = folders.find((folder) => folder.specialUse === expected);
  if (specialUse) return specialUse.path;
  const commonNames = label === "sent"
    ? ["sent", "sent items", "sent messages", "envoyés", "éléments envoyés"]
    : ["drafts", "brouillons"];
  const byName = folders.find((folder) => commonNames.includes(folder.path.toLocaleLowerCase()));
  if (!byName) throw new Error(label === "sent" ? "The sent-mail folder was not found on this server." : "The drafts folder was not found on this server.");
  return byName.path;
}

async function assertMailboxExists(client: ImapFlow, path: string): Promise<void> {
  const folders = await client.list();
  if (!folders.some((folder) => folder.path === path)) throw new Error("This mailbox folder is not available.");
}

function summary(message: FetchMessageObject, folder: string) {
  const to = message.envelope?.to ?? [];
  const flags = message.flags ?? new Set<string>();
  return {
    id: encodeMessageId(folder, message.uid),
    subject: message.envelope?.subject ?? null,
    snippet: null,
    messageCount: 1,
    participantCount: (message.envelope?.from?.length ?? 0) + to.length,
    isUnread: !flags.has("\\Seen"),
    isStarred: flags.has("\\Flagged"),
    lastMessageAt: message.internalDate
      ? new Date(message.internalDate).toISOString()
      : null,
    participants: [...(message.envelope?.from ?? []), ...to].map((person) => person.address ?? person.name ?? "").filter(Boolean),
    folder,
  };
}

function encodeMessageId(folder: string, uid: number): string {
  return `${Buffer.from(folder).toString("base64url")}.${uid}`;
}

function decodeMessageId(value: string): { folder: string; uid: number } {
  const [encodedFolder, encodedUid] = value.split(".", 2);
  const uid = Number(encodedUid);
  let folder = "";
  try { folder = Buffer.from(encodedFolder ?? "", "base64url").toString("utf8"); } catch { /* invalid id */ }
  if (!Number.isSafeInteger(uid) || uid < 1 || !["INBOX", "Sent", "Drafts"].includes(folder)) {
    throw new Error("Invalid message identifier.");
  }
  return { folder, uid };
}

/** Read a bounded page from the selected IMAP folder. Bodies are fetched only when opened. */
export async function searchCustomThreads(
  settings: CustomMailSettings,
  options: { label: string; query?: string; cursor?: string | null; pageSize: number },
) {
  await assertPublicMailHost(settings.imapHost);
  const client = imapClient(settings);
  try {
    await client.connect();
    const folder = await folderFor(client, options.label);
    const lock = await client.getMailboxLock(folder);
    try {
      const criteria: SearchObject = {};
      if (options.label === "unread") criteria.seen = false;
      if (options.label === "starred") criteria.flagged = true;
      if (options.query?.trim()) criteria.text = options.query.trim().slice(0, 200);
      const resultUids = await client.search(criteria, { uid: true });
      const uids = resultUids === false ? [] : resultUids ?? [];
      const matching = [...uids].sort((a, b) => b - a);
      const offset = Math.max(0, Number(options.cursor ?? 0) || 0);
      const pageUids = matching.slice(offset, offset + options.pageSize);
      const rows = pageUids.length ? await client.fetchAll(pageUids, { uid: true, envelope: true, flags: true, internalDate: true }, { uid: true }) : [];
      rows.sort((a, b) => b.uid - a.uid);
      return {
        threads: rows.map((message) => summary(message, folder)),
        nextCursor: offset + pageUids.length < matching.length ? String(offset + pageUids.length) : null,
        resultSizeEstimate: matching.length,
      };
    } finally {
      lock.release();
    }
  } finally {
    if (!client.isClosed) await client.logout().catch(() => undefined);
  }
}

export async function readCustomThread(settings: CustomMailSettings, id: string) {
  const { folder, uid } = decodeMessageId(id);
  await assertPublicMailHost(settings.imapHost);
  const client = imapClient(settings);
  try {
    await client.connect();
    await assertMailboxExists(client, folder);
    const lock = await client.getMailboxLock(folder);
    try {
      const message = await client.fetchOne(uid, { uid: true, envelope: true, flags: true, source: true, internalDate: true }, { uid: true });
      if (!message || !message.source) return { thread: null, messages: [] };
      const parsed = await PostalMime.parse(message.source);
      const from = parsed.from?.address ?? message.envelope?.from?.[0]?.address ?? null;
      const result = {
        id: encodeMessageId(folder, message.uid), threadId: encodeMessageId(folder, message.uid), from,
        fromName: parsed.from?.name ?? message.envelope?.from?.[0]?.name ?? null,
        to: (parsed.to ?? []).map((person) => person.address).filter((value): value is string => Boolean(value)),
        subject: parsed.subject ?? message.envelope?.subject ?? null,
        date: parsed.date ? new Date(parsed.date).toISOString() : (message.internalDate ? new Date(message.internalDate).toISOString() : null),
        snippet: parsed.text?.slice(0, 240) ?? null,
        isUnread: !(message.flags ?? new Set()).has("\\Seen"),
        isStarred: (message.flags ?? new Set()).has("\\Flagged"),
        isDraft: false,
        hasAttachments: (parsed.attachments?.length ?? 0) > 0,
        body: parsed.text ?? stripHtml(parsed.html ?? ""),
      };
      return { thread: { id: encodeMessageId(folder, uid), subject: result.subject, participants: from ? [from] : [], isUnread: result.isUnread, isStarred: result.isStarred }, messages: [result] };
    } finally {
      lock.release();
    }
  } finally {
    if (!client.isClosed) await client.logout().catch(() => undefined);
  }
}

export async function customReplyHeaders(settings: CustomMailSettings, id: string) {
  const { folder, uid } = decodeMessageId(id);
  await assertPublicMailHost(settings.imapHost);
  const client = imapClient(settings);
  try {
    await client.connect();
    await assertMailboxExists(client, folder);
    const lock = await client.getMailboxLock(folder);
    try {
      const message = await client.fetchOne(uid, { uid: true, source: true }, { uid: true });
      if (!message || !message.source) return {};
      const parsed = await PostalMime.parse(message.source);
      const originalId = parsed.messageId ?? undefined;
      const references = [parsed.references, originalId].filter(Boolean).join(" ") || undefined;
      return {
        ...(originalId ? { inReplyTo: originalId } : {}),
        ...(references ? { references } : {}),
      };
    } finally { lock.release(); }
  } finally { if (!client.isClosed) await client.logout().catch(() => undefined); }
}

export async function setCustomStar(settings: CustomMailSettings, id: string, starred: boolean) {
  const { folder, uid } = decodeMessageId(id);
  await assertPublicMailHost(settings.imapHost);
  const client = imapClient(settings);
  try {
    await client.connect();
    await assertMailboxExists(client, folder);
    const lock = await client.getMailboxLock(folder);
    try {
      if (starred) await client.messageFlagsAdd(uid, ["\\Flagged"], { uid: true });
      else await client.messageFlagsRemove(uid, ["\\Flagged"], { uid: true });
    } finally { lock.release(); }
  } finally { if (!client.isClosed) await client.logout().catch(() => undefined); }
}

export async function setCustomRead(settings: CustomMailSettings, id: string, read: boolean) {
  const { folder, uid } = decodeMessageId(id);
  await assertPublicMailHost(settings.imapHost);
  const client = imapClient(settings);
  try {
    await client.connect();
    await assertMailboxExists(client, folder);
    const lock = await client.getMailboxLock(folder);
    try {
      if (read) await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
      else await client.messageFlagsRemove(uid, ["\\Seen"], { uid: true });
    } finally { lock.release(); }
  } finally { if (!client.isClosed) await client.logout().catch(() => undefined); }
}

export async function verifyCustomMail(settings: CustomMailSettings) {
  await Promise.all([assertPublicMailHost(settings.imapHost), assertPublicMailHost(settings.smtpHost)]);
  const client = imapClient(settings);
  try {
    await client.connect();
    await client.logout();
  } finally { if (!client.isClosed) await client.logout().catch(() => undefined); }
  const transport = smtpTransport(settings);
  try { await transport.verify(); } finally { transport.close(); }
}

export async function sendCustomMail(settings: CustomMailSettings, data: {
  to: string[]; cc: string[]; subject: string; body: string;
  inReplyTo?: string;
  references?: string;
}) {
  await assertPublicMailHost(settings.smtpHost);
  const transport = smtpTransport(settings);
  try {
    const sent = await transport.sendMail({
      from: { name: settings.email, address: settings.email },
      to: data.to,
      cc: data.cc,
      subject: data.subject,
      text: data.body,
      ...(data.inReplyTo ? { inReplyTo: data.inReplyTo } : {}),
      ...(data.references ? { references: data.references } : {}),
    });
    // SMTP delivery and saving a Sent copy are separate actions. Save a copy
    // over IMAP when the server exposes a Sent folder; a copy failure must not
    // make the user retry a message that was already accepted by SMTP.
    await appendSentCopy(settings, data, sent.messageId).catch((error: unknown) => {
      console.error("could not save the custom mailbox sent copy", error instanceof Error ? error.message : "unknown error");
    });
    return sent;
  } finally { transport.close(); }
}

async function appendSentCopy(
  settings: CustomMailSettings,
  data: { to: string[]; cc: string[]; subject: string; body: string; inReplyTo?: string; references?: string },
  messageId: string,
): Promise<void> {
  await assertPublicMailHost(settings.imapHost);
  const client = imapClient(settings);
  try {
    await client.connect();
    const folder = await folderFor(client, "sent");
    const now = new Date().toUTCString();
    const body = Buffer.from(data.body, "utf8").toString("base64").match(/.{1,76}/g)?.join("\r\n") ?? "";
    const headers = [
      `From: ${settings.email}`,
      `To: ${data.to.join(", ")}`,
      ...(data.cc.length ? [`Cc: ${data.cc.join(", ")}`] : []),
      `Subject: =?UTF-8?B?${Buffer.from(safeHeader(data.subject), "utf8").toString("base64")}?=`,
      `Date: ${now}`,
      `Message-ID: ${safeHeader(messageId)}`,
      ...(data.inReplyTo ? [`In-Reply-To: ${safeHeader(data.inReplyTo)}`] : []),
      ...(data.references ? [`References: ${safeHeader(data.references)}`] : []),
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      body,
    ].join("\r\n");
    await client.append(folder, headers, ["\\Seen"]);
  } finally { if (!client.isClosed) await client.logout().catch(() => undefined); }
}

function safeHeader(value: string): string {
  return value.replace(/[\r\n\0]+/g, " ").slice(0, 998);
}

function smtpTransport(settings: CustomMailSettings) {
  return nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpPort === 465,
    requireTLS: settings.smtpPort === 587,
    auth: { user: settings.smtpUsername, pass: settings.smtpPassword },
    connectionTimeout: 12_000,
    greetingTimeout: 8_000,
    socketTimeout: 20_000,
  });
}

function stripHtml(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}
