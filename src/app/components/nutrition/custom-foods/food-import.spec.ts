import * as XLSX from 'xlsx';
import { foodImportTemplate, importHeaders, parseFoodRows } from './food-import';

describe('Food Excel import', () => {
  const t = (key: string) => key;
  const header = importHeaders(t);
  const row = (name: string, size: unknown, unit: string, kcal: unknown, protein = 1, carbs = 1, fat = 1) => [name, size, unit, kcal, protein, carbs, fat];

  it('builds a template whose first sheet is an empty food sheet', () => {
    const workbook = foodImportTemplate(t);
    expect(workbook.SheetNames).toEqual(['FOOD_IMPORT_SHEET_FOODS', 'FOOD_IMPORT_SHEET_GUIDE']);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1, raw: true, defval: '' });
    expect(rows).toEqual([header]);
    expect(header.slice(0, 4)).toEqual(['FOOD_IMPORT_COL_NAME *', 'FOOD_SERVING_QUANTITY *', 'FOOD_SERVING_UNIT *', 'CALORIES (kcal) *']);
    expect(parseFoodRows(rows).fileError).toBe('FOOD_IMPORT_EMPTY');
  });

  it('groups rows by name with the first row as main serving', () => {
    const preview = parseFoodRows([
      header,
      row('Œufs', 100, 'g', 143, 12.6, 0.7, 9.5),
      row('Riz basmati', '100', 'g', '130', 2.7, 28, 0.3),
      [],
      row('  œufs ', 1, 'œuf', '72', 6.3, 0.4, 4.8),
      row('Œufs', '4', 'œufs', '288,5', 25.2, 1.6, 19.2),
    ]);
    expect(preview.fileError).toBeNull();
    expect(preview.errors).toEqual([]);
    expect(preview.validFoods).toBe(2);
    expect(preview.validServings).toBe(4);
    const eggs = preview.foods[0];
    expect(eggs.name).toBe('Œufs');
    expect(eggs.rows).toEqual([2, 5, 6]);
    expect(eggs.servings.map((s) => `${s.size} ${s.unit}`)).toEqual(['100 g', '1 œuf', '4 œufs']);
    expect(eggs.servings[2].energy).toBe(288.5);
  });

  it('reports each row in error and leaves its food out', () => {
    const preview = parseFoodRows([
      header,
      row('Œufs', 100, 'g', 143),
      row('Œufs', 1, 'œuf', ''),
      row('Skyr', 1, 'pot', 90),
      row('Skyr', 1, 'POT', 90),
      row('', 1, 'pot', 90),
      row('Riz', 100, 'g', -5),
      row('Pâtes', 100, 'g', 150),
    ]);
    expect(preview.validFoods).toBe(1);
    expect(preview.foods.filter((food) => food.valid).map((food) => food.name)).toEqual(['Pâtes']);
    expect(preview.invalidFoods).toBe(3);
    expect(preview.errorRows).toBe(4);
    expect(preview.errors).toEqual([
      { row: 3, name: 'Œufs', field: 'energy', error: 'FOOD_VALID_REQUIRED' },
      { row: 5, name: 'Skyr', field: 'unit', error: 'FOOD_VALID_SERVING_DUPLICATE' },
      { row: 6, name: '', field: 'name', error: 'FOOD_VALID_REQUIRED' },
      { row: 7, name: 'Riz', field: 'energy', error: 'FOOD_VALID_NONNEGATIVE' },
    ]);
  });

  it('refuses a sheet that does not follow the template', () => {
    expect(parseFoodRows([row('Œufs', 100, 'g', 143)]).fileError).toBe('FOOD_IMPORT_BAD_TEMPLATE');
    expect(parseFoodRows([]).fileError).toBe('FOOD_IMPORT_BAD_TEMPLATE');
  });
});
