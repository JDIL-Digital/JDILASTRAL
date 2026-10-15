"use client";

/**
 * Bloomberg-style editable line-items table.
 *
 * - Click any cell → edit inline. Tab moves to the next editable cell;
 *   Shift+Tab goes back; Enter commits.
 * - Autosave is debounced per-row (500 ms). The row's save state is
 *   rendered inline (Saving… / Saved ✓ / Error ✗) so operators get
 *   immediate feedback without a toast flood.
 * - Changing Currency or Date triggers a Frankfurter fetch and writes
 *   the resolved rate back to the row.
 * - First two columns (Sr No, Description) are sticky — stay visible
 *   when the user horizontal-scrolls through the rest of the sheet.
 * - A totals row at the bottom sums Budget, Actual (USD), Surplus.
 */

import * as React from "react";
import {
  CheckCircle2,
  FileText,
  Loader2,
  Pencil,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getFxRate } from "@/lib/fx/frankfurter";
import { useToast } from "@/components/ui/Toast";
import { cn, formatCurrency } from "@/lib/utils";
import type { Currency } from "@/lib/constants";
import type { DbLineItem, LineItemCurrency, LineItemStatus } from "@/types/database";

type EditableKey =
  | "material_code"
  | "area"
  | "description"
  | "work_by"
  | "budget_usd"
  | "actual_local_amount"
  | "actual_local_currency"
  | "actual_local_date"
  | "mr_no"
  | "po_no";

const EDITABLE_ORDER: EditableKey[] = [
  "material_code",
  "area",
  "description",
  "work_by",
  "budget_usd",
  "actual_local_amount",
  "actual_local_currency",
  "actual_local_date",
  "mr_no",
  "po_no",
];

const WORK_BY_OPTIONS = ["JDIL", "Vendor", "ONGC", "Contractor"] as const;
const CURRENCY_OPTIONS: LineItemCurrency[] = ["USD", "INR", "AED"];

type SaveState = "idle" | "saving" | "saved" | "error";

interface EditableLineItemsTableProps {
  items: DbLineItem[];
  onUpdate: (id: string, patch: Partial<DbLineItem>) => Promise<DbLineItem | null>;
  onDelete: (id: string) => Promise<boolean>;
  onGeneratePO?: (item: DbLineItem) => void;
}

interface CellCoord {
  rowId: string;
  key: EditableKey;
}

const STATUS_BADGE: Record<
  LineItemStatus,
  { label: string; icon: string; variant: "default" | "secondary" | "warning" | "destructive" }
> = {
  pending: { label: "Pending", icon: "⬜", variant: "secondary" },
  "on-track": { label: "On Track", icon: "🟢", variant: "default" },
  watch: { label: "Watch", icon: "🟡", variant: "warning" },
  overrun: { label: "Overrun", icon: "🔴", variant: "destructive" },
};

/** Compute status from live row values — mirrors the UI classification. */
function deriveStatus(row: DbLineItem): LineItemStatus {
  const budget = Number(row.budget_usd ?? 0);
  const actual = Number(row.actual_usd_computed ?? 0);
  if (!actual) return "pending";
  if (budget === 0) return actual > 0 ? "overrun" : "pending";
  const pct = actual / budget;
  if (pct > 1) return "overrun";
  if (pct >= 0.9) return "watch";
  return "on-track";
}

