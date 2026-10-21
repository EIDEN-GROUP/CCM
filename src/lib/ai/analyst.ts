import type { Db } from "@/lib/repositories/types";
import { serverEnv } from "@/lib/env";

/**
 * The grounded AI analyst.
 *
 * The contract, which the product holds the model to:
 *
 *   - Answers come only from records CCM has already synced. The model is
 *     given the facts, not the database.
 *   - Every answer cites the records behind it, and CCM stores that list so
 *     the trail is inspectable.
 *   - Missing data is reported as missing. A blank is never a zero and a
 *     gap is never filled in.
 *   - Mailbox content, credentials and patient data are never included in
 *     the prompt. Only aggregate metric facts are.
 *   - The model may propose a task. It cannot send, publish, spend or
 *     delete: those actions are not in its reach.
 */

export interface AnalystSource {
  sourceType: string;
  sourceRef: string;
  label: string;
  periodStart: string | null;
  periodEnd: string | null;
  fetchedAt: string | null;
  excerpt: string | null;
}

export interface AnalystCaveat {
  kind: "freshness" | "definition" | "missing" | "scope";
  message: string;
}

export interface AnalystResult {
  answer: string;
  sources: AnalystSource[];
  caveats: AnalystCaveat[];
  model: string;
  /** True when there was not enough synced data to answer. */
  grounded: boolean;
}

const SYSTEM_INSTRUCTION = `You are the CCM analyst for Medical Bay, a medical-tourism marketing command centre.

You answer questions about marketing performance using ONLY the facts supplied to you. You never guess, extrapolate, or fill in a gap. If a figure is not in the supplied facts, say that it is not available and say why (not synced yet, not reported by the provider, or outside the selected period).

Rules:
- Use only the supplied facts. Do not use prior knowledge about the business.
- State the period and the source for every figure you mention.
- Distinguish clearly between what the data shows and what you infer. Label inferences as such.
- Keep marketing data in marketing terms. Never speculate about a visitor's health, treatment or medical condition.
- Be concise and specific. Lead with the answer, then the supporting figures.
- If the facts are insufficient, say so plainly and name the records that would be needed.`;

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

/**
 * Read the facts the analyst is allowed to see.
 */
