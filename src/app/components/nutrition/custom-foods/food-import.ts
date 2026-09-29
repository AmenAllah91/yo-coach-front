import * as XLSX from 'xlsx';
import { FoodServing } from '@shared/models/MealPlan';
import {
  cleanUnit,
  MAX_SERVINGS,
  SERVING_EXTRAS,
  SERVING_LABELS,
  SERVING_MACROS,
  ServingDraft,
  servingErrors,
  servingFromDraft,
  ServingValueField,
} from '../food-servings/food-serving-rules';

export const MAX_IMPORT_FOODS = 500;
export const MAX_FOOD_NAME_LENGTH = 100;

type ImportField = 'name' | 'size' | 'unit' | ServingValueField;

interface ImportColumn {
  key: ImportField;
  label: string;
  suffix?: string;
  required: boolean;
}

export const IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'name', label: 'FOOD_IMPORT_COL_NAME', required: true },
  { key: 'size', label: 'FOOD_SERVING_QUANTITY', required: true },
  { key: 'unit', label: 'FOOD_SERVING_UNIT', required: true },
  ...SERVING_MACROS.map((key) => ({ key, label: SERVING_LABELS[key], suffix: key === 'energy' ? 'kcal' : 'g', required: true })),
  ...SERVING_EXTRAS.map((key) => ({ key, label: SERVING_LABELS[key], suffix: 'g', required: false })),
];

export interface ImportRowError {
  row: number;
  name: string;
  field: string;
  error: string;
}

export interface ImportFood {
  name: string;
  rows: number[];
  servings: FoodServing[];
  valid: boolean;
}

export interface FoodImportPreview {
  foods: ImportFood[];
  errors: ImportRowError[];
  fileError: string | null;
  validFoods: number;
  validServings: number;
  invalidFoods: number;
  errorRows: number;
}

export interface FoodImportReport {
  created: number;
  duplicates: number;
  rejected: number;
  entries: { name: string; status: 'CREATED' | 'DUPLICATE' | 'INVALID'; message: string | null }[];
}

export function importFieldLabel(field: string): string {
  if (field === 'servings') return 'FOOD_IMPORT_COL_SERVINGS';
  return IMPORT_COLUMNS.find((column) => column.key === field)?.label ?? field;
}

export function importHeaders(translate: (key: string) => string): string[] {
  return IMPORT_COLUMNS.map((column) => {
    const label = translate(column.label) + (column.suffix ? ` (${column.suffix})` : '');
    return column.required ? `${label} *` : label;
  });
}

export function foodImportTemplate(translate: (key: string) => string): XLSX.WorkBook {
  const headers = importHeaders(translate);
  const widths = headers.map((header) => ({ wch: Math.max(12, header.length + 2) }));
  const foods = XLSX.utils.aoa_to_sheet([headers]);
  foods['!cols'] = widths;
  const guide = XLSX.utils.aoa_to_sheet([
    [translate('FOOD_IMPORT_GUIDE_TITLE')],
    [translate('FOOD_IMPORT_GUIDE_RULE_1')],
    [translate('FOOD_IMPORT_GUIDE_RULE_2')],
    [translate('FOOD_IMPORT_GUIDE_RULE_3')],
    [translate('FOOD_IMPORT_GUIDE_RULE_4')],
    [translate('FOOD_IMPORT_GUIDE_RULE_5')],
    [],
    [translate('FOOD_IMPORT_GUIDE_EXAMPLE')],
    headers,
    [translate('FOOD_IMPORT_EXAMPLE_EGGS'), 100, 'g', 143, 12.6, 0.7, 9.5],
    [translate('FOOD_IMPORT_EXAMPLE_EGGS'), 1, translate('FOOD_IMPORT_EXAMPLE_EGG'), 72, 6.3, 0.4, 4.8],
    [translate('FOOD_IMPORT_EXAMPLE_EGGS'), 4, translate('FOOD_IMPORT_EXAMPLE_EGG_PLURAL'), 288, 25.2, 1.6, 19.2],
    [translate('FOOD_IMPORT_EXAMPLE_RICE'), 100, 'g', 130, 2.7, 28, 0.3, 0.4],
  ]);
  guide['!cols'] = widths;
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, foods, translate('FOOD_IMPORT_SHEET_FOODS'));
  XLSX.utils.book_append_sheet(workbook, guide, translate('FOOD_IMPORT_SHEET_GUIDE'));
  return workbook;
}

function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

function isHeader(row: unknown[] | undefined): boolean {
  return !!row && row.length >= 7 && typeof row[0] === 'string' && !!text(row[0]) && typeof row[3] === 'string';
}

export function parseFoodRows(rows: unknown[][]): FoodImportPreview {
  const empty = { foods: [], errors: [], validFoods: 0, validServings: 0, invalidFoods: 0, errorRows: 0 };
  if (!isHeader(rows[0])) return { ...empty, fileError: 'FOOD_IMPORT_BAD_TEMPLATE' };
  const foods = new Map<string, ImportFood>();
  const errors: ImportRowError[] = [];
  rows.slice(1).forEach((cells, index) => {
    const row = index + 2;
    const values = (cells || []).map(text);
    if (values.every((value) => !value)) return;
    const name = cleanUnit(values[0]);
    if (!name) {
      errors.push({ row, name: '', field: 'name', error: 'FOOD_VALID_REQUIRED' });
      return;
    }
    const key = name.toLowerCase();
    const food = foods.get(key) ?? { name, rows: [], servings: [], valid: true };
    foods.set(key, food);
    food.rows.push(row);
    const draft = {} as ServingDraft;
    IMPORT_COLUMNS.forEach((column, position) => {
      if (column.key !== 'name') draft[column.key] = values[position] ?? '';
    });
    const rowErrors = servingErrors(draft, food.servings);
    if (Array.from(name).length > MAX_FOOD_NAME_LENGTH) rowErrors['name'] = 'FOOD_VALID_NAME_LENGTH';
    if (food.rows.length > MAX_SERVINGS) rowErrors['servings'] = 'FOOD_IMPORT_TOO_MANY_SERVINGS';
    const fields = Object.keys(rowErrors);
    if (fields.length) {
      food.valid = false;
      fields.forEach((field) => errors.push({ row, name, field, error: rowErrors[field] }));
      return;
    }
    food.servings.push(servingFromDraft(draft));
  });
  const list = [...foods.values()];
  const valid = list.filter((food) => food.valid);
  return {
    foods: list,
    errors,
    fileError: !list.length && !errors.length ? 'FOOD_IMPORT_EMPTY' : valid.length > MAX_IMPORT_FOODS ? 'FOOD_IMPORT_TOO_MANY_FOODS' : null,
    validFoods: valid.length,
    validServings: valid.reduce((total, food) => total + food.servings.length, 0),
    invalidFoods: list.length - valid.length,
    errorRows: new Set(errors.map((error) => error.row)).size,
  };
}
