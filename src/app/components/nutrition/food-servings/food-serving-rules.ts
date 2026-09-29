import { FoodServing } from '@shared/models/MealPlan';
import { foodNumber } from '../custom-foods/food-validation';

export const MAX_SERVINGS = 20;
export const MAX_UNIT_LENGTH = 40;
export const SERVING_MACROS = ['energy', 'protein', 'carbohydrates', 'fat'] as const;
export const SERVING_EXTRAS = ['fiber', 'sugar', 'polyols', 'saturatedFat', 'polyunsaturatedFat', 'monounsaturatedFat', 'sodium'] as const;
export const SERVING_LABELS: Record<ServingValueField, string> = {
  energy: 'CALORIES', protein: 'PROTEIN', carbohydrates: 'CARBS', fat: 'FAT', fiber: 'FIBER', sugar: 'SUGAR',
  polyols: 'POLYOLS', saturatedFat: 'SATURATED_FAT', polyunsaturatedFat: 'POLYUNSATURATED_FAT',
  monounsaturatedFat: 'MONOUNSATURATED_FAT', sodium: 'SALT',
};

export type ServingValueField = typeof SERVING_MACROS[number] | typeof SERVING_EXTRAS[number];
export type ServingDraft = Record<'size' | 'unit' | ServingValueField, string>;

export interface Prefill {
  source: FoodServing;
  factor: number;
  values: Record<ServingValueField, number | null>;
}

const VALUE_FIELDS: ServingValueField[] = [...SERVING_MACROS, ...SERVING_EXTRAS];

export function cleanUnit(unit: unknown): string {
  return String(unit ?? '').trim().replace(/\s+/g, ' ');
}

export function normalizeUnit(unit: unknown): string {
  return cleanUnit(unit).toLowerCase();
}

export function servingKey(size: unknown, unit: unknown): string {
  return `${Number(size)}|${normalizeUnit(unit)}`;
}

export function editableUnit(unit: unknown, pieceLabel: string): string {
  const value = cleanUnit(unit);
  const key = value.toLowerCase();
  if (key === 'grams' || key === 'gram') return 'g';
  if (key === 'qty') return pieceLabel;
  return value;
}

export function draftOf(serving: Partial<FoodServing> | null | undefined, unit: string): ServingDraft {
  const text = (value: unknown) => (value === null || value === undefined ? '' : String(value));
  const draft = { size: text(serving?.size), unit } as ServingDraft;
  for (const key of VALUE_FIELDS) draft[key] = text((serving as any)?.[key]);
  return draft;
}

export function servingFromDraft(draft: ServingDraft, id?: string | null): FoodServing {
  const serving: any = { size: foodNumber(draft.size), unit: cleanUnit(draft.unit) };
  if (id) serving.id = id;
  for (const key of VALUE_FIELDS) serving[key] = draft[key].trim() ? foodNumber(draft[key]) : null;
  return serving;
}

export function servingErrors(draft: ServingDraft, others: FoodServing[]): Record<string, string> {
  const errors: Record<string, string> = {};
  const size = foodNumber(draft.size);
  if (!draft.size.trim()) errors['size'] = 'FOOD_VALID_REQUIRED';
  else if (size === null) errors['size'] = 'FOOD_VALID_NUMBER';
  else if (size <= 0) errors['size'] = 'FOOD_VALID_POSITIVE';
  const unit = cleanUnit(draft.unit);
  if (!unit) errors['unit'] = 'FOOD_VALID_REQUIRED';
  else if (unit.length > MAX_UNIT_LENGTH) errors['unit'] = 'FOOD_VALID_UNIT_LENGTH';
  for (const key of VALUE_FIELDS) {
    const required = (SERVING_MACROS as readonly string[]).includes(key);
    if (!draft[key].trim()) {
      if (required) errors[key] = 'FOOD_VALID_REQUIRED';
      continue;
    }
    const value = foodNumber(draft[key]);
    if (value === null) errors[key] = 'FOOD_VALID_NUMBER';
    else if (value < 0) errors[key] = 'FOOD_VALID_NONNEGATIVE';
  }
  const fats = ['saturatedFat', 'polyunsaturatedFat', 'monounsaturatedFat'] as const;
  if (!errors['fat'] && fats.every((key) => !errors[key])) {
    const sum = fats.reduce((total, key) => total + (foodNumber(draft[key]) ?? 0), 0);
    const fat = foodNumber(draft.fat);
    if (fat !== null && sum - fat > Number.EPSILON * Math.max(1, fat, sum) * 4) errors['fat'] = 'FOOD_VALID_FAT_SUM';
  }
  if (!errors['size'] && !errors['unit'] && others.some((other) => servingKey(other.size, other.unit) === servingKey(size, unit))) {
    errors['unit'] = 'FOOD_VALID_SERVING_DUPLICATE';
  }
  return errors;
}

function stem(unit: unknown): string {
  return normalizeUnit(unit).replace(/[sx]$/, '');
}

export function prefillFrom(others: FoodServing[], size: number | null, unit: string): Prefill | null {
  if (size === null || !(size > 0) || !stem(unit)) return null;
  const source = others.find((other) => Number(other.size) > 0 && stem(other.unit) === stem(unit));
  if (!source) return null;
  const factor = size / Number(source.size);
  const values = {} as Record<ServingValueField, number | null>;
  for (const key of VALUE_FIELDS) {
    const value = (source as any)[key];
    if (value === null || value === undefined || !Number.isFinite(Number(value))) values[key] = null;
    else if (key === 'energy') values[key] = Math.round(Number(value) * factor);
    else values[key] = Math.round(Number(value) * factor * 10) / 10;
  }
  return { source, factor, values };
}
