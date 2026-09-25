"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartTokens } from "@/hooks/useChartTokens";
import { formatCompact, formatCurrency } from "@/lib/utils";

interface SpendPoint {
  period: string;
  spend: number;
  budget?: number;
}

interface SpendTrendLineProps {
  data: SpendPoint[];
  height?: number;
}

export function SpendTrendLine({ data, height = 300 }: SpendTrendLineProps) {
  const t = useChartTokens();
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={t.primary} stopOpacity={0.45} />
              <stop offset="95%" stopColor={t.primary} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="budgetGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={t.warning} stopOpacity={0.25} />
              <stop offset="95%" stopColor={t.warning} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false} />
          <XAxis
            dataKey="period"
            stroke={t.textSecondary}
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: t.border }}
          />
          <YAxis
            stroke={t.textSecondary}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `$${formatCompact(v)}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: 8,
              color: t.textPrimary,
            }}
            formatter={(value: number) => formatCurrency(value, "USD")}
          />
          {data.some((d) => d.budget !== undefined) && (
            <Area
              type="monotone"
              dataKey="budget"
              name="Budget"
              stroke={t.warning}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              fill="url(#budgetGradient)"
            />
          )}
          <Area
            type="monotone"
            dataKey="spend"
            name="Spend"
            stroke={t.primary}
            strokeWidth={2}
            fill="url(#spendGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
