import { describe, expect, it } from "vitest";
import { computeBackoffSeconds, outcomeForFailure, shouldRetry } from "@/lib/jobs/queue";
import { ConnectorError } from "@/providers/connector";

/**
 * Sync queue behaviour.
 *
 * The backoff and retry policy is what keeps a provider outage from turning
 * into a retry storm, and what keeps an auth failure from retrying forever.
 */

function job(overrides: Partial<Parameters<typeof shouldRetry>[0]> = {}) {
  return {
    id: "job-1",
    workspace_id: "ws-1",
    connection_id: null,
    account_id: null,
    kind: "ga4.sessions",
    status: "running" as const,
    dedupe_key: "key",
    payload: {},
    run_after: new Date().toISOString(),
    attempts: 1,
    max_attempts: 5,
    locked_until: null,
    lease_owner: null,
    last_error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("backoff", () => {
  it("grows exponentially with the attempt number", () => {
    const first = computeBackoffSeconds(1, { baseSeconds: 60, jitterRatio: 0 });
    const second = computeBackoffSeconds(2, { baseSeconds: 60, jitterRatio: 0 });
    const third = computeBackoffSeconds(3, { baseSeconds: 60, jitterRatio: 0 });

    expect(first).toBe(60);
    expect(second).toBe(120);
    expect(third).toBe(240);
  });

  it("is capped at the maximum", () => {
    expect(
      computeBackoffSeconds(20, { baseSeconds: 60, maxSeconds: 3600, jitterRatio: 0 }),
    ).toBe(3600);
  });

  it("applies jitter so retries do not all fire at once", () => {
    const samples = new Set(
      Array.from({ length: 20 }, () =>
        computeBackoffSeconds(3, { baseSeconds: 60, jitterRatio: 0.25 }),
      ),
    );
    expect(samples.size).toBeGreaterThan(1);
  });

  it("never returns less than one second", () => {
    expect(computeBackoffSeconds(0, { baseSeconds: 0 })).toBeGreaterThanOrEqual(1);
  });
});

describe("retry policy", () => {
  it("retries a transient failure", () => {
    expect(shouldRetry(job({ attempts: 1, last_error: "rate_limited" }))).toBe(
      true,
    );
  });

  it("stops retrying once the attempt budget is spent", () => {
    expect(shouldRetry(job({ attempts: 5, max_attempts: 5 }))).toBe(false);
  });

  it("does not retry an auth failure, because a human has to reconnect", () => {
    expect(
      shouldRetry(job({ attempts: 1, last_error: "auth_failed" })),
    ).toBe(false);
    expect(
      shouldRetry(job({ attempts: 1, last_error: "permission_denied" })),
    ).toBe(false);
  });
});

describe("failure outcomes", () => {
  it("requeues a retryable failure with a backoff", () => {
    const outcome = outcomeForFailure(
      job({ attempts: 2 }),
      ConnectorError.rateLimited("slow down", 30),
    );

    expect(outcome.status).toBe("queued");
    expect(outcome.deadLetter).toBe(false);
    expect(outcome.retryable).toBe(true);
    expect(outcome.runAfter).not.toBeNull();
    expect(outcome.errorCode).toBe("rate_limited");
  });

  it("dead-letters a failure that has exhausted its attempts", () => {
    const outcome = outcomeForFailure(
      job({ attempts: 5, max_attempts: 5 }),
      ConnectorError.unavailable("provider is down"),
    );

    expect(outcome.status).toBe("failed");
    expect(outcome.deadLetter).toBe(true);
    expect(outcome.runAfter).toBeNull();
  });

  it("fails an auth error without retrying it", () => {
    const outcome = outcomeForFailure(
      job({ attempts: 1 }),
      ConnectorError.auth("token rejected"),
    );

    expect(outcome.status).toBe("failed");
    expect(outcome.deadLetter).toBe(false);
    expect(outcome.retryable).toBe(false);
  });

  it("treats an unknown error as retryable", () => {
    const outcome = outcomeForFailure(job({ attempts: 1 }), new Error("boom"));

    expect(outcome.retryable).toBe(true);
    expect(outcome.errorCode).toBe("unknown_error");
  });
});