export async function buildGroundContext(
  db: Db,
  workspaceId: string,
  range: { start: string; end: string },
): Promise<{
  facts: string[];
  sources: AnalystSource[];
  caveats: AnalystCaveat[];
  hasData: boolean;
}> {
  const facts: string[] = [];
  const sources: AnalystSource[] = [];
  const caveats: AnalystCaveat[] = [];

  const [ads, ga4, gsc, definitions] = await Promise.all([
    db
      .from("daily_ads_metrics")
      .select(
        "metric_date, dimension, dimension_label, impressions, clicks, cost_micros, conversions, conversion_value_micros, currency, source_fetched_at",
      )
      .eq("workspace_id", workspaceId)
      .gte("metric_date", range.start)
      .lte("metric_date", range.end)
      .order("metric_date", { ascending: true })
      .limit(2000),
    db
      .from("daily_ga4_metrics")
      .select(
        "metric_date, dimension, dimension_label, sessions, active_users, engaged_sessions, key_events, currency, source_fetched_at",
      )
      .eq("workspace_id", workspaceId)
      .gte("metric_date", range.start)
      .lte("metric_date", range.end)
      .order("metric_date", { ascending: true })
      .limit(2000),
    db
      .from("daily_gsc_metrics")
      .select(
        "metric_date, dimension, dimension_label, clicks, impressions, ctr, position, country, device, source_fetched_at",
      )
      .eq("workspace_id", workspaceId)
      .gte("metric_date", range.start)
      .lte("metric_date", range.end)
      .order("metric_date", { ascending: true })
      .limit(2000),
    db
      .from("metric_definitions")
      .select("key, display_name, definition, formula, caveats, freshness_target_seconds"),
  ]);

  const adsRows = (ads.data ?? []) as Array<Record<string, unknown>>;
  const ga4Rows = (ga4.data ?? []) as Array<Record<string, unknown>>;
  const gscRows = (gsc.data ?? []) as Array<Record<string, unknown>>;
  const definitionRows = (definitions.data ?? []) as Array<
    Record<string, unknown>
  >;

  // --- Metric definitions ---------------------------------------------------
  for (const definition of definitionRows) {
    const caveatsForMetric = (definition.caveats as string[] | null) ?? [];
    if (caveatsForMetric.length > 0) {
      caveats.push({
        kind: "definition",
        message: `${definition.display_name}: ${caveatsForMetric.join(" ")}`,
      });
    }
  }

  // --- Ads ------------------------------------------------------------------
  if (adsRows.length > 0) {
    const totals = adsRows.reduce<{
      impressions: number;
      clicks: number;
      costMicros: number;
      conversions: number;
      valueMicros: number;
    }>(
      (accumulator, row) => ({
        impressions: accumulator.impressions + Number(row.impressions ?? 0),
        clicks: accumulator.clicks + Number(row.clicks ?? 0),
        costMicros: accumulator.costMicros + Number(row.cost_micros ?? 0),
        conversions: accumulator.conversions + Number(row.conversions ?? 0),
        valueMicros:
          accumulator.valueMicros + Number(row.conversion_value_micros ?? 0),
      }),
      {
        impressions: 0,
        clicks: 0,
        costMicros: 0,
        conversions: 0,
        valueMicros: 0,
      },
    );

    const currency = String(adsRows[0]?.currency ?? "MAD");
    const cost = totals.costMicros / 1_000_000;
    const value = totals.valueMicros / 1_000_000;

    facts.push(
      `Google Ads, ${range.start} to ${range.end}: spend ${cost.toFixed(2)} ${currency}, impressions ${totals.impressions}, clicks ${totals.clicks}, conversions ${totals.conversions}, conversion value ${value.toFixed(2)} ${currency}.`,
    );
    facts.push(
      totals.conversions > 0
        ? `Google Ads derived: CTR ${((totals.clicks / Math.max(1, totals.impressions)) * 100).toFixed(2)}%, average CPC ${(cost / Math.max(1, totals.clicks)).toFixed(2)} ${currency}, cost per conversion ${(cost / totals.conversions).toFixed(2)} ${currency}${totals.valueMicros > 0 ? `, ROAS ${(value / Math.max(0.000001, cost)).toFixed(2)}x` : ""}.`
        : "Google Ads derived: no conversions were reported in this period, so CPA and ROAS are unavailable rather than zero.",
    );

    const byCampaign = new Map<string, { label: string; cost: number; clicks: number; conversions: number }>();
    for (const row of adsRows) {
      const id = String(row.dimension_id ?? row.dimension_label ?? "unknown");
      const entry = byCampaign.get(id) ?? {
        label: String(row.dimension_label ?? id),
        cost: 0,
        clicks: 0,
        conversions: 0,
      };
      entry.cost += Number(row.cost_micros ?? 0) / 1_000_000;
      entry.clicks += Number(row.clicks ?? 0);
      entry.conversions += Number(row.conversions ?? 0);
      byCampaign.set(id, entry);
    }

    const topCampaigns = [...byCampaign.entries()]
      .sort(([, a], [, b]) => b.cost - a.cost)
      .slice(0, 5);

    for (const [id, entry] of topCampaigns) {
      facts.push(
        `Campaign "${entry.label}": spend ${entry.cost.toFixed(2)} ${currency}, clicks ${entry.clicks}, conversions ${entry.conversions}.`,
      );
      sources.push({
        sourceType: "metric",
        sourceRef: `daily_ads_metrics:campaign:${id}`,
        label: `Google Ads campaign — ${entry.label}`,
        periodStart: range.start,
        periodEnd: range.end,
        fetchedAt: String(adsRows[0]?.source_fetched_at ?? ""),
        excerpt: `spend=${entry.cost.toFixed(2)} ${currency} clicks=${entry.clicks} conversions=${entry.conversions}`,
      });
    }

    sources.push({
      sourceType: "metric",
      sourceRef: "daily_ads_metrics:totals",
      label: "Google Ads — period totals",
      periodStart: range.start,
      periodEnd: range.end,
      fetchedAt: String(adsRows[0]?.source_fetched_at ?? ""),
      excerpt: `spend=${cost.toFixed(2)} ${currency} clicks=${totals.clicks} conversions=${totals.conversions}`,
    });
  }

  // --- GA4 ------------------------------------------------------------------
  if (ga4Rows.length > 0) {
    const totals = ga4Rows.reduce<{
      sessions: number;
      activeUsers: number;
      engaged: number;
      keyEvents: number;
    }>(
      (accumulator, row) => ({
        sessions: accumulator.sessions + Number(row.sessions ?? 0),
        activeUsers: accumulator.activeUsers + Number(row.active_users ?? 0),
        engaged: accumulator.engaged + Number(row.engaged_sessions ?? 0),
        keyEvents: accumulator.keyEvents + Number(row.key_events ?? 0),
      }),
      { sessions: 0, activeUsers: 0, engaged: 0, keyEvents: 0 },
    );

    facts.push(
      `GA4, ${range.start} to ${range.end}: sessions ${totals.sessions}, active users ${totals.activeUsers}, engaged sessions ${totals.engaged}, key events ${totals.keyEvents}.`,
    );

    if (totals.sessions > 0) {
      facts.push(
        `GA4 derived: key event rate ${((totals.keyEvents / totals.sessions) * 100).toFixed(2)}% of sessions.`,
      );
    }

    sources.push({
      sourceType: "metric",
      sourceRef: "daily_ga4_metrics:totals",
      label: "GA4 — period totals",
      periodStart: range.start,
      periodEnd: range.end,
      fetchedAt: String(ga4Rows[0]?.source_fetched_at ?? ""),
      excerpt: `sessions=${totals.sessions} keyEvents=${totals.keyEvents}`,
    });
  }

  // --- Search Console -------------------------------------------------------
  if (gscRows.length > 0) {
    const totals = gscRows.reduce<{
      clicks: number;
      impressions: number;
      weightedPosition: number;
    }>(
      (accumulator, row) => ({
        clicks: accumulator.clicks + Number(row.clicks ?? 0),
        impressions: accumulator.impressions + Number(row.impressions ?? 0),
        weightedPosition:
          accumulator.weightedPosition +
          Number(row.position ?? 0) * Number(row.impressions ?? 0),
      }),
      { clicks: 0, impressions: 0, weightedPosition: 0 },
    );

    const position =
      totals.impressions > 0
        ? totals.weightedPosition / totals.impressions
        : null;

    facts.push(
      `Google Search Console, ${range.start} to ${range.end}: clicks ${totals.clicks}, impressions ${totals.impressions}${position !== null ? `, impression-weighted average position ${position.toFixed(1)}` : ""}.`,
    );
    facts.push(
      "Search Console query data is aggregated by the API. It is not a complete list of every query.",
    );

    sources.push({
      sourceType: "metric",
      sourceRef: "daily_gsc_metrics:totals",
      label: "Google Search Console — period totals",
      periodStart: range.start,
      periodEnd: range.end,
      fetchedAt: String(gscRows[0]?.source_fetched_at ?? ""),
      excerpt: `clicks=${totals.clicks} impressions=${totals.impressions}`,
    });
  }

  const hasData = facts.length > 0;

  if (!hasData) {
    caveats.push({
      kind: "missing",
      message:
        "No metric records have been synced for the selected period, so there is nothing to ground an answer in.",
    });
  }

  return { facts, sources, caveats, hasData };
}

