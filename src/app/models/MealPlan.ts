/* ================================
   MacroTargets
=================================*/
export interface MacroTargets {
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

/* ================================
   FoodRef
=================================*/
export interface FoodRef {
  id?: string;
  name: string;
  energy: number;
  fat: number;
  saturatedFat: number;
  polyunsaturatedFat: number;
  monounsaturatedFat: number;
  tranFat: number;
  cholesterol: number;
  sodium: number;
  potassium: number;
  carbohydrates: number;
  fiber: number;
  sugar: number;
  protein: number;
  vitaminA: number;
  vitaminC: number;
  calcium: number;
  iron: number;
  omega3: number;
  zinc: number;
}

/* ================================
   Food
=================================*/
export interface Food {
  id?: string;
  name: string;
  quantity: number;
  unit: string;
  foodRef: FoodRef;
}

/* ================================
   Meal
=================================*/
export interface Meal {
  id?: string;
  name: string;
  mealTargets?: MacroTargets | null;
  foods: Food[];
}

/* ================================
   MealDay
=================================*/
export interface MealDay {
  id?: string;
  date: string;
  dayOfWeek: string;
  cheatMeal: boolean;
  refeedDay: boolean;
  title?: string;
  dayTargets?: MacroTargets | null;
  meals: Meal[];
  description?: string;
  showDescription?: boolean;
  name?: boolean;
}

/* ================================
   MealPlan
=================================*/
export type MacroTrackingMode = 'TOTAL_FOR_DAY' | 'EACH_MEAL';

export interface MealPlan {
  id?: string;
  name: string;
  details?: string;
  startDate: string;
  endDate: string;
  trackingMode: MacroTrackingMode;
  mealDays: MealDay[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  coach: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any;
  date?: string;
  title?: string;
}
