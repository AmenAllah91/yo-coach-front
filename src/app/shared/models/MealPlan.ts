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
  imageUrl?: string;
  general?: boolean | number;
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
  servingSize?: number;
  servingDescription?: string;
  servingUnit?: string;
  calories?: number;
  image?: string;
}

/* ================================
   Food
=================================*/
export interface Food {
  id?: string;
  name: string;
  quantity: number;
  unit: string;
  foodRef?: FoodRef | null;
  manual?: boolean;
  calories?: number | null;
  protein?: number | null;
  carbohydrates?: number | null;
  carbs?: number | null;
  fat?: number | null;
}

/* ================================
   Meal
=================================*/
export interface Meal {
  id?: string;
  name: string;
  mealType?: string;
  mealTime?: string;
  servings?: number;
  totalTimeMinutes?: number | null;
  coverImage?: string | null;
  directions?: string[];
  template?: boolean;
  draft?: boolean;
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
  publishedWeeks?: number[];
  durationWeeks?: number;
  publicationWorkflow?: boolean;
  id?: string;
  name: string;
  details?: string;
  startDate: string;
  endDate: string;
  trackingMode: MacroTrackingMode | null;
  mealDays: MealDay[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  coach: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any;
  date?: string | null;
  title?: string;
  nutritionPlanMode?: 'APP' | 'FILE' | string;
  resourceType?: 'PDF' | 'EXCEL' | string;
  fileName?: string;
  originalFileName?: string;
  fileUrl?: string;
  fileContentType?: string;
  fileSizeBytes?: number;
  fileUploadedAt?: string;
}
