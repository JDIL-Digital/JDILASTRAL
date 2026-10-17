"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, Download, Filter, Loader2, Sparkles } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CardSkeleton, ChartSkeleton } from "@/components/ui/Skeletons";
import { QueryError, EmptyState } from "@/components/ui/ErrorBoundary";
import { useToast } from "@/components/ui/Toast";
import { useAnalytics, type RiskLevel, type Trend } from "@/hooks/useAnalytics";
import { useRigs } from "@/hooks/useRigs";
import { useChartTokens } from "@/hooks/useChartTokens";
import { downloadAnalyticsPdf } from "@/lib/pdf/generateAnalyticsReport";
import { BRAND } from "@/lib/constants";
import { cn, formatCompact, formatCurrency } from "@/lib/utils";

/* ------------------------- small dynamic widgets ------------------------- */

// Gauge is small & self-contained — keep inline rather than dynamic-import.

const RANGE_OPTIONS = [
  { label: "Last 30 days", days: 30 },
  { label: "Last 60 days", days: 60 },
  { label: "Last 90 days", days: 90 },
  { label: "All time", days: 0 },
  { label: "Custom range", days: -1 },
];

const RISK_LABEL: Record<RiskLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};
const RISK_VARIANT: Record<RiskLevel, "default" | "warning" | "destructive" | "secondary"> = {
  low: "default",
  medium: "warning",
  high: "warning",
  critical: "destructive",
};
const RISK_COLOR_HEX: Record<RiskLevel, string> = {
  low: BRAND.success,
  medium: BRAND.warning,
  high: "#F97316",
  critical: BRAND.danger,
};
const TRAFFIC_COLOR: Record<"healthy" | "watch" | "critical", string> = {
  healthy: BRAND.success,
  watch: BRAND.warning,
  critical: BRAND.danger,
};
const TRAFFIC_LABEL: Record<"healthy" | "watch" | "critical", string> = {
  healthy: "🟢 Healthy",
  watch: "🟡 Watch",
  critical: "🔴 Critical",
};
const TREND_ARROW: Record<Trend, string> = {
  improving: "↑",
  deteriorating: "↓",
  stable: "→",
};
const TREND_COLOR: Record<Trend, string> = {
  improving: "text-brand-success",
  deteriorating: "text-brand-danger",
  stable: "text-brand-muted",
};

/* ----------------------- small CPI gauge component ----------------------- */

function CpiGauge({ cpi }: { cpi: number }) {
  // Map CPI 0..1.5 → 0..180° arc. CPI > 1 is good.
  const clamped = Math.max(0, Math.min(1.5, cpi));
  const pct = clamped / 1.5;
  const angle = pct * 180;
  const color = cpi >= 1 ? BRAND.success : cpi >= 0.9 ? BRAND.warning : BRAND.danger;

  // SVG arc path builder — half-donut, 150×80 viewport.
  const cx = 75;
  const cy = 75;
  const r = 55;
  const angleRad = (Math.PI * (180 - angle)) / 180;
  const endX = cx + r * Math.cos(angleRad);
  const endY = cy - r * Math.sin(angleRad);
  const largeArc = angle > 180 ? 1 : 0;

  const trackPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const fillPath = `M ${cx - r} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY}`;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 150 90" className="w-full max-w-[220px]">
        <path d={trackPath} stroke="rgb(var(--brand-border))" strokeWidth="12" fill="none" />
        <path d={fillPath} stroke={color} strokeWidth="12" fill="none" strokeLinecap="round" />
        <text
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          fontSize="18"
          fontWeight="700"
          fill={color}
        >
          {cpi.toFixed(2)}
        </text>
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          fontSize="7"
          fill="rgb(var(--brand-muted))"
          letterSpacing="2"
        >
          COST PERF INDEX
        </text>
      </svg>
      <p className="mt-1 text-xs text-brand-muted">
        Target ≥ 1.0 · Values &lt; 1.0 indicate cost overrun
      </p>
    </div>
  );
}

/* ---------------------------- forecast chart ---------------------------- */

