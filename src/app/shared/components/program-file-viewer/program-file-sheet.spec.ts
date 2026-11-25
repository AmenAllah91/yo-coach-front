import * as XLSX from 'xlsx';
import { SHEET_MAX_ROWS, readWorkbook, sheetView } from './program-file-sheet';

/** Audit PDF/Excel 2026-11-23, lot 2: an Excel program shown as the coach wrote it. */
describe('program-file-sheet', () => {
  function workbook(rows: unknown[][], merges: XLSX.Range[] = [], dates = false): XLSX.WorkBook {
    const sheet = XLSX.utils.aoa_to_sheet(rows, { cellDates: dates });
    if (merges.length) sheet['!merges'] = merges;
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Semaine 1');
    const data = XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    return readWorkbook(data);
  }

  it('keeps the real row numbers (empty rows inside the sheet stay)', () => {
    const view = sheetView(workbook([['Lundi', 'Squat'], [], ['Mercredi', 'Développé']]).Sheets['Semaine 1']);
    expect(view.rows.map(row => row.number)).toEqual([1, 2, 3]);
    expect(view.rows[2].cells.map(cell => cell.text)).toEqual(['Mercredi', 'Développé']);
    expect(view.columns).toEqual(['A', 'B']);
    expect(view.hiddenRows).toBe(0);
  });

  it('draws a merged area as one cell', () => {
    const view = sheetView(workbook(
      [['Semaine 1', '', ''], ['Lundi', 'Squat', '4x8']],
      [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }],
    ).Sheets['Semaine 1']);
    expect(view.rows[0].cells.length).toBe(1);
    expect(view.rows[0].cells[0]).toEqual({ text: 'Semaine 1', colspan: 3, rowspan: 1 });
    expect(view.rows[1].cells.length).toBe(3);
  });

  it('shows a date as a date, not as a number', () => {
    const view = sheetView(workbook([['Début', new Date(Date.UTC(2026, 10, 30))]], [], true).Sheets['Semaine 1']);
    const text = view.rows[0].cells[1].text;
    expect(text).not.toMatch(/^4\d{4}$/);
    expect(text).toMatch(/30|2026/);
  });

  it('says how many rows are not shown past the limit', () => {
    const rows = Array.from({ length: SHEET_MAX_ROWS + 40 }, (_, index) => [`Ligne ${index + 1}`]);
    const view = sheetView(workbook(rows).Sheets['Semaine 1']);
    expect(view.rows.length).toBe(SHEET_MAX_ROWS);
    expect(view.hiddenRows).toBe(40);
  });
});
