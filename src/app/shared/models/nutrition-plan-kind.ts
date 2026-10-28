/** The 3 kinds of nutrition plan built in the app; each one opens its own editor. */
export type NutritionPlanKind = 'FOODS' | 'DAY_MACROS' | 'MEAL_MACROS';

/**
 * Kind of a plan from its content. The web saves a plan with foods without tracking mode, the mobile app saves it
 * as EACH_MEAL (like a plan of macros per meal): the foods tell the two apart.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function nutritionPlanKind(plan: any): NutritionPlanKind {
  if (plan?.trackingMode === 'TOTAL_FOR_DAY') return 'DAY_MACROS';
  if (plan?.trackingMode === 'EACH_MEAL' || plan?.trackingMode === 'EACH_MEAL_NO_FOOD') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasFoods = (plan?.mealDays || []).some((day: any) => (day?.meals || []).some((meal: any) => (meal?.foods || []).length > 0));
    return hasFoods ? 'FOODS' : 'MEAL_MACROS';
  }
  return 'FOODS';
}
