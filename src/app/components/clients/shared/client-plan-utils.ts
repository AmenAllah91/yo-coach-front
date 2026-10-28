/**
 * Derived values shared by the client Home, Workout and Nutrition pages. Same rules as the mobile app
 * (yo-coach-mobile lib/utils/client_plan_utils.dart and the Meal / FoodItem / NutritionDay models), on the
 * raw plans returned by the API.
 */

export interface NutritionTotals { calories: number; protein: number; carbs: number; fat: number; }

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Local day of an API date ("2026-10-22", "2026-10-22T00:00:00Z" or {$date}). */
export function planDate(value: any): Date | null {
  const raw = value && typeof value === 'object' && '$date' in value ? value.$date : value;
  if (!raw) return null;
  const text = String(raw);
  const plain = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (plain) return new Date(Number(plain[1]), Number(plain[2]) - 1, Number(plain[3]));
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

export function capitalizeFirst(value: string | null | undefined): string {
  const text = (value ?? '').trim();
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

export function capitalizeSentences(value: string | null | undefined): string {
  const text = (value ?? '').trim();
  let upperNext = true;
  let out = '';
  for (const char of text) {
    if (upperNext && /\p{L}/u.test(char)) { out += char.toUpperCase(); upperNext = false; continue; }
    out += char;
    if ('.!?'.includes(char)) upperNext = true;
  }
  return out;
}

export function titleCase(value: string | null | undefined): string {
  const text = (value ?? '').trim();
  return text.split(' ').map(word => word.split('-')
    .map(part => part ? part[0].toUpperCase() + part.slice(1) : part).join('-')).join(' ');
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.length ? words.slice(0, 2).map(word => word[0].toUpperCase()).join('') : '?';
}

// ---------------------------------------------------------------------------
// Workout
// ---------------------------------------------------------------------------

export function allExercises(day: any): any[] {
  return (day?.workoutSessions || []).flatMap((session: any) => session?.exercises || []);
}

export function isRestDay(day: any): boolean {
  return day?.restDay === true || day?.isRestDay === true;
}

/** Rest day or no exercise: nothing to start, log, complete or miss (ClientDayRules.nothingToLog on the server). */
export function nothingToLog(day: any): boolean {
  return isRestDay(day) || allExercises(day).length === 0;
}

export function workoutSetCount(day: any): number {
  return allExercises(day).reduce((total, exercise) => total + Math.max((exercise?.sets || []).length, 1), 0);
}

/** Rough session length in minutes (work time + prescribed rest), rounded to the nearest 5 minutes. */
export function estimatedWorkoutMinutes(day: any): number {
  let seconds = 0;
  for (const exercise of allExercises(day)) {
    const sets: any[] = exercise?.sets || [];
    if (!sets.length) { seconds += (Number(exercise?.duration) || 1) * 60; continue; }
    for (const set of sets) {
      const duration = Number(set?.duration) || 0;
      const work = duration > 0 ? duration * 60 : 45;
      const rest = (Number(set?.restMin) || 0) * 60 + (Number(set?.restSec) || 0);
      seconds += work + (rest > 0 ? rest : 60);
    }
  }
  const minutes = Math.round(seconds / 60);
  if (minutes <= 0) return 0;
  return Math.min(Math.max(Math.round(minutes / 5) * 5, 5), 600);
}

/** 1-based week of the program the given date belongs to. */
export function programWeek(start: any, date: Date): number {
  const s = planDate(start);
  if (!s) return 1;
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.round((d.getTime() - s.getTime()) / 86_400_000);
  return diff < 0 ? 1 : Math.floor(diff / 7) + 1;
}

/** WorkoutDay.displayTitle on mobile. */
export function workoutDisplayTitle(day: any, fr = false): string {
  const title = String(day?.title ?? '').trim();
  const name = String(day?.name ?? '').trim();
  if (title && !title.toLowerCase().startsWith('day ')) return title;
  if (name && !name.toLowerCase().startsWith('day ')) return name;
  if (day?.dayNumber != null && day.dayNumber !== '') return `${fr ? 'Jour' : 'Day'} ${day.dayNumber}`;
  return String(day?.dayOfWeek ?? '');
}

export function workoutDayTitle(day: any, fr = false): string {
  const title = titleCase(workoutDisplayTitle(day, fr));
  const lower = title.toLowerCase();
  if (day?.dayNumber != null && day.dayNumber !== '' && !lower.startsWith('day') && !lower.startsWith('jour')) {
    return `${fr ? 'Jour' : 'Day'} ${day.dayNumber} · ${title}`;
  }
  return title;
}

export function youtubeVideoId(url: string): string | null {
  try {
    const uri = new URL(url);
    const host = uri.hostname.toLowerCase();
    const segments = uri.pathname.split('/').filter(Boolean);
    if (host.includes('youtu.be') && segments.length) return segments[0];
    if (host.includes('youtube.com')) {
      const v = uri.searchParams.get('v');
      if (v) return v;
      for (const marker of ['shorts', 'embed', 'live']) {
        const index = segments.indexOf(marker);
        if (index >= 0 && index + 1 < segments.length) return segments[index + 1];
      }
    }
  } catch { /* not an absolute url: the regular expression below */ }
  const match = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([^"&?/\s]{6,})/i.exec(url);
  return match ? match[1] : null;
}

/** Best thumbnail for an exercise: YouTube preview when a video is attached, otherwise the uploaded image. */
export function exerciseCardImage(exercise: any): string | null {
  const clean = (value: any) => { const text = String(value ?? '').trim(); return text || null; };
  const video = clean(exercise?.videoLink ?? exercise?.exerciseRef?.videoLink);
  const youtube = video ? youtubeVideoId(video) : null;
  if (youtube) return `https://img.youtube.com/vi/${youtube}/hqdefault.jpg`;
  return clean(exercise?.imageUrl ?? exercise?.exerciseRef?.imageUrl);
}

export function workoutThumbnails(day: any, max = 3): string[] {
  const urls: string[] = [];
  for (const exercise of allExercises(day)) {
    const url = exerciseCardImage(exercise);
    if (url) urls.push(url);
    if (urls.length >= max) break;
  }
  return urls;
}

// ---------------------------------------------------------------------------
// Nutrition
// ---------------------------------------------------------------------------

const num = (value: any, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/** FoodItem.fromJson macros on mobile: stored values, else computed from the serving and the quantity. */
export function foodMacros(food: any): NutritionTotals {
  let protein = num(food?.protein ?? food?.proteinG ?? food?.totalProtein);
  let carbs = num(food?.carbs ?? food?.carbsG ?? food?.carbohydrates ?? food?.totalCarbs);
  let fat = num(food?.fat ?? food?.fatG ?? food?.totalFat);
  let calories = num(food?.calories ?? food?.energy ?? food?.totalCalories);
  const serving = food?.serving && typeof food.serving === 'object' ? food.serving : null;
  const values = serving ?? (food?.foodRef && typeof food.foodRef === 'object' ? food.foodRef : null);
  if (values && !protein && !carbs && !fat && !calories) {
    const size = num(serving ? values.size : values.servingSize, 100);
    const safeSize = size > 0 ? size : 100;
    const quantity = num(food?.quantity);
    const factor = (quantity > 0 ? quantity : safeSize) / safeSize;
    protein = num(values.protein) * factor;
    carbs = num(values.carbohydrates ?? values.carbs) * factor;
    fat = num(values.fat) * factor;
    calories = num(values.energy ?? values.calories) * factor;
  }
  return { calories, protein, carbs, fat };
}

/** Meal macros on mobile: the meal targets, else the sum of its foods. */
export function mealMacros(meal: any): NutritionTotals {
  const targets = meal?.mealTargets;
  if (targets) {
    return {
      calories: Math.round(num(targets.calories)), protein: Math.round(num(targets.proteinG)),
      carbs: Math.round(num(targets.carbsG)), fat: Math.round(num(targets.fatG)),
    };
  }
  return (meal?.foods || []).reduce((total: NutritionTotals, food: any) => {
    const m = foodMacros(food);
    return {
      calories: total.calories + Math.round(m.calories), protein: total.protein + Math.round(m.protein),
      carbs: total.carbs + Math.round(m.carbs), fat: total.fat + Math.round(m.fat),
    };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

/** Report status of a meal: the client log of the day first, then the meal itself. */
export function mealReportStatus(day: any, meal: any): string {
  const log = (day?.clientMealLogs || []).find((item: any) => String(item?.mealId) === String(meal?.id ?? meal?._id));
  return String(log?.status ?? meal?.reportStatus ?? '').trim().toUpperCase();
}

function hasRecipeContent(meal: any): boolean {
  return meal?.template === true || meal?.draft === true || !!String(meal?.coverImage ?? '').trim()
    || num(meal?.totalTimeMinutes) > 0
    || (Array.isArray(meal?.directions) && meal.directions.some((step: any) => String(step ?? '').trim()))
    || (Array.isArray(meal?.tags) && meal.tags.length > 0);
}

/** Meal.isEmptyPlaceholder on mobile: an untouched "Meal 2" with nothing in it is hidden from the client. */
export function isEmptyPlaceholderMeal(day: any, meal: any): boolean {
  const name = String(meal?.name ?? '').trim();
  const untouched = !name || /^meal\s+\d+$/i.test(name);
  const macros = mealMacros(meal);
  const log = (day?.clientMealLogs || []).find((item: any) => String(item?.mealId) === String(meal?.id ?? meal?._id));
  return untouched && !(meal?.foods || []).length && !macros.calories && !macros.protein && !macros.carbs && !macros.fat
    && !hasRecipeContent(meal) && !mealReportStatus(day, meal)
    && !String(log?.note ?? meal?.note ?? '').trim() && !String(log?.photoPath ?? meal?.photoPath ?? '').trim();
}

export function clientVisibleMeals(day: any): any[] {
  return (day?.meals || []).filter((meal: any) => !isEmptyPlaceholderMeal(day, meal));
}

export function isMealReported(day: any, meal: any): boolean {
  return !!mealReportStatus(day, meal);
}

export function isMealEaten(day: any, meal: any): boolean {
  const status = mealReportStatus(day, meal);
  return status === 'AS_PLANNED' || status === 'MODIFIED';
}

/** Macros of the meals the client reported as eaten. */
export function consumedTotals(day: any): NutritionTotals {
  return clientVisibleMeals(day).filter(meal => isMealEaten(day, meal)).reduce((total: NutritionTotals, meal: any) => {
    const m = mealMacros(meal);
    return { calories: total.calories + m.calories, protein: total.protein + m.protein, carbs: total.carbs + m.carbs, fat: total.fat + m.fat };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

/** Daily target, falling back to the planned totals when no explicit target is stored on the day. */
export function targetTotals(day: any): NutritionTotals {
  const t = day?.dayTargets || {};
  if (num(t.calories) > 0) return { calories: num(t.calories), protein: num(t.proteinG), carbs: num(t.carbsG), fat: num(t.fatG) };
  return clientVisibleMeals(day).reduce((total: NutritionTotals, meal: any) => {
    const m = mealMacros(meal);
    return { calories: total.calories + m.calories, protein: total.protein + m.protein, carbs: total.carbs + m.carbs, fat: total.fat + m.fat };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

/** First day of the plans scheduled on the given date (mobile getTodayWorkoutItem / getTodayNutritionItem). */
export function findPlanDay(plans: any[], daysKey: 'workoutDays' | 'mealDays', target: Date): { plan: any; day: any } | null {
  const key = dateKey(target);
  for (const plan of plans || []) {
    for (const day of plan?.[daysKey] || []) {
      const date = planDate(day?.date);
      if (date && dateKey(date) === key) return { plan, day };
    }
  }
  return null;
}