/**
 * Ask the model, grounded in the facts.
 */
export async function askAnalyst(
  question: string,
  context: {
    facts: string[];
    sources: AnalystSource[];
    caveats: AnalystCaveat[];
    hasData: boolean;
  },
  range: { start: string; end: string },
): Promise<AnalystResult> {
  const apiKey = serverEnv.geminiApiKey();
  const model = serverEnv.aiModel() ?? "gemini-2.5-flash";

  if (!apiKey) {
    return {
      answer:
        "The AI analyst is not configured. Set GEMINI_API_KEY to enable it — until then CCM reports what it can verify and nothing it cannot.",
      sources: [],
      caveats: [
        ...context.caveats,
        {
          kind: "scope",
          message: "GEMINI_API_KEY is not set, so no model was called.",
        },
      ],
      model: "none",
      grounded: false,
    };
  }

  if (!context.hasData) {
    return {
      answer:
        "There is no synced data for the selected period, so I cannot answer without inventing figures. Connect a provider and let the first sync complete, then ask again.",
      sources: [],
      caveats: context.caveats,
      model,
      grounded: false,
    };
  }

  const prompt = [
    `Reporting period: ${range.start} to ${range.end}.`,
    "",
    "Facts reported by the connected providers for that period:",
    ...context.facts.map((fact) => `- ${fact}`),
    "",
    "Caveats that must be reflected in the answer:",
    ...(
      context.caveats.length > 0
        ? context.caveats.map((caveat) => `- ${caveat.message}`)
        : ["- None recorded."]
    ),
    "",
    `Question: ${question}`,
  ].join("\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model,
    )}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1200,
        },
      }),
    },
  );

  if (!response.ok) {
    // The provider's body may contain the prompt, so it is not logged.
    await response.text().catch(() => "");
    return {
      answer:
        "The AI analyst could not be reached. The figures on screen are unaffected — they come from the synced records, not from the model.",
      sources: context.sources,
      caveats: [
        ...context.caveats,
        {
          kind: "scope",
          message: `The model request failed (HTTP ${response.status}).`,
        },
      ],
      model,
      grounded: false,
    };
  }

  const payload = (await response.json()) as GeminiResponse;
  const blocked = payload.promptFeedback?.blockReason;
  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();

  if (blocked || !text) {
    return {
      answer:
        "The AI analyst declined to answer this question. The figures on screen are unaffected.",
      sources: context.sources,
      caveats: [
        ...context.caveats,
        {
          kind: "scope",
          message: blocked
            ? `The request was blocked (${blocked}).`
            : "The model returned no answer.",
        },
      ],
      model,
      grounded: false,
    };
  }

  return {
    answer: text,
    sources: context.sources,
    caveats: context.caveats,
    model,
    grounded: true,
  };
}
