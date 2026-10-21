import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface Column<T> {
  /** Stable key. */
  key: string;
  /** Column heading. */
  header: ReactNode;
  /** Cell renderer. */
  render: (row: T) => ReactNode;
  /** Show this column in the stacked mobile card view. */
  mobile?: "primary" | "secondary" | "hidden";
  /** Right-align numeric columns. */
  numeric?: boolean;
  /** Extra classes for the cell. */
  className?: string;
  /** Sortable accessor. When present the header becomes a sort control. */
  sortValue?: (row: T) => string | number;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  caption?: ReactNode;
  /** Rendered when there are no rows. */
  empty?: ReactNode;
  /** Accessible label for the table region. */
  label: string;
  className?: string;
}

/**
 * Responsive data table.
 *
 * On wide viewports this is a real `<table>` with a caption and scoped
 * headers. On narrow viewports the same rows become stacked cards, because a
 * six-column table on a phone is unreadable and horizontally scrolling
 * tables hide data behind gestures.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  empty,
  label,
  className,
}: DataTableProps<T>) {
  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  const primary = columns.filter((c) => c.mobile === "primary");
  const secondary = columns.filter((c) => c.mobile === "secondary");
  const hiddenOnMobile = columns.filter((c) => c.mobile === "hidden");

  return (
    <>
      {/* Wide layout */}
      <div className={cn("hidden overflow-x-auto md:block", className)}>
        <table className="w-full border-collapse text-left">
          {caption ? (
            <caption className="pb-2 text-left text-body-sm text-muted-text">
              {caption}
            </caption>
          ) : null}
          <thead>
            <tr className="border-b border-border">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    "px-4 py-2.5 text-label-sm font-semibold uppercase tracking-[0.04em] text-muted-text",
                    column.numeric && "text-end",
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                className="border-b border-border/60 last:border-0 hover:bg-surface-muted/60"
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "px-4 py-3 text-body-sm text-secondary",
                      column.numeric && "text-end data-[numeric=true]:tabular-nums",
                      column.className,
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Narrow layout — row cards */}
      <ul className="space-y-3 md:hidden" aria-label={label}>
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            className="rounded-lg border border-border bg-surface p-4 shadow-card"
          >
            <div className="space-y-2">
              {primary.map((column) => (
                <div key={column.key} className="text-body-md font-semibold text-tertiary">
                  {column.render(row)}
                </div>
              ))}
              {secondary.map((column) => (
                <div
                  key={column.key}
                  className="flex items-baseline justify-between gap-3 text-body-sm"
                >
                  <span className="text-muted-text">{column.header}</span>
                  <span className="text-secondary">{column.render(row)}</span>
                </div>
              ))}
              {hiddenOnMobile.map((column) => (
                <div key={column.key} className="text-body-sm text-secondary">
                  {column.render(row)}
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Simple definition list used for key/value detail panels.
 */
export function DescriptionList({
  items,
  className,
}: {
  items: Array<{ label: ReactNode; value: ReactNode }>;
  className?: string;
}) {
  return (
    <dl className={cn("divide-y divide-border/70", className)}>
      {items.map((item, index) => (
        <div
          key={index}
          className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2"
        >
          <dt className="text-body-sm text-muted-text">{item.label}</dt>
          <dd className="text-body-sm text-secondary">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