export function EditableLineItemsTable({
  items,
  onUpdate,
  onDelete,
  onGeneratePO,
}: EditableLineItemsTableProps) {
  const toast = useToast();

  // ------- draft state (per-row optimistic overrides) -------
  const [drafts, setDrafts] = React.useState<Record<string, Partial<DbLineItem>>>({});
  const [saveState, setSaveState] = React.useState<Record<string, SaveState>>({});
  const [fxLoading, setFxLoading] = React.useState<Record<string, boolean>>({});
  const [editing, setEditing] = React.useState<CellCoord | null>(null);
  const saveTimers = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Resolve the "live view" of a row — merge the persisted row with any pending draft.
  const view = React.useCallback(
    (row: DbLineItem): DbLineItem => {
      const d = drafts[row.id];
      if (!d) return row;
      const merged = { ...row, ...d } as DbLineItem;
      // Re-derive actual_usd_computed when amount or rate changes in the draft.
      const amount = Number(merged.actual_local_amount ?? 0);
      const rate = Number(merged.exchange_rate_to_usd ?? 1);
      merged.actual_usd_computed = amount * rate;
      merged.surplus_usd = Number(merged.budget_usd ?? 0) - Number(merged.actual_usd_computed ?? 0);
      merged.status = deriveStatus(merged);
      return merged;
    },
    [drafts],
  );

  // Debounced save — 500 ms after the last mutation on a row.
  const scheduleSave = React.useCallback(
    (rowId: string, patch: Partial<DbLineItem>) => {
      if (saveTimers.current[rowId]) clearTimeout(saveTimers.current[rowId]);
      setSaveState((s) => ({ ...s, [rowId]: "saving" }));
      saveTimers.current[rowId] = setTimeout(async () => {
        try {
          await onUpdate(rowId, patch);
          setSaveState((s) => ({ ...s, [rowId]: "saved" }));
          // Clear the draft once persisted — the fresh row will come
          // through the realtime subscription.
          setDrafts((d) => {
            const copy = { ...d };
            delete copy[rowId];
            return copy;
          });
          setTimeout(
            () =>
              setSaveState((s) => {
                if (s[rowId] !== "saved") return s;
                const copy = { ...s };
                delete copy[rowId];
                return copy;
              }),
            1500,
          );
        } catch (e) {
          setSaveState((s) => ({ ...s, [rowId]: "error" }));
          toast.error(
            "Save failed",
            e instanceof Error ? e.message : "Row not persisted",
          );
        }
      }, 500);
    },
    [onUpdate, toast],
  );

  // Update a draft field + schedule a save; also fire FX if we changed
  // currency or date.
  const setField = React.useCallback(
    (row: DbLineItem, key: EditableKey, next: string | number | null) => {
      const current = view(row)[key];
      if (current === next) return;

      const patch: Partial<DbLineItem> = { [key]: next } as Partial<DbLineItem>;
      setDrafts((d) => ({ ...d, [row.id]: { ...(d[row.id] ?? {}), ...patch } }));

      const needsFx =
        (key === "actual_local_currency" || key === "actual_local_date") &&
        view({ ...row, ...patch }).actual_local_currency !== "USD";

      if (needsFx) {
        void triggerFxFetch({ ...row, ...patch });
      } else {
        scheduleSave(row.id, patch);
      }
    },
    [scheduleSave, view],
  );

  // Fetch FX, then merge rate into the draft and persist together.
  const triggerFxFetch = React.useCallback(
    async (row: DbLineItem) => {
      const currency = (row.actual_local_currency ?? "USD") as Currency;
      const date = row.actual_local_date ?? new Date().toISOString().slice(0, 10);
      setFxLoading((s) => ({ ...s, [row.id]: true }));
      try {
        const { rate } = await getFxRate(currency, "USD", date);
        const patch: Partial<DbLineItem> = {
          actual_local_currency: currency,
          actual_local_date: date,
          exchange_rate_to_usd: rate,
        };
        setDrafts((d) => ({ ...d, [row.id]: { ...(d[row.id] ?? {}), ...patch } }));
        scheduleSave(row.id, patch);
      } catch (e) {
        toast.error("FX fetch failed", e instanceof Error ? e.message : "Rate unavailable");
      } finally {
        setFxLoading((s) => ({ ...s, [row.id]: false }));
      }
    },
    [scheduleSave, toast],
  );

  // Keyboard navigation — Tab goes to the next editable cell in reading order.
  const moveFocus = React.useCallback(
    (direction: 1 | -1) => {
      if (!editing) return;
      const rowIdx = items.findIndex((r) => r.id === editing.rowId);
      const colIdx = EDITABLE_ORDER.indexOf(editing.key);
      if (rowIdx < 0 || colIdx < 0) return;

      let nextRow = rowIdx;
      let nextCol = colIdx + direction;

      while (nextRow >= 0 && nextRow < items.length) {
        if (nextCol < 0) {
          nextRow -= 1;
          nextCol = EDITABLE_ORDER.length - 1;
        } else if (nextCol >= EDITABLE_ORDER.length) {
          nextRow += 1;
          nextCol = 0;
        } else {
          setEditing({ rowId: items[nextRow].id, key: EDITABLE_ORDER[nextCol] });
          return;
        }
      }
      setEditing(null);
    },
    [editing, items],
  );

  // Clean up pending timers on unmount
  React.useEffect(
    () => () => {
      Object.values(saveTimers.current).forEach(clearTimeout);
    },
    [],
  );

  // Totals
  const totals = React.useMemo(() => {
    let budget = 0;
    let actual = 0;
    let surplus = 0;
    items.forEach((row) => {
      const v = view(row);
      budget += Number(v.budget_usd ?? 0);
      actual += Number(v.actual_usd_computed ?? 0);
      surplus += Number(v.surplus_usd ?? 0);
    });
    return { budget, actual, surplus };
  }, [items, view]);

  return (
    <div className="overflow-hidden rounded-xl border border-brand-border bg-brand-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1400px] text-sm">
          <thead className="sticky top-0 z-10 bg-brand-bg/90 backdrop-blur">
            <tr className="text-xs uppercase tracking-wider text-brand-muted">
              <Th sticky left={0} className="w-14 text-center">#</Th>
              <Th sticky left={56} className="min-w-[260px]">Description</Th>
              <Th>Code</Th>
              <Th>Area</Th>
              <Th>Work By</Th>
              <Th className="text-right">Budget USD</Th>
              <Th className="text-right">Actual Amount</Th>
              <Th>Ccy</Th>
              <Th>Date</Th>
              <Th className="text-right">Rate</Th>
              <Th className="text-right">Actual USD</Th>
              <Th className="text-right">Surplus</Th>
              <Th>MR No</Th>
              <Th>PO No</Th>
              <Th>Status</Th>
              <Th>Save</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((row, idx) => {
              const v = view(row);
              const state = saveState[row.id] ?? "idle";
              const isFxBusy = fxLoading[row.id] ?? false;
              const surplusPositive = Number(v.surplus_usd ?? 0) >= 0;

              return (
                <tr
                  key={row.id}
                  className="group border-b border-brand-border transition-colors hover:bg-brand-border/20"
                >
                  <Td sticky left={0} className="w-14 text-center font-mono text-xs text-brand-muted">
                    {idx + 1}
                  </Td>

                  <Td sticky left={56} className="min-w-[260px]">
                    <EditableTextCell
                      row={row}
                      field="description"
                      value={v.description ?? ""}
                      editing={editing}
                      setEditing={setEditing}
                      onChange={(val) => setField(row, "description", val)}
                      onNavigate={moveFocus}
                    />
                  </Td>

                  <Td>
                    <EditableTextCell
                      row={row}
                      field="material_code"
                      value={v.material_code ?? ""}
                      editing={editing}
                      setEditing={setEditing}
                      onChange={(val) => setField(row, "material_code", val)}
                      onNavigate={moveFocus}
                      className="font-mono text-xs"
                    />
                  </Td>

                  <Td>
                    <EditableTextCell
                      row={row}
                      field="area"
                      value={v.area ?? ""}
                      editing={editing}
                      setEditing={setEditing}
                      onChange={(val) => setField(row, "area", val)}
                      onNavigate={moveFocus}
                    />
                  </Td>

                  <Td>
                    <EditableSelectCell
                      row={row}
                      field="work_by"
                      value={v.work_by ?? ""}
                      options={WORK_BY_OPTIONS as unknown as string[]}
                      editing={editing}
                      setEditing={setEditing}
                      onChange={(val) => setField(row, "work_by", val)}
                      onNavigate={moveFocus}
                    />
                  </Td>

                  <Td className="text-right">
                    <EditableNumberCell
                      row={row}
                      field="budget_usd"
                      value={Number(v.budget_usd ?? 0)}
                      editing={editing}
                      setEditing={setEditing}
                      onChange={(val) => setField(row, "budget_usd", val)}
                      onNavigate={moveFocus}
                      formatter={(n) => formatCurrency(n, "USD")}
                    />
                  </Td>

                  <Td className="text-right">
                    <EditableNumberCell
                      row={row}
                      field="actual_local_amount"
                      value={Number(v.actual_local_amount ?? 0)}
                      editing={editing}
                      setEditing={setEditing}
                      onChange={(val) => setField(row, "actual_local_amount", val)}
                      onNavigate={moveFocus}
                      formatter={(n) =>
                        formatCurrency(n, v.actual_local_currency as "USD" | "INR" | "AED")
                      }
                    />
                  </Td>

                  <Td>
                    <EditableSelectCell
                      row={row}
                      field="actual_local_currency"
                      value={v.actual_local_currency ?? "USD"}
                      options={CURRENCY_OPTIONS as unknown as string[]}
                      editing={editing}
                      setEditing={setEditing}
                      onChange={(val) => setField(row, "actual_local_currency", val)}
                      onNavigate={moveFocus}
                    />
                  </Td>

                  <Td>
                    <EditableDateCell
                      row={row}
                      field="actual_local_date"
                      value={v.actual_local_date ?? ""}
                      editing={editing}
                      setEditing={setEditing}
                      onChange={(val) => setField(row, "actual_local_date", val)}
                      onNavigate={moveFocus}
                    />
                  </Td>

                  <Td className="text-right font-mono text-xs">
                    {isFxBusy ? (
                      <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-brand-muted" />
                    ) : (
                      Number(v.exchange_rate_to_usd ?? 1).toFixed(4)
                    )}
                  </Td>

                  <Td className="text-right font-bold tabular-nums">
                    {formatCurrency(Number(v.actual_usd_computed ?? 0), "USD")}
                  </Td>

                  <Td
                    className={cn(
                      "text-right font-mono tabular-nums",
                      surplusPositive ? "text-brand-success" : "text-brand-danger",
                    )}
                  >
                    {surplusPositive ? "+" : ""}
                    {formatCurrency(Number(v.surplus_usd ?? 0), "USD")}
                  </Td>

                  <Td>
                    <EditableTextCell
                      row={row}
                      field="mr_no"
                      value={v.mr_no ?? ""}
                      editing={editing}
                      setEditing={setEditing}
                      onChange={(val) => setField(row, "mr_no", val)}
                      onNavigate={moveFocus}
                      className="font-mono text-xs"
                    />
                  </Td>

                  <Td>
                    <EditableTextCell
                      row={row}
                      field="po_no"
                      value={v.po_no ?? ""}
                      editing={editing}
                      setEditing={setEditing}
                      onChange={(val) => setField(row, "po_no", val)}
                      onNavigate={moveFocus}
                      className="font-mono text-xs"
                    />
                  </Td>

                  <Td>
                    <Badge variant={STATUS_BADGE[v.status].variant} className="whitespace-nowrap">
                      <span className="mr-1">{STATUS_BADGE[v.status].icon}</span>
                      {STATUS_BADGE[v.status].label}
                    </Badge>
                  </Td>

                  <Td>
                    <SaveIndicator
                      state={state}
                      onRetry={() => scheduleSave(row.id, drafts[row.id] ?? {})}
                    />
                  </Td>

                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        aria-label="Edit"
                        title="Edit"
                        onClick={() => setEditing({ rowId: row.id, key: "description" })}
                        className="rounded-md p-1 text-brand-muted hover:bg-brand-border/40 hover:text-brand-text"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {onGeneratePO && (
                        <button
                          type="button"
                          aria-label="Generate PO"
                          title="Generate PO for this line"
                          onClick={() => onGeneratePO(row)}
                          className="rounded-md p-1 text-brand-muted hover:bg-brand-green/15 hover:text-brand-green"
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label="Delete"
                        title="Delete row"
                        onClick={async () => {
                          if (!window.confirm("Delete this line item?")) return;
                          try {
                            await onDelete(row.id);
                            toast.success("Row deleted");
                          } catch (e) {
                            toast.error(
                              "Delete failed",
                              e instanceof Error ? e.message : undefined,
                            );
                          }
                        }}
                        className="rounded-md p-1 text-brand-muted hover:bg-brand-danger/15 hover:text-brand-danger"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </Td>
                </tr>
              );
            })}

            {items.length === 0 && (
              <tr>
                <td colSpan={17} className="p-10 text-center text-sm text-brand-muted">
                  No line items yet. Click <span className="font-semibold">Add Row</span> to create one.
                </td>
              </tr>
            )}
          </tbody>

          {items.length > 0 && (
            <tfoot className="sticky bottom-0 bg-brand-bg/95 backdrop-blur">
              <tr className="border-t-2 border-brand-green/40">
                <Td sticky left={0} className="w-14 text-center font-bold text-brand-muted">
                  Σ
                </Td>
                <Td sticky left={56} className="font-semibold uppercase tracking-wider text-brand-muted">
                  Totals ({items.length} items)
                </Td>
                <Td colSpan={3} />
                <Td className="text-right font-mono font-bold">
                  {formatCurrency(totals.budget, "USD")}
                </Td>
                <Td colSpan={3} />
                <Td />
                <Td className="text-right font-mono font-bold">
                  {formatCurrency(totals.actual, "USD")}
                </Td>
                <Td
                  className={cn(
                    "text-right font-mono font-bold",
                    totals.surplus >= 0 ? "text-brand-success" : "text-brand-danger",
                  )}
                >
                  {totals.surplus >= 0 ? "+" : ""}
                  {formatCurrency(totals.surplus, "USD")}
                </Td>
                <Td colSpan={5} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

/* ======================= cells ======================= */

function Th({
  children,
  className,
  sticky,
  left,
}: {
  children?: React.ReactNode;
  className?: string;
  sticky?: boolean;
  left?: number;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap px-3 py-2.5 text-left align-middle font-semibold text-brand-muted",
        sticky && "sticky z-20 bg-brand-bg/95 backdrop-blur",
        className,
      )}
      style={sticky && left !== undefined ? { left } : undefined}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
  sticky,
  left,
  colSpan,
}: {
  children?: React.ReactNode;
  className?: string;
  sticky?: boolean;
  left?: number;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        "whitespace-nowrap px-3 py-2 align-middle",
        sticky && "sticky z-[5] bg-brand-surface",
        className,
      )}
      style={sticky && left !== undefined ? { left } : undefined}
    >
      {children}
    </td>
  );
}

function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-brand-muted">
        <Loader2 className="h-3 w-3 animate-spin" /> Saving…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-brand-success">
        <CheckCircle2 className="h-3 w-3" /> Saved
      </span>
    );
  }
  if (state === "error") {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1 text-xs text-brand-danger hover:underline"
      >
        <XCircle className="h-3 w-3" /> Retry
        <RotateCcw className="h-3 w-3" />
      </button>
    );
  }
  return <span className="text-xs text-brand-muted/40">—</span>;
}

