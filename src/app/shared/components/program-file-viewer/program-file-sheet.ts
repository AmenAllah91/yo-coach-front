import * as XLSX from 'xlsx';

/**
 * One sheet of an Excel program file, ready to draw (audit PDF/Excel 2026-11-23, lot 2): the real row numbers (empty
 * rows are kept), merged cells as one cell, the cell text formatted as Excel shows it (dates included), and a limit
 * that is said, never silent.
 */
export interface SheetCell { text: string; colspan: number; rowspan: number; }
export interface SheetRow { number: number; cells: SheetCell[]; }
export interface SheetView {
  columns: string[];
  rows: SheetRow[];
  /** Rows of the sheet past the limit (0 when everything is shown). */
  hiddenRows: number;
  /** Columns past the limit. */
  hiddenColumns: number;
}

export const SHEET_MAX_ROWS = 500;
export const SHEET_MAX_COLUMNS = 40;

/** Reads at most {@link SHEET_MAX_ROWS} + 1 rows of each sheet: a 20 000-row file no longer freezes the tab. */
export function readWorkbook(data: ArrayBuffer): XLSX.WorkBook {
  return XLSX.read(data, { type: 'array', sheetRows: SHEET_MAX_ROWS + 1, cellDates: false, cellNF: true, cellStyles: false });
}

export function sheetView(sheet: XLSX.WorkSheet | undefined): SheetView {
  const empty: SheetView = { columns: [], rows: [], hiddenRows: 0, hiddenColumns: 0 };
  if (!sheet || !sheet['!ref']) return empty;
  const range = XLSX.utils.decode_range(sheet['!ref']);
  // With sheetRows, « !fullref » keeps the size of the whole sheet.
  const full = XLSX.utils.decode_range((sheet['!fullref'] as string) || sheet['!ref']);
  const lastRow = Math.min(range.e.r, range.s.r + SHEET_MAX_ROWS - 1);
  const lastColumn = Math.min(range.e.c, range.s.c + SHEET_MAX_COLUMNS - 1);

  // Merged areas: the first cell spans the area, the others are not drawn.
  const covered = new Set<string>();
  const spans = new Map<string, { colspan: number; rowspan: number }>();
  for (const merge of (sheet['!merges'] || []) as XLSX.Range[]) {
    if (merge.s.r > lastRow || merge.s.c > lastColumn) continue;
    const endRow = Math.min(merge.e.r, lastRow);
    const endColumn = Math.min(merge.e.c, lastColumn);
    spans.set(`${merge.s.r}:${merge.s.c}`, { rowspan: endRow - merge.s.r + 1, colspan: endColumn - merge.s.c + 1 });
    for (let r = merge.s.r; r <= endRow; r++) {
      for (let c = merge.s.c; c <= endColumn; c++) {
        if (r !== merge.s.r || c !== merge.s.c) covered.add(`${r}:${c}`);
      }
    }
  }

  const columns: string[] = [];
  for (let c = range.s.c; c <= lastColumn; c++) columns.push(XLSX.utils.encode_col(c));

  const rows: SheetRow[] = [];
  for (let r = range.s.r; r <= lastRow; r++) {
    const cells: SheetCell[] = [];
    for (let c = range.s.c; c <= lastColumn; c++) {
      if (covered.has(`${r}:${c}`)) continue;
      const cell = sheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
      const span = spans.get(`${r}:${c}`);
      cells.push({ text: cellText(cell), colspan: span?.colspan ?? 1, rowspan: span?.rowspan ?? 1 });
    }
    rows.push({ number: r + 1, cells });
  }

  // The trailing empty rows are dropped (Excel often keeps formatting far below the content).
  while (rows.length && rows[rows.length - 1].cells.every(cell => !cell.text.trim())) rows.pop();

  return {
    columns,
    rows,
    hiddenRows: Math.max(0, full.e.r - lastRow),
    hiddenColumns: Math.max(0, full.e.c - lastColumn),
  };
}

/** The text Excel shows: its formatted value (« 12/03/2026 », « 45 % »), else the raw value. */
export function cellText(cell: XLSX.CellObject | undefined): string {
  if (!cell || cell.v === undefined || cell.v === null) return '';
  if (cell.w !== undefined && cell.w !== null) return String(cell.w);
  try {
    return XLSX.utils.format_cell(cell);
  } catch {
    return String(cell.v);
  }
}