function ForecastChart({ data }: { data: AnalyticsForecastRow[] }) {
  const t = useChartTokens();
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BRAND.primary} stopOpacity={0.4} />
              <stop offset="100%" stopColor={BRAND.primary} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={t.border} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="period" stroke={t.textSecondary} fontSize={11} tickLine={false} />
          <YAxis
            stroke={t.textSecondary}
            fontSize={11}
            tickLine={false}
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
          <Legend wrapperStyle={{ fontSize: 11, color: t.textSecondary }} iconType="circle" />
          <Area
            type="monotone"
            dataKey="actual"
            name="Actual (cumulative)"
            stroke={BRAND.primary}
            strokeWidth={2}
            fill="url(#actualGradient)"
          />
          <Line
            type="monotone"
            dataKey="plan"
            name="Planned (BAC × time)"
            stroke={BRAND.warning}
            strokeWidth={1.5}
            strokeDasharray="5 4"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="forecast"
            name="Forecast (EAC)"
            stroke={BRAND.danger}
            strokeWidth={1.5}
            strokeDasharray="2 3"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

interface AnalyticsForecastRow {
  period: string;
  actual: number;
  plan: number;
  forecast: number;
}

/* --------------------------- monthly burn stack --------------------------- */

function MonthlyBurnChart({
  data,
  annexureNames,
}: {
  data: Array<Record<string, number | string>>;
  annexureNames: string[];
}) {
  const t = useChartTokens();
  const palette = [
    BRAND.primary,
    "#22C55E",
    BRAND.warning,
    "#7C5CFF",
    "#22B8CF",
    BRAND.danger,
    "#F97316",
    "#06B6D4",
    "#A855F7",
    "#EAB308",
    "#EC4899",
  ];
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
          <CartesianGrid stroke={t.border} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="period" stroke={t.textSecondary} fontSize={11} tickLine={false} />
          <YAxis
            stroke={t.textSecondary}
            fontSize={11}
            tickLine={false}
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
          <Legend wrapperStyle={{ fontSize: 10, color: t.textSecondary }} iconType="square" />
          {annexureNames.map((name, i) => (
            <Bar
              key={name}
              dataKey={name}
              stackId="burn"
              fill={palette[i % palette.length]}
              radius={i === annexureNames.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ----------------------------- velocity line ----------------------------- */

function VelocityChart({
  data,
  avgMonthlyBurn,
}: {
  data: Array<{ date: string; spend: number; movingAvg: number }>;
  avgMonthlyBurn: number;
}) {
  const t = useChartTokens();
  const dailyBudget = avgMonthlyBurn / 30;
  const amberThreshold = dailyBudget * 1.1;
  const redThreshold = dailyBudget * 1.2;

  return (
    <div className="space-y-2">
      <div className="h-56 w-full">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
            <CartesianGrid stroke={t.border} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              stroke={t.textSecondary}
              fontSize={10}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke={t.textSecondary}
              fontSize={11}
              tickLine={false}
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
            <Legend wrapperStyle={{ fontSize: 11, color: t.textSecondary }} iconType="line" />
            <Line
              type="monotone"
              dataKey="spend"
              name="Daily spend"
              stroke={BRAND.primary}
              strokeWidth={1.5}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="movingAvg"
              name="7-day moving avg"
              stroke={BRAND.warning}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-brand-muted">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-brand-success" />
          Green ≤ ${formatCompact(dailyBudget)} / day (plan)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-brand-warning" />
          Amber &gt; ${formatCompact(amberThreshold)}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-brand-danger" />
          Red &gt; ${formatCompact(redThreshold)}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------- radar chart ------------------------------- */

function AnnexureRadarChart({
  data,
}: {
  data: Array<{ annexure: string; budget: number; actual: number }>;
}) {
  const t = useChartTokens();
  // Short labels so the chart stays legible.
  const short = data.map((d) => ({
    ...d,
    annexure: d.annexure.length > 14 ? `${d.annexure.slice(0, 12)}…` : d.annexure,
  }));
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer>
        <RadarChart data={short} outerRadius="80%">
          <PolarGrid stroke={t.border} />
          <PolarAngleAxis
            dataKey="annexure"
            tick={{ fill: t.textSecondary, fontSize: 10 }}
          />
          <PolarRadiusAxis
            tick={{ fill: t.textSecondary, fontSize: 9 }}
            tickFormatter={(v) => `$${formatCompact(v as number)}`}
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
          <Legend wrapperStyle={{ fontSize: 11, color: t.textSecondary }} iconType="circle" />
          <Radar
            name="Budget"
            dataKey="budget"
            stroke={BRAND.primary}
            fill={BRAND.primary}
            fillOpacity={0.2}
          />
          <Radar
            name="Actual"
            dataKey="actual"
            stroke={BRAND.danger}
            fill={BRAND.danger}
            fillOpacity={0.25}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ----------------------------- overrun chart ----------------------------- */

function OverrunBarChart({
  data,
}: {
  data: Array<{ name: string; overrun: number }>;
}) {
  const t = useChartTokens();
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 24, left: 60, bottom: 0 }}
        >
          <CartesianGrid stroke={t.border} strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            stroke={t.textSecondary}
            fontSize={11}
            tickFormatter={(v) => `$${formatCompact(v)}`}
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke={t.textSecondary}
            fontSize={10}
            width={160}
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
          <Bar dataKey="overrun" fill={BRAND.danger} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* =============================== page shell =============================== */

export default function AnalyticsPage() {
  const [rangeIdx, setRangeIdx] = useState(2); // Last 90 days
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [rigFilter, setRigFilter] = useState<string>("");

  const { rigs } = useRigs();
  const toast = useToast();

  const { startDate, endDate } = useMemo(() => {
    const range = RANGE_OPTIONS[rangeIdx];
    if (range.days === -1) {
      return {
        startDate: customStart || null,
        endDate: customEnd || null,
      };
    }
    if (range.days === 0) return { startDate: null, endDate: null };
    const end = new Date();
    const start = new Date(end.getTime() - range.days * 86400000);
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  }, [rangeIdx, customStart, customEnd]);

  const { data, loading, error, lastUpdated, refresh } = useAnalytics({
    rigId: rigFilter || null,
    startDate,
    endDate,
  });

  // Monthly burn → chart row shape (annexure names flattened as columns).
  const burnChartRows = useMemo(
    () =>
      data
        ? data.monthlyBurn.map((m) => ({
            period: m.period,
            ...m.byAnnexure,
          }))
        : [],
    [data],
  );

  // Build cumulative forecast series for the EVM chart.
  const forecastSeries: AnalyticsForecastRow[] = useMemo(() => {
    if (!data) return [];
    const months = data.monthlyBurn;
    const bac = data.executive.bac;
    let cum = 0;
    const burnRate = data.avgMonthlyBurn;
    const planPerMonth = months.length > 0 ? bac / Math.max(months.length, 1) : 0;
    return months.map((m, i) => {
      cum += m.total;
      // Forecast runs out from the last actual at the projected burn rate
      const forecast =
        burnRate > 0 && cum > 0
          ? Math.min(bac, cum + burnRate * Math.max(0, months.length - i - 1))
          : cum;
      return {
        period: m.period,
        actual: cum,
        plan: planPerMonth * (i + 1),
        forecast,
      };
    });
  }, [data]);

  const overrunChartData = useMemo(
    () =>
      data
        ? data.topOverruns.map((o) => ({
            name:
              o.description.length > 28 ? `${o.description.slice(0, 26)}…` : o.description,
            overrun: o.overrun,
          }))
        : [],
    [data],
  );

  const [exporting, setExporting] = useState(false);
  async function onExport() {
    if (!data) return;
    setExporting(true);
    try {
      const file = downloadAnalyticsPdf(data);
      toast.success("Report exported", file);
    } catch (e) {
      toast.error("Export failed", e instanceof Error ? e.message : undefined);
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="flex-1 space-y-6 p-4 md:p-6">
      {/* ----------- Header ----------- */}
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-brand-text md:text-3xl">
            <Sparkles className="h-6 w-6 text-brand-green" />
            Analytics &amp; Forecasting
          </h1>
          <p className="mt-1 text-sm text-brand-muted">
            AI-powered cost intelligence across the Jindal fleet · last updated{" "}
            {lastUpdated ? lastUpdated.toLocaleTimeString("en-IN") : "—"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={String(rangeIdx)}
            onChange={(e) => setRangeIdx(Number(e.target.value))}
            className="w-40 text-xs"
          >
            {RANGE_OPTIONS.map((r, i) => (
              <option key={r.label} value={i}>
                {r.label}
              </option>
            ))}
          </Select>
          {rangeIdx === 4 && (
            <>
              <Input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-36 text-xs"
              />
              <Input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-36 text-xs"
              />
            </>
          )}
          <Select
            value={rigFilter}
            onChange={(e) => setRigFilter(e.target.value)}
            className="w-44 text-xs"
          >
            <option value="">All rigs</option>
            {rigs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            onClick={onExport}
            disabled={exporting || !data}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export Report
          </Button>
        </div>
      </header>

      {error ? (
        <QueryError message={error} onRetry={() => void refresh()} />
      ) : loading || !data ? (
        <>
          <CardSkeleton />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartSkeleton />
            <ChartSkeleton />
          </div>
        </>
      ) : (
        <>
          {/* ----------- Executive Summary ----------- */}
          <ExecutiveSummaryCard data={data} />

          {/* ----------- Forecast + Gauge ----------- */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Projected Cost at Completion</CardTitle>
                <CardDescription>
                  Cumulative actual · plan line · forecast extending to project end
                </CardDescription>
              </CardHeader>
              <CardContent>
                {forecastSeries.length > 0 ? (
                  <ForecastChart data={forecastSeries} />
                ) : (
                  <EmptyState title="No spend data" message="Nothing to forecast yet." />
                )}
                <p className="mt-3 text-sm">
                  <span className="text-brand-muted">Projected final cost:</span>{" "}
                  <span
                    className={cn(
                      "font-mono font-bold",
                      data.executive.eac > data.executive.bac
                        ? "text-brand-danger"
                        : "text-brand-success",
                    )}
                  >
                    {formatCurrency(data.executive.eac, "USD")}
                  </span>{" "}
                  <span className="text-brand-muted">vs budget</span>{" "}
                  <span className="font-mono font-semibold text-brand-text">
                    {formatCurrency(data.executive.bac, "USD")}
                  </span>
                </p>
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Cost Performance Index</CardTitle>
                <CardDescription>EV / AC — green &gt; 1, red &lt; 1</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center gap-2">
                <CpiGauge cpi={data.executive.cpi} />
              </CardContent>
            </Card>
          </section>

          {/* ----------- Monthly Burn ----------- */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Burn Rate</CardTitle>
              <CardDescription>
                Stacked by annexure · Avg{" "}
                <span className="font-mono text-brand-text">
                  ${formatCompact(data.avgMonthlyBurn)}
                </span>{" "}
                / month · Projected{" "}
                <span className="font-mono text-brand-text">
                  {Number.isFinite(data.projectedMonthsToCompletion)
                    ? `${data.projectedMonthsToCompletion.toFixed(1)}`
                    : "∞"}
                </span>{" "}
                months to completion at current rate
              </CardDescription>
            </CardHeader>
            <CardContent>
              {burnChartRows.length === 0 ? (
                <EmptyState title="No spend yet" />
              ) : (
                <MonthlyBurnChart
                  data={burnChartRows}
                  annexureNames={data.activeAnnexureNames}
                />
              )}
            </CardContent>
          </Card>

          {/* ----------- Annexure Performance table ----------- */}
          <Card>
            <CardHeader>
              <CardTitle>Cost Performance by Annexure</CardTitle>
              <CardDescription>CPI, forecast final cost, and risk level</CardDescription>
            </CardHeader>
            <CardContent>
              {data.annexurePerformance.length === 0 ? (
                <EmptyState title="No annexures in scope" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="border-b border-brand-border text-left text-xs uppercase tracking-wider text-brand-muted">
                      <tr>
                        <th className="py-2 pr-3">Annexure</th>
                        <th className="py-2 pr-3 text-right">Budget</th>
                        <th className="py-2 pr-3 text-right">Actual</th>
                        <th className="py-2 pr-3 text-right">CPI</th>
                        <th className="py-2 pr-3 text-right">Forecast</th>
                        <th className="py-2 pr-3">Risk</th>
                        <th className="py-2 pr-3">Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.annexurePerformance.map((row) => (
                        <tr
                          key={row.annexureId}
                          className="border-b border-brand-border/60 transition-colors hover:bg-brand-border/20"
                        >
                          <td className="py-3 pr-3 font-medium text-brand-text">{row.name}</td>
                          <td className="py-3 pr-3 text-right font-mono tabular-nums">
                            {formatCurrency(row.budget, "USD")}
                          </td>
                          <td className="py-3 pr-3 text-right font-mono tabular-nums">
                            {formatCurrency(row.actual, "USD")}
                          </td>
                          <td
                            className={cn(
                              "py-3 pr-3 text-right font-mono font-bold tabular-nums",
                              row.cpi >= 1
                                ? "text-brand-success"
                                : row.cpi >= 0.9
                                  ? "text-brand-warning"
                                  : "text-brand-danger",
                            )}
                          >
                            {row.cpi.toFixed(2)}
                          </td>
                          <td className="py-3 pr-3 text-right font-mono tabular-nums">
                            {formatCurrency(row.forecast, "USD")}
                          </td>
                          <td className="py-3 pr-3">
                            <Badge variant={RISK_VARIANT[row.risk]}>
                              {RISK_LABEL[row.risk]}
                            </Badge>
                          </td>
                          <td className={cn("py-3 pr-3 text-lg font-bold", TREND_COLOR[row.trend])}>
                            {TREND_ARROW[row.trend]}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ----------- Overrun Intelligence ----------- */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-brand-danger">
                  <AlertTriangle className="h-5 w-5" />
                  Top 10 Overrun Items
                </CardTitle>
                <CardDescription>Line items whose actual exceeds budget</CardDescription>
              </CardHeader>
              <CardContent>
                {overrunChartData.length === 0 ? (
                  <EmptyState title="No overruns in scope" />
                ) : (
                  <OverrunBarChart data={overrunChartData} />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Root-cause Buckets</CardTitle>
                <CardDescription>Overrun $ grouped by area + vendor</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <RootCauseList title="By Area" items={data.spendByArea.slice(0, 5)} />
                <RootCauseList title="By Vendor" items={data.spendByVendor.slice(0, 5)} />
              </CardContent>
            </Card>
          </section>

          {/* ----------- Velocity + Radar ----------- */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Spend Velocity</CardTitle>
                <CardDescription>Daily spend with 7-day moving average</CardDescription>
              </CardHeader>
              <CardContent>
                {data.velocity.length === 0 ? (
                  <EmptyState title="No dated spend" message="Set an actual date on line items to populate this chart." />
                ) : (
                  <VelocityChart data={data.velocity} avgMonthlyBurn={data.avgMonthlyBurn} />
                )}
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Annexure Comparison</CardTitle>
                <CardDescription>Budget vs actual · 11-axis radar</CardDescription>
              </CardHeader>
              <CardContent>
                {data.radar.length === 0 ? (
                  <EmptyState title="No annexures" />
                ) : (
                  <AnnexureRadarChart data={data.radar} />
                )}
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </main>
  );
}

/* ------------------------- small sub-components ------------------------- */

function ExecutiveSummaryCard({ data }: { data: NonNullable<ReturnType<typeof useAnalytics>["data"]> }) {
  const exec = data.executive;
  return (
    <Card
      className={cn(
        "border-l-[6px]",
        exec.traffic === "healthy" && "border-l-brand-success",
        exec.traffic === "watch" && "border-l-brand-warning",
        exec.traffic === "critical" && "border-l-brand-danger",
      )}
    >
      <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span
              className="inline-flex h-14 w-14 items-center justify-center rounded-full border-4 text-sm font-bold"
              style={{
                borderColor: TRAFFIC_COLOR[exec.traffic],
                color: TRAFFIC_COLOR[exec.traffic],
              }}
            >
              {exec.healthScore}
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-muted">
                Health Score · 0–100
              </p>
              <p className="text-sm font-semibold text-brand-text">
                {TRAFFIC_LABEL[exec.traffic]}
              </p>
            </div>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-brand-text">
            {exec.summary}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 md:w-auto">
          <Pill label="CPI" value={exec.cpi.toFixed(2)} good={exec.cpi >= 1} />
          <Pill label="SPI" value={exec.spi.toFixed(2)} good={exec.spi >= 1} />
          <Pill
            label="EAC"
            value={`$${formatCompact(exec.eac)}`}
            good={exec.eac <= exec.bac}
          />
          <Pill
            label="VAC"
            value={`${exec.vac < 0 ? "-" : ""}$${formatCompact(Math.abs(exec.vac))}`}
            good={exec.vac >= 0}
          />
          <Pill
            label="% Complete"
            value={`${exec.pctComplete.toFixed(0)}%`}
            good={true}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Pill({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2",
        good
          ? "border-brand-success/40 bg-brand-success/5"
          : "border-brand-danger/40 bg-brand-danger/5",
      )}
    >
      <p className="text-[9px] font-semibold uppercase tracking-wider text-brand-muted">
        {label}
      </p>
      <p
        className={cn(
          "font-mono text-sm font-bold tabular-nums",
          good ? "text-brand-success" : "text-brand-danger",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function RootCauseList({
  title,
  items,
}: {
  title: string;
  items: Array<{ category: string; value: number }>;
}) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-brand-muted">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-brand-muted">No data</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {items.map((it) => (
            <li
              key={it.category}
              className="flex items-center justify-between gap-2 border-l-2 border-brand-danger/40 pl-2"
            >
              <span className="truncate text-brand-text">{it.category}</span>
              <span className="shrink-0 font-mono text-xs text-brand-danger">
                +${formatCompact(it.value)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
