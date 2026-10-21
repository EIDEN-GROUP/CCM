/**
 * CSV export.
 *
 * Two properties matter:
 *
 *  1. **Formula injection protection.** A cell that begins with `=`, `+`,
 *     `-` or `@` is executed by Excel and Sheets when the file is opened. A
 *     hostile keyword or campaign name must not be able to run a formula in
 *     the operator's spreadsheet, so those cells are prefixed with a quote.
 *
 *  2. **Share safe mode.** Customer names, mailbox addresses and sensitive
 *     account identifiers are masked before the file leaves CCM.
 */

export interface CsvColumn<T> {
  key: string;
  header: string;
  /**
   * The cell value. `unknown` is accepted so a column can read a value
   * straight out of a loosely typed database row; it is coerced to text at
   * the point of writing.
   */
  value: (row: T) => unknown;
  /** Masked in "share safe" mode. */
  sensitive?: boolean;
}

const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

/** Escape a single CSV cell. */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";

  let text = String(value);

  // Neutralise a leading formula character.
  if (FORMULA_PREFIXES.some((prefix) => text.startsWith(prefix))) {
    text = `'${text}`;
  }

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * Build a CSV document.
 */
export function toCsv<T>(
  columns: CsvColumn<T>[],
  rows: T[],
  options: { safeMode?: boolean } = {},
): string {
  const safeMode = options.safeMode ?? true;

  const header = columns.map((column) => escapeCsvCell(column.header)).join(",");

  const body = rows.map((row) =>
    columns
      .map((column) => {
        const raw = column.value(row);
        if (safeMode && column.sensitive) {
          return escapeCsvCell(maskIdentifier(raw));
        }
        return escapeCsvCell(raw);
      })
      .join(","),
  );

  return [header, ...body].join("\r\n") + "\r\n";
}

/**
 * Mask an identifier so it can be shared safely.
 *
 * An email keeps its first character and its domain; a long id keeps its
 * first and last few characters; a short value is fully masked.
 */
export function maskIdentifier(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";

  const text = String(value);

  if (text.includes("@")) {
    const [local, domain] = text.split("@");
    const head = (local ?? "").slice(0, 1);
    return `${head}${"*".repeat(Math.max(3, (local ?? "").length - 1))}@${domain ?? ""}`;
  }

  if (text.length <= 6) return "*".repeat(text.length);

  return `${text.slice(0, 3)}${"*".repeat(Math.max(3, text.length - 6))}${text.slice(-3)}`;
}

/**
 * A filename that is safe on every platform and states the period.
 */
export function exportFilename(
  kind: string,
  start: string,
  end: string,
  extension = "csv",
): string {
  const safeKind = kind
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `ccm-${safeKind || "export"}-${start}_to_${end}.${extension}`;
}
