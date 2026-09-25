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

interface FleetDatum {
  rig: string;
  budget: number;
  spent: number;
  committed: number;
}

interface FleetOverviewBarProps {
  data: FleetDatum[];
  height?: number;
}

export function FleetOverviewBar({ data, height = 320 }: FleetOverviewBarProps) {
  const t = useChartTokens();
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={t.border} horizontal={false} />
          <XAxis
            type="number"
            stroke={t.textSecondary}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `$${formatCompact(v)}`}
          />
          <YAxis
            type="category"
            dataKey="rig"
            stroke={t.textSecondary}
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: t.border }}
            width={110}
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
          <Bar dataKey="budget" name="Budget" fill={t.primary} radius={[0, 4, 4, 0]} />
          <Bar dataKey="committed" name="Committed" fill={t.warning} radius={[0, 4, 4, 0]} />
          <Bar dataKey="spent" name="Spent" fill={t.danger} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