/* ======================= editable cells ======================= */

interface BaseCellProps {
  row: DbLineItem;
  field: EditableKey;
  editing: CellCoord | null;
  setEditing: (next: CellCoord | null) => void;
  onNavigate: (direction: 1 | -1) => void;
  className?: string;
}

interface TextCellProps extends BaseCellProps {
  value: string;
  onChange: (next: string) => void;
}

function EditableTextCell({
  row,
  field,
  value,
  editing,
  setEditing,
  onChange,
  onNavigate,
  className,
}: TextCellProps) {
  const active = editing?.rowId === row.id && editing.key === field;
  const [local, setLocal] = React.useState(value);
  React.useEffect(() => setLocal(value), [value]);

  if (!active) {
    return (
      <button
        type="button"
        onClick={() => setEditing({ rowId: row.id, key: field })}
        className={cn(
          "block w-full rounded px-1.5 py-0.5 text-left text-brand-text hover:bg-brand-border/30",
          !value && "text-brand-muted italic",
          className,
        )}
      >
        {value || "—"}
      </button>
    );
  }

  return (
    <input
      autoFocus
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        setEditing(null);
        if (local !== value) onChange(local);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        } else if (e.key === "Escape") {
          setLocal(value);
          setEditing(null);
        } else if (e.key === "Tab") {
          e.preventDefault();
          if (local !== value) onChange(local);
          onNavigate(e.shiftKey ? -1 : 1);
        }
      }}
      className={cn(
        "w-full rounded border border-brand-green bg-brand-bg px-1.5 py-0.5 text-brand-text outline-none ring-2 ring-brand-green/30",
        className,
      )}
    />
  );
}

