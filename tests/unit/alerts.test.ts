import { describe, expect, it } from "vitest";
import {
  computeBaseline,
  escalateSeverity,
  evaluateRule,
  relativeChange,
  type AlertRule,
  type MetricReading,
} from "@/domain/alerts";

const baseRule: AlertRule = {
  id: "rule-1",
  workspaceId: "workspace-1",
  metric: "ads_spend",
  direction: "increase",
  threshold: 0.25,
  severity: "warning",
  minVolume: 100,
  hysteresisWindows: 2,
  graceWindows: 3,
  minRepeatHours: 24,
  enabled: true,
};

function history(values: Array<number | null>): MetricReading[] {
  return values.map((value, index) => ({
    day: `2026-03-${String(index + 1).padStart(2, "0")}`,
    value,
  }));
}

describe("baseline", () => {
  it("excludes the latest reading from the baseline", () => {
    const result = computeBaseline(history([100, 100, 100, 500]));
    expect(result).toBe(100);
  });

  it("uses a median so one spike does not raise the bar", () => {
    const result = computeBaseline(history([100, 100, 100, 100, 10_000, 100]));
    expect(result).toBe(100);
  });

  it("returns null when there is no history", () => {
    expect(computeBaseline([])).toBeNull();
    expect(computeBaseline(history([null]))).toBeNull();
  });
});

describe("relative change", () => {
  it("computes the movement against the baseline", () => {
    expect(relativeChange(125, 100)).toBeCloseTo(0.25);
  });

  it("returns null when the baseline is zero", () => {
    expect(relativeChange(125, 0)).toBeNull();
  });
});

describe("rule evaluation", () => {
  it("does not fire while the rule is still collecting a baseline", () => {
    const decision = evaluateRule({
      rule: baseRule,
      history: history([100, 100]),
    });
    expect(decision.action).toBe("none");
    expect(decision.reason).toMatch(/baseline/i);
  });

  it("fires when the metric breaches the threshold", () => {
    const decision = evaluateRule({
      rule: baseRule,
      history: history([100, 100, 100, 200]),
    });
    expect(decision.action).toBe("raise");
    if (decision.action === "raise") {
      expect(decision.observed).toBe(200);
      expect(decision.baseline).toBe(100);
      expect(decision.reason).toMatch(/above baseline/i);
    }
  });

  it("does not fire below the minimum volume", () => {
    const decision = evaluateRule({
      rule: { ...baseRule, minVolume: 1000 },
      history: history([10, 10, 10, 200]),
    });
    expect(decision.action).toBe("none");
    expect(decision.reason).toMatch(/minimum volume/i);
  });

  it("does not fire when the latest reading is unavailable", () => {
    const decision = evaluateRule({
      rule: baseRule,
      history: history([100, 100, 100, null]),
    });
    expect(decision.action).toBe("none");
    expect(decision.reason).toMatch(/unavailable/i);
  });

  it("does not fire on a decrease when the rule watches for increases", () => {
    const decision = evaluateRule({
      rule: baseRule,
      history: history([100, 100, 100, 20]),
    });
    expect(decision.action).toBe("none");
  });

  it("fires on a decrease when the rule watches for decreases", () => {
    const decision = evaluateRule({
      rule: { ...baseRule, direction: "decrease" },
      history: history([1000, 1000, 1000, 200]),
    });
    expect(decision.action).toBe("raise");
    if (decision.action === "raise") {
      expect(decision.reason).toMatch(/below baseline/i);
    }
  });

  it("stays quiet during a quiet period", () => {
    const decision = evaluateRule({
      rule: {
        ...baseRule,
        quietHours: { startUtcHour: 22, endUtcHour: 7 },
      },
      history: history([100, 100, 100, 200]),
      utcHour: 23,
    });
    expect(decision.action).toBe("none");
    expect(decision.reason).toMatch(/quiet period/i);
  });

  it("suppresses a repeat that arrives too soon", () => {
    const decision = evaluateRule({
      rule: baseRule,
      history: history([100, 100, 100, 200]),
      hoursSinceLastAlert: 2,
    });
    expect(decision.action).toBe("none");
    expect(decision.reason).toMatch(/repeat suppressed/i);
  });

  it("allows a repeat once the repeat interval has passed", () => {
    const decision = evaluateRule({
      rule: baseRule,
      history: history([100, 100, 100, 200]),
      hoursSinceLastAlert: 30,
    });
    expect(decision.action).toBe("raise");
  });

  it("auto-resolves only after the hysteresis window has passed", () => {
    const oneClear = evaluateRule({
      rule: baseRule,
      history: history([100, 100, 100, 105]),
      consecutiveClears: 1,
    });
    expect(oneClear.action).toBe("none");

    const enoughClears = evaluateRule({
      rule: baseRule,
      history: history([100, 100, 100, 105]),
      consecutiveClears: baseRule.hysteresisWindows,
    });
    expect(enoughClears.action).toBe("auto_resolve");
  });

  it("does not fire when the rule is disabled", () => {
    const decision = evaluateRule({
      rule: { ...baseRule, enabled: false },
      history: history([100, 100, 100, 200]),
    });
    expect(decision.action).toBe("none");
    expect(decision.reason).toMatch(/disabled/i);
  });

  it("does not fire when the baseline is zero, because the change is undefined", () => {
    const decision = evaluateRule({
      rule: { ...baseRule, minVolume: 0 },
      history: history([0, 0, 0, 50]),
    });
    expect(decision.action).toBe("none");
    expect(decision.reason).toMatch(/baseline is zero/i);
  });
});

describe("severity escalation", () => {
  it("escalates a warning to critical for a large move", () => {
    expect(escalateSeverity("warning", 0.8)).toBe("critical");
  });

  it("keeps a warning for a moderate move", () => {
    expect(escalateSeverity("warning", 0.3)).toBe("warning");
  });

  it("escalates info to warning for a large move", () => {
    expect(escalateSeverity("info", 0.6)).toBe("warning");
  });
});
