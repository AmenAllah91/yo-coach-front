import { TranslateService } from '@ngx-translate/core';
import { ToastService } from 'app/service/toast.service';
import { MealDay } from '@shared/models/MealPlan';
import { todayIso } from '@shared/models/program-schedule';
import { mealDayActive } from '@shared/models/client-day-activity';
import { ProgramCopyController } from '@shared/program-copy/program-copy-controller';
import { ProgramDayClipboardService, ProgramDayKind } from '@shared/program-copy/program-day-clipboard.service';
import { copyMealDayContent } from '@shared/program-copy/program-day-copy';
import { NutritionDraftState } from './nutrition-draft-state';

/** What the 3 nutrition editors (foods, daily macros, macros per meal) share for the day copies. */
export interface NutritionCopyEditor {
  days: MealDay[];
  selectedDay: MealDay | null;
  draft: NutritionDraftState;
  planName: string;
  clientMode: { active: boolean };
}

/** Copy actions of a nutrition editor; `recalc` recomputes the totals of a day after its content changed. */
export function nutritionCopyController(
  editor: NutritionCopyEditor,
  kind: ProgramDayKind,
  recalc: (day: MealDay) => void,
  clipboard: ProgramDayClipboardService,
  toast: ToastService,
  translate: TranslateService,
): ProgramCopyController<MealDay> {
  return new ProgramCopyController<MealDay>(clipboard, kind, {
    days: () => editor.days,
    selectedDay: () => editor.selectedDay,
    isFilled: (day) => !['EMPTY', 'GAP'].includes(editor.draft.dayRailState(editor.days, day)),
    // A client's past days, and the days they already followed, keep what the client saw and logged.
    isLocked: (day) => editor.clientMode.active
      && ((!!day.date && String(day.date).slice(0, 10) < todayIso()) || mealDayActive(day)),
    apply: (source, target) => {
      copyMealDayContent(source, target);
      recalc(target);
    },
    restored: (day) => recalc(day),
    planName: () => editor.planName,
    translate: (key, params) => translate.instant(key, params),
    notify: (title, message, undo) =>
      toast.show({
        type: 'success',
        title,
        message,
        duration: undo ? 8000 : 5000,
        actions: undo ? [{ label: translate.instant('COPY_DAYS.UNDO'), run: undo, icon: 'fa-undo' }] : undefined,
      }),
    readOnly: () => editor.draft.readOnly,
  });
}