interface NumberCellProps extends BaseCellProps {
  value: number;
  onChange: (next: number) => void;
  formatter?: (n: number) => string;
}

function EditableNumberCell({
  row,
  field,
  value,
  editing,
  setEditing,
  onChange,
  onNavigate,
  formatter,
  className,
}: NumberCellProps) {
  const active = editing?.rowId === row.id && editing.key === field;
  const [local, setLocal] = React.useState(String(value || ""));
  React.useEffect(() => setLocal(String(value || "")), [value]);

  if (!active) {
    return (
      <button
        type="button"
        onClick={() => setEditing({ rowId: row.id, key: field })}
        className={cn(
          "block w-full rounded px-1.5 py-0.5 text-right font-mono text-brand-text hover:bg-brand-border/30",
          !value && "text-brand-muted/60",
          className,
        )}
      >
        {formatter ? formatter(value) : value || "—"}
      </button>
    );
  }

  return (
    <input
      autoFocus
      type="number"
      step="0.01"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        setEditing(null);
        const num = Number(local);
        if (!Number.isNaN(num) && num !== value) onChange(num);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        } else if (e.key === "Escape") {
          setLocal(String(value || ""));
          setEditing(null);
        } else if (e.key === "Tab") {
          e.preventDefault();
          const num = Number(local);
          if (!Number.isNaN(num) && num !== value) onChange(num);
          onNavigate(e.shiftKey ? -1 : 1);
        }
      }}
      className={cn(
        "w-full rounded border border-brand-green bg-brand-bg px-1.5 py-0.5 text-right font-mono text-brand-text outline-none ring-2 ring-brand-green/30",
        className,
      )}
    />
  );
}

