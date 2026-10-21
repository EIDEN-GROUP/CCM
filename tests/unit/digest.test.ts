import { describe, expect, it } from "vitest";
import { digestPeriod } from "@/lib/reports/digest";
import { nextRunFor } from "@/lib/jobs/handlers/reports";
import { enqueueDueDigests } from "@/lib/reports/scheduler";
import type { Db } from "@/lib/repositories/types";

/**
 * The scheduled digest.
 *
 * The period maths and the scheduler are pure enough to test without a
 * database, and they are where a mistake would be silent: a digest covering
 * the wrong window, or a schedule that fires twice, produces a report that
 * looks fine and is wrong.
 */

describe("the digest period", () => {
  it("covers one day for a daily digest", () => {
    const period = digestPeriod("daily", "2026-03-28", "Africa/Casablanca");
    expect(period.start).toBe("2026-03-28");
    expect(period.end).toBe("2026-03-28");
  });

  it("covers seven days for a weekly digest", () => {
    const period = digestPeriod("weekly", "2026-03-28", "Africa/Casablanca");
    expect(period.start).toBe("2026-03-22");
    expect(period.end).toBe("2026-03-28");
  });

  it("covers thirty days for a monthly digest", () => {
    const period = digestPeriod("monthly", "2026-03-28", "Africa/Casablanca");
    expect(period.start).toBe("2026-02-27");
    expect(period.end).toBe("2026-03-28");
  });

  it("falls back to a twenty-eight day window for an on-demand digest", () => {
    const period = digestPeriod("on_demand", "2026-03-28", "Africa/Casablanca");
    expect(period.start).toBe("2026-03-01");
    expect(period.end).toBe("2026-03-28");
  });
});

describe("the next run", () => {
  it("moves a daily digest forward by a day", () => {
    const from = new Date("2026-03-28T00:00:00.000Z");
    expect(nextRunFor("daily", from)).toBe("2026-03-29T00:00:00.000Z");
  });

  it("moves a weekly digest forward by seven days", () => {
    const from = new Date("2026-03-28T00:00:00.000Z");
    expect(nextRunFor("weekly", from)).toBe("2026-04-04T00:00:00.000Z");
  });

  it("does not schedule an on-demand digest", () => {
    expect(nextRunFor("on_demand")).toBeNull();
  });
});

describe("the scheduler", () => {
  /** A database stub that records what the scheduler asked for. */
  function stubDb(
    definitions: Array<Record<string, unknown>>,
  ): Db & { queued: string[]; updated: string[] } {
    const queued: string[] = [];
    const updated: string[] = [];

    const db = {
      from: (table: string) => {
        if (table === "sync_jobs") {
          return {
            upsert: (row: { dedupe_key: string }) => {
              queued.push(row.dedupe_key);
              const chain = {
                select: () => chain,
                maybeSingle: () =>
                  Promise.resolve({
                    data: { id: `job-${queued.length}` },
                    error: null,
                  }),
              };
              return chain;
            },
          };
        }

        if (table === "report_definitions") {
          const chain = {
            select: () => chain,
            eq: () => chain,
            update: () => {
              updated.push(table);
              const updateChain = {
                eq: () => updateChain,
                then: (
                  resolve: (value: unknown) => unknown,
                ): Promise<unknown> =>
                  Promise.resolve({ data: null, error: null }).then(resolve),
              };
              return updateChain;
            },
            then: (
              resolve: (value: unknown) => unknown,
            ): Promise<unknown> =>
              Promise.resolve({ data: definitions, error: null }).then(resolve),
          };
          return chain;
        }

        return {
          update: () => {
            updated.push(table);
            return Promise.resolve({ data: null, error: null });
          },
          upsert: () => Promise.resolve({ data: null, error: null }),
        };
      },
    } as unknown as Db & { queued: string[]; updated: string[] };

    (db as unknown as { queued: string[] }).queued = queued;
    (db as unknown as { updated: string[] }).updated = updated;

    return db;
  }

  it("queues a digest that has never run", async () => {
    const db = stubDb([
      {
        id: "d1",
        workspace_id: "w1",
        key: "daily-performance",
        title: "Daily",
        cadence: "daily",
        enabled: true,
        next_run_at: null,
        last_run_at: null,
      },
    ]);

    const result = await enqueueDueDigests(db);

    expect(result.queued).toBe(1);
    expect(db.queued[0]).toContain("reports.generate:d1");
  });

  it("does not queue a digest that is not due yet", async () => {
    const db = stubDb([
      {
        id: "d1",
        workspace_id: "w1",
        key: "daily-performance",
        title: "Daily",
        cadence: "daily",
        enabled: true,
        next_run_at: "2099-01-01T00:00:00.000Z",
        last_run_at: "2026-03-28T00:00:00.000Z",
      },
    ]);

    const result = await enqueueDueDigests(db);

    expect(result.queued).toBe(0);
    expect(result.skipped[0]?.reason).toBe("not_due");
  });

  it("does not schedule an on-demand digest", async () => {
    const db = stubDb([
      {
        id: "d1",
        workspace_id: "w1",
        key: "on-demand",
        title: "On demand",
        cadence: "on_demand",
        enabled: true,
        next_run_at: null,
        last_run_at: null,
      },
    ]);

    const result = await enqueueDueDigests(db);

    expect(result.queued).toBe(0);
    expect(result.skipped[0]?.reason).toBe("on_demand");
  });
});
