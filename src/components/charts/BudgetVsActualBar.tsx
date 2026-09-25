"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartTokens } from "@/hooks/useChartTokens";
import { formatCompact, formatCurrency } from "@/lib/utils";

interface Datum {
  name: string;
  budget: number;
  actual: number;
  committed?: number;
}

interface BudgetVsActualBarProps {
  data: Datum[];
  height?: number;
}

export function BudgetVsActualBar({ data, height = 300 }: BudgetVsActualBarProps) {
  const t = useChartTokens();
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false} />
          <XAxis
            dataKey="name"
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
            cursor={{ fill: `${t.border}40` }}
            contentStyle={{
              backgroundColor: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: 8,
              color: t.textPrimary,
            }}
            formatter={(value: number) => formatCurrency(value, "USD")}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: t.textSecondary }}
            iconType="circle"
          />
          <Bar dataKey="budget" name="Budget" fill={t.primary} radius={[4, 4, 0, 0]} />
          <Bar dataKey="actual" name="Actual" fill={t.danger} radius={[4, 4, 0, 0]} />
          {data.some((d) => d.committed !== undefined) && (
            <Bar
              dataKey="committed"
              name="Committed"
              fill={t.warning}
              radius={[4, 4, 0, 0]}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