interface SelectCellProps extends BaseCellProps {
  value: string;
  options: string[];
  onChange: (next: string) => void;
}

function EditableSelectCell({
  row,
  field,
  value,
  options,
  editing,
  setEditing,
  onChange,
  onNavigate,
  className,
}: SelectCellProps) {
  const active = editing?.rowId === row.id && editing.key === field;

  if (!active) {
    return (
      <button
        type="button"
        onClick={() => setEditing({ rowId: row.id, key: field })}
        className={cn(
          "block w-full rounded px-1.5 py-0.5 text-left text-brand-text hover:bg-brand-border/30",
          !value && "text-brand-muted italic",
          className,
        )}
      >
        {value || "—"}
      </button>
    );
  }

  return (
    <select
      autoFocus
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        setEditing(null);
      }}
      onBlur={() => setEditing(null)}
      onKeyDown={(e) => {
        if (e.key === "Tab") {
          e.preventDefault();
          onNavigate(e.shiftKey ? -1 : 1);
        } else if (e.key === "Escape") {
          setEditing(null);
        }
      }}
      className={cn(
        "w-full rounded border border-brand-green bg-brand-bg px-1.5 py-0.5 text-brand-text outline-none ring-2 ring-brand-green/30",
        className,
      )}
    >
      <option value="">—</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

interface DateCellProps extends BaseCellProps {
  value: string;
  onChange: (next: string) => void;
}

function EditableDateCell({
  row,
  field,
  value,
  editing,
  setEditing,
  onChange,
  onNavigate,
  className,
}: DateCellProps) {
  const active = editing?.rowId === row.id && editing.key === field;

  if (!active) {
    return (
      <button
        type="button"
        onClick={() => setEditing({ rowId: row.id, key: field })}
        className={cn(
          "block w-full rounded px-1.5 py-0.5 text-left text-xs text-brand-text hover:bg-brand-border/30",
          !value && "text-brand-muted italic",
          className,
        )}
      >
        {value || "—"}
      </button>
    );
  }

  return (
    <input
      autoFocus
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => setEditing(null)}
      onKeyDown={(e) => {
        if (e.key === "Tab") {
          e.preventDefault();
          onNavigate(e.shiftKey ? -1 : 1);
        } else if (e.key === "Escape") {
          setEditing(null);
        }
      }}
      className={cn(
        "w-full rounded border border-brand-green bg-brand-bg px-1.5 py-0.5 text-brand-text outline-none ring-2 ring-brand-green/30",
        className,
      )}
    />
  );
}
