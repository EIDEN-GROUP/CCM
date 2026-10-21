import { getJobHandlers } from "@/lib/jobs/handlers";
import { SYNC_JOB_KINDS, isSyncJobKind } from "@/lib/jobs/kinds";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The job kinds.
 *
 * A kind that is enqueued but is not in the database's enum fails at the
 * database with "invalid input value for enum sync_job_kind" — a message
 * that says nothing about what to do. These tests make that impossible.
 */
describe("the job kinds", () => {
  it("every kind has a handler", () => {
    const handlers = getJobHandlers();
    const missing = SYNC_JOB_KINDS.filter((kind) => !handlers[kind]);
    expect(missing, "these kinds have no handler").toEqual([]);
  });

  it("every handler is a known kind", () => {
    const handlers = getJobHandlers();
    const unknown = Object.keys(handlers).filter(
      (kind) => !isSyncJobKind(kind),
    );
    expect(unknown, "these handlers have no kind in the enum").toEqual([]);
  });

  it("the enum in the database has every kind", () => {
    const migration = readFileSync(
      "supabase/migrations/20260101000015_sync_job_kinds.sql",
      "utf8",
    );
    const repair = readFileSync("supabase/repair.sql", "utf8");

    for (const kind of SYNC_JOB_KINDS) {
      expect(migration, `the migration is missing ${kind}`).toContain(
        `'${kind}'`,
      );
      expect(repair, `the repair is missing ${kind}`).toContain(`'${kind}'`);
    }
  });

  it("the repair's enum and the migration's enum agree", () => {
    const migration = readFileSync(
      "supabase/migrations/20260101000015_sync_job_kinds.sql",
      "utf8",
    );
    const repair = readFileSync("supabase/repair.sql", "utf8");

    const kindsIn = (text: string) =>
      [...text.matchAll(/'([a-z0-9]+\.[a-z0-9_]+)'/g)].map((match) => match[1]!);

    const fromMigration = new Set(kindsIn(migration));
    const fromRepair = new Set(kindsIn(repair));

    for (const kind of SYNC_JOB_KINDS) {
      expect(fromMigration.has(kind)).toBe(true);
      expect(fromRepair.has(kind)).toBe(true);
    }
  });
});
