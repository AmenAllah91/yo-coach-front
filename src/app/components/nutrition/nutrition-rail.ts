import { TranslateService } from '@ngx-translate/core';
import { RailWeek } from '@shared/program-structure-rail/program-structure-rail.component';
import { MealDay } from '@shared/models/MealPlan';
import { NutritionDraftState } from './nutrition-draft-state';

type NutritionWeek = { weekNumber: number; days: Array<{ day: MealDay; index: number }> };

/** Semaines et jours de « Structure du programme » des 3 éditeurs nutrition (même composant que les séances). */
export function nutritionRailWeeks(
  draft: NutritionDraftState,
  days: MealDay[],
  weeks: NutritionWeek[],
  translate: TranslateService,
): RailWeek<NutritionWeek, MealDay>[] {
  return weeks.map((week) => ({
    week,
    key: week.weekNumber,
    label: translate.instant('WEEK_NUMBER', { number: week.weekNumber }),
    range: draft.weekDates(days, week.weekNumber),
    ready: draft.readyCount(days, week.weekNumber),
    collapsed: draft.collapsedWeeks.has(week.weekNumber),
    days: week.days.map((item) => ({
      day: item.day,
      id: item.day.id,
      title: translate.instant('DAY_NUMBER', { number: (item.index % 7) + 1 }),
      date: draft.dayDate(item.day),
      state: draft.dayRailState(days, item.day),
    })),
  }));
}
