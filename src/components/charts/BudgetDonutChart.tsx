"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useChartTokens } from "@/hooks/useChartTokens";
import { formatCurrency } from "@/lib/utils";

interface Datum {
  name: string;
  value: number;
  color?: string;
}

interface BudgetDonutChartProps {
  data: Datum[];
  centerLabel?: string;
  centerValue?: string;
}

export function BudgetDonutChart({ data, centerLabel, centerValue }: BudgetDonutChartProps) {
  const t = useChartTokens();
  const palette = [t.primary, t.warning, t.danger, t.success, "#7C5CFF", "#22B8CF"];
  const total = data.reduce((acc, d) => acc + d.value, 0);

  return (
    <div className="relative h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            innerRadius={70}
            outerRadius={95}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={entry.color ?? palette[i % palette.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: 8,
              color: t.textPrimary,
            }}
            formatter={(value: number, name) => [formatCurrency(value, "USD"), name]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs uppercase tracking-wider text-brand-muted">
          {centerLabel ?? "Total"}
        </span>
        <span className="mt-1 text-xl font-semibold text-brand-text">
          {centerValue ?? formatCurrency(total, "USD")}
        </span>
      </div>
    </div>
  );
}
