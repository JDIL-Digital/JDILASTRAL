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
import type { LineItem } from "@/types";

interface LineItemsTableProps {
  items: LineItem[];
  onRowClick?: (item: LineItem) => void;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "warning" | "destructive"> = {
  planned: "secondary",
  requested: "warning",
  ordered: "default",
  received: "default",
  invoiced: "default",
  paid: "default",
};

export function LineItemsTable({ items, onRowClick }: LineItemsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filter, setFilter] = useState("");

  const columns = useMemo<ColumnDef<LineItem>[]>(
    () => [
      {
        accessorKey: "sku",
        header: "SKU",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-brand-muted">
            {row.original.sku ?? "—"}
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
            <p className="text-xs text-brand-muted">{row.original.category}</p>
          </div>
        ),
      },
      {
        accessorKey: "vendor",
        header: "Vendor",
        cell: ({ row }) => row.original.vendor ?? "—",
      },
      {
        accessorKey: "quantity",
        header: () => <div className="text-right">Qty</div>,
        cell: ({ row }) => (
          <div className="text-right">
            {row.original.quantity} {row.original.uom}
          </div>
        ),
      },
      {
        accessorKey: "unit_price",
        header: () => <div className="text-right">Unit Price</div>,
        cell: ({ row }) => (
          <div className="text-right font-mono text-sm">
            {formatCurrency(row.original.unit_price, row.original.currency)}
          </div>
        ),
      },
      {
        accessorKey: "total_local",
        header: ({ column }) => (
          <button
            className="inline-flex w-full items-center justify-end gap-1 text-xs uppercase tracking-wider"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Total <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => (
          <div className="text-right">
            <p className="font-mono font-semibold text-brand-text">
              {formatCurrency(row.original.total_local, row.original.currency)}
            </p>
            <p className="text-xs text-brand-muted">
              {formatCurrency(row.original.total_usd, "USD")}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "required_by",
        header: "Required By",
        cell: ({ row }) =>
          row.original.required_by ? (
            <span className="text-sm text-brand-text">{formatDate(row.original.required_by)}</span>
          ) : (
            <span className="text-brand-muted">—</span>
          ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={STATUS_VARIANT[row.original.status] ?? "secondary"} className="capitalize">
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search line items, vendors, SKUs..."
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-brand-muted">
          <span>{items.length} items</span>
          <span>·</span>
          <span>
            Total{" "}
            <span className="font-semibold text-brand-text">
              {formatCurrency(
                items.reduce((acc, it) => acc + it.total_usd, 0),
                "USD",
              )}
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
