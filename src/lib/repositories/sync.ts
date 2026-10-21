import type { Db } from "@/lib/repositories/types";

/**
 * Sync checkpoints.
 *
 * A cursor records how far a stream has been read, so a retried or resumed
 * job continues rather than starting over. Cursors are per connection and
 * per stream, so two accounts never share a checkpoint.
 */

export interface Cursor {
  stream: string;
  cursorValue: string | null;
  checkpoint: Record<string, unknown>;
}

export async function readCursor(
  db: Db,
  connectionId: string,
  stream: string,
): Promise<Cursor | null> {
  const { data, error } = await db
    .from("sync_cursors")
    .select("stream, cursor_value, checkpoint")
    .eq("connection_id", connectionId)
    .eq("stream", stream)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not read the sync cursor: ${error.message}`);
  }
  if (!data) return null;

  return {
    stream: data.stream,
    cursorValue: data.cursor_value,
    checkpoint: (data.checkpoint ?? {}) as Record<string, unknown>,
  };
}

export async function writeCursor(
  db: Db,
  cursor: {
    workspaceId: string;
    connectionId: string;
    accountId?: string | null;
    stream: string;
    value?: string | null;
    checkpoint?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await db.from("sync_cursors").upsert(
    {
      workspace_id: cursor.workspaceId,
      connection_id: cursor.connectionId,
      account_id: cursor.accountId ?? null,
      stream: cursor.stream,
      cursor_value: cursor.value ?? null,
      checkpoint: cursor.checkpoint ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "connection_id,stream" },
  );

  if (error) {
    console.error("could not write the sync cursor", error.message);
  }
}
