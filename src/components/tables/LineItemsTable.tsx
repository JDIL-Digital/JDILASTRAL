"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { DbLineItem, LineItemStatus } from "@/types/database";

interface LineItemsTableProps {
  items: DbLineItem[];
  onRowClick?: (item: DbLineItem) => void;
}

const STATUS_VARIANT: Record<LineItemStatus, "default" | "secondary" | "warning" | "destructive"> = {
  pending: "secondary",
  "on-track": "default",
  watch: "warning",
  overrun: "destructive",
};

export function LineItemsTable({ items, onRowClick }: LineItemsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filter, setFilter] = useState("");

  const columns = useMemo<ColumnDef<DbLineItem>[]>(
    () => [
      {
        accessorKey: "sr_no",
        header: "#",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-brand-muted">
            {row.original.sr_no ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "material_code",
        header: "Code",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-brand-muted">
            {row.original.material_code ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "description",
        header: ({ column }) => (
          <button
            className="inline-flex items-center gap-1 text-xs uppercase tracking-wider"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Description <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => (
          <div className="max-w-[320px]">
            <p className="font-medium text-brand-text">{row.original.description}</p>
            {row.original.area && (
              <p className="text-xs text-brand-muted">{row.original.area}</p>
            )}
          </div>
        ),
      },
      {
        accessorKey: "work_by",
        header: "Vendor",
        cell: ({ row }) => row.original.work_by ?? "—",
      },
      {
        accessorKey: "budget_usd",
        header: () => <div className="text-right">Budget</div>,
        cell: ({ row }) => (
          <div className="text-right font-mono text-sm">
            {formatCurrency(Number(row.original.budget_usd ?? 0), "USD")}
          </div>
        ),
      },
      {
        accessorKey: "actual_usd_computed",
        header: ({ column }) => (
          <button
            className="inline-flex w-full items-center justify-end gap-1 text-xs uppercase tracking-wider"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Actual <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => {
          const actual = Number(row.original.actual_usd_computed ?? 0);
          const local = Number(row.original.actual_local_amount ?? 0);
          return (
            <div className="text-right">
              <p className="font-mono font-semibold text-brand-text">
                {formatCurrency(actual, "USD")}
              </p>
              {local > 0 && row.original.actual_local_currency !== "USD" && (
                <p className="text-xs text-brand-muted">
                  {formatCurrency(local, row.original.actual_local_currency)}
                </p>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "surplus_usd",
        header: () => <div className="text-right">Variance</div>,
        cell: ({ row }) => {
          const surplus = Number(row.original.surplus_usd ?? 0);
          const positive = surplus >= 0;
          return (
            <div
              className={`text-right font-mono text-sm ${
                positive ? "text-brand-success" : "text-brand-danger"
              }`}
            >
              {positive ? "+" : ""}
              {formatCurrency(surplus, "USD")}
            </div>
          );
        },
      },
      {
        accessorKey: "actual_local_date",
        header: "Actual Date",
        cell: ({ row }) =>
          row.original.actual_local_date ? (
            <span className="text-sm text-brand-text">
              {formatDate(row.original.actual_local_date)}
            </span>
          ) : (
            <span className="text-brand-muted">—</span>
          ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={STATUS_VARIANT[row.original.status]} className="capitalize">
            {row.original.status}
          </Badge>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: items,
    columns,
    state: { sorting, globalFilter: filter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const totalBudget = items.reduce((s, i) => s + Number(i.budget_usd ?? 0), 0);
  const totalActual = items.reduce((s, i) => s + Number(i.actual_usd_computed ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search line items, vendors, codes..."
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-3 text-xs text-brand-muted">
          <span>{items.length} items</span>
          <span>·</span>
          <span>
            Budget{" "}
            <span className="font-semibold text-brand-text">
              {formatCurrency(totalBudget, "USD")}
            </span>
          </span>
          <span>·</span>
          <span>
            Actual{" "}
            <span className="font-semibold text-brand-text">
              {formatCurrency(totalActual, "USD")}
            </span>
          </span>
          <Button variant="outline" size="sm">
            Export CSV
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-brand-border bg-brand-surface">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-brand-muted">
                  No line items found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={onRowClick ? "cursor-pointer" : undefined}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
