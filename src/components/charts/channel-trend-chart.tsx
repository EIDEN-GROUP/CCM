"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useI18n } from "@/components/providers/i18n-provider";
import { formatDay } from "@/domain/dates";
import { formatCount } from "@/domain/metrics";

export interface TrendSeries {
  key: string;
  label: string;
  color: string;
  points: Array<{ day: string; value: number | null }>;
}

/**
 * The cross-channel trend chart.
 *
 * Accessibility: the chart is decorative support for the numbers beside it.
 * It carries `role="img"` and a text alternative that names the series and
 * the range, and the underlying figures are always available in the tables
 * elsewhere on the page.
 */
export function ChannelTrendChart({
  series,
  valueLabel,
}: {
  series: TrendSeries[];
  valueLabel?: string;
}) {
  const { t, tp, intlLocale } = useI18n();

  const label = valueLabel ?? t("pages.overview.clicks");
  const days = series[0]?.points.map((point) => point.day) ?? [];
  const data = days.map((day) => {
    const row: Record<string, string | number | null> = { day };
    for (const item of series) {
      row[item.key] = item.points.find((point) => point.day === day)?.value ?? null;
    }
    return row;
  });

  const firstDay = days[0];
  const lastDay = days[days.length - 1];

  // The alternative names the series the chart actually draws and the
  // window it covers, so a screen reader is told what it is looking at
  // rather than how many lines there are.
  const summary = tp("pages.overview.chartSummarySeries", {
    value: label,
    series: series.map((item) => item.label).join(", "),
    firstDay: firstDay ? formatDay(firstDay, intlLocale) : "",
    lastDay: lastDay ? formatDay(lastDay, intlLocale) : "",
  });

  return (
    <>
      <div
        role="img"
        aria-label={summary}
        className="chart-enter h-[260px] w-full"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <defs>
              {series.map((item) => (
                <linearGradient
                  key={item.key}
                  id={`grad-${item.key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={item.color} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={item.color} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="day"
              tickFormatter={(value: string) =>
                formatDay(value, intlLocale).replace(/ \d{4}$/, "")
              }
              tick={{ fill: "#727984", fontSize: 12 }}
              axisLine={{ stroke: "#e5e7eb" }}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              tick={{ fill: "#727984", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={52}
              tickFormatter={(value: number) =>
                new Intl.NumberFormat(intlLocale, { notation: "compact" }).format(
                  value,
                )
              }
            />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                fontSize: 13,
                fontFamily: "inherit",
              }}
              labelFormatter={(value) => formatDay(String(value), intlLocale)}
            />
            {series.length > 1 ? <Legend wrapperStyle={{ fontSize: 13 }} /> : null}
            {series.map((item) => (
              <Area
                key={item.key}
                type="monotone"
                dataKey={item.key}
                name={item.label}
                stroke={item.color}
                strokeWidth={2}
                fill={`url(#grad-${item.key})`}
                connectNulls={false}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive
                animationDuration={850}
                animationEasing="ease-out"
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/*
        The figures behind the picture.

        A chart is a picture of numbers. The table carries those numbers, so
        they are reachable without seeing the chart at all. It sits beside
        the chart rather than inside it, because the children of an element
        with `role="img"` are not exposed to assistive technology.
      */}
      {days.length > 0 ? (
        <table className="sr-only">
          <caption>{t("pages.overview.chartDataTableCaption")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("common.date")}</th>
              {series.map((item) => (
                <th key={item.key} scope="col">
                  {item.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day}>
                <th scope="row">{formatDay(day, intlLocale)}</th>
                {series.map((item) => (
                  <td key={item.key}>
                    {formatCount(
                      item.points.find((point) => point.day === day)?.value ??
                        null,
                      intlLocale,
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </>
  );
}
