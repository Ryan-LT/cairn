export type CsvCell = string | number | null | undefined;

/** Spreadsheet apps run cells starting with these as formulas; text that does gets a leading apostrophe. */
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: CsvCell, delimiter: string): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return text.includes(delimiter) || /["\n\r]/.test(text) || text !== text.trim() ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Rows to CSV text (CRLF line ends). With `bom`, Excel opens UTF-8 (Vietnamese
 * accents) correctly. Use `;` for Excel set to a locale with decimal commas.
 */
export function toCsv(rows: CsvCell[][], opts: { delimiter?: "," | ";"; bom?: boolean } = {}): string {
  const delimiter = opts.delimiter ?? ",";
  const body = rows.map((r) => r.map((v) => cell(v, delimiter)).join(delimiter)).join("\r\n");
  return (opts.bom === false ? "" : "﻿") + body;
}
