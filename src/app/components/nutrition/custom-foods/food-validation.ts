export const foodNumericFields = ['servingSize', 'calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'polyols', 'saturated', 'polyunsaturated', 'monounsaturated', 'salt'] as const;
export type FoodDraft = Record<typeof foodNumericFields[number] | 'foodName' | 'servingDescription', string>;
export function foodNumber(value: string): number | null {
  const text = value.trim();
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?$/.test(text)) return null;
  const number = Number(text.replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}
export function foodErrors(draft: FoodDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!draft.foodName.trim()) errors['foodName'] = 'FOOD_VALID_REQUIRED';
  else if (Array.from(draft.foodName.trim()).length > 100) errors['foodName'] = 'FOOD_VALID_NAME_LENGTH';
  if (!draft.servingDescription.trim()) errors['servingDescription'] = 'FOOD_VALID_REQUIRED';
  for (const key of foodNumericFields) {
    const required = ['servingSize', 'calories', 'protein', 'carbs', 'fat'].includes(key);
    if (!draft[key].trim()) { if (required) errors[key] = 'FOOD_VALID_REQUIRED'; continue; }
    const value = foodNumber(draft[key]);
    if (value === null) errors[key] = 'FOOD_VALID_NUMBER';
    else if (key === 'servingSize' ? value <= 0 : value < 0) errors[key] = key === 'servingSize' ? 'FOOD_VALID_POSITIVE' : 'FOOD_VALID_NONNEGATIVE';
  }
  const fats = ['saturated', 'polyunsaturated', 'monounsaturated'] as const;
  if (!errors['fat'] && fats.every(key => !errors[key])) {
    const total = foodNumber(draft.fat);
    const sum = fats.reduce((value, key) => value + (foodNumber(draft[key]) ?? 0), 0);
    // Allow only floating point rounding at the equality boundary.
    if (total !== null && (!Number.isFinite(sum) || sum - total > Number.EPSILON * Math.max(1, total, sum) * 4)) {
      errors['fat'] = 'FOOD_VALID_FAT_SUM';
      fats.forEach(key => { if (draft[key].trim()) errors[key] = 'FOOD_VALID_FAT_SUM'; });
    }
  }
  return errors;
}
export function foodImageError(file: { name: string; type: string; size: number }): string {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(extension) || (file.type && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) return 'FOOD_VALID_IMAGE_TYPE';
  return file.size > 10 * 1024 * 1024 ? 'FOOD_VALID_IMAGE_SIZE' : '';
}
