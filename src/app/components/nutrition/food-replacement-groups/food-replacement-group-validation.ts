import { FoodReplacementGroupItem } from '../../../service/food-replacement-groups.service';

export const REPLACEMENT_GROUP_NAME_MAX_LENGTH = 100;
export const REPLACEMENT_GROUP_GUIDANCE_MAX_LENGTH = 500;

export function isReplacementGroupNameValid(name: string): boolean {
  const value = name.trim();
  return value.length > 0 && value.length <= REPLACEMENT_GROUP_NAME_MAX_LENGTH;
}

export function isReplacementGroupGuidanceValid(guidance: string): boolean {
  return guidance.trim().length <= REPLACEMENT_GROUP_GUIDANCE_MAX_LENGTH;
}

export function isReplacementGroupFoodValid(food: FoodReplacementGroupItem): boolean {
  return Boolean(food.foodRefId?.trim()) &&
    Number.isFinite(Number(food.quantity)) &&
    Number(food.quantity) > 0 &&
    Boolean(food.unit?.trim());
}

export function hasUniqueReplacementGroupFoods(foods: FoodReplacementGroupItem[]): boolean {
  const ids = foods.map((food) => food.foodRefId?.trim()).filter(Boolean);
  return ids.length === new Set(ids).size;
}

export function isReplacementGroupValid(
  name: string,
  guidance: string,
  foods: FoodReplacementGroupItem[],
): boolean {
  return isReplacementGroupNameValid(name) &&
    isReplacementGroupGuidanceValid(guidance) &&
    foods.length >= 2 &&
    foods.every(isReplacementGroupFoodValid) &&
    hasUniqueReplacementGroupFoods(foods);
}
