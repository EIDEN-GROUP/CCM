"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useI18n } from "@/components/providers/i18n-provider";

export interface CampaignSpendPoint {
  name: string;
  spend: number;
}

export function TopCampaignsChart({
  data,
  label,
}: {
  data: CampaignSpendPoint[];
  label: string;
}) {
  const { intlLocale } = useI18n();
  const currency = new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency: "MAD",
    maximumFractionDigits: 0,
  });

  return (
    <div role="img" aria-label={label} className="chart-enter h-[180px] w-full px-3 pt-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 2, right: 12, bottom: 2, left: 0 }}
          barCategoryGap={10}
        >
          <CartesianGrid stroke="#e5e7eb" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: "#727984", fontSize: 11 }}
            axisLine={{ stroke: "#e5e7eb" }}
            tickLine={false}
            tickFormatter={(value: number) =>
              new Intl.NumberFormat(intlLocale, { notation: "compact", maximumFractionDigits: 1 }).format(value)
            }
          />
          <YAxis
            type="category"
            dataKey="name"
            width={94}
            tick={{ fill: "#555e6b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: string) => value.length > 14 ? `${value.slice(0, 13)}…` : value}
          />
          <Tooltip
            formatter={(value) => [currency.format(Number(value)), label]}
            contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12, fontFamily: "inherit" }}
            cursor={{ fill: "rgba(75, 189, 189, 0.08)" }}
          />
          <Bar
            dataKey="spend"
            name={label}
            fill="#4bbdbd"
            radius={[0, 5, 5, 0]}
            isAnimationActive
            animationDuration={750}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
