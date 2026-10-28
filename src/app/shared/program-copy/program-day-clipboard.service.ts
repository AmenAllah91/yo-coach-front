/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@angular/core';

/** What a day can be pasted onto: a workout day, or a nutrition day of the same kind of plan. */
export type ProgramDayKind = 'workout' | 'nutrition:FOODS' | 'nutrition:DAY_MACROS' | 'nutrition:MEAL_MACROS';

export interface CopiedDay {
  kind: ProgramDayKind;
  day: any;
  /** « Semaine 1 · Jour 3 · Programme force » shown in the banner and the paste modal. */
  label: string;
}

/**
 * Day kept with « Copier vers un autre programme », to paste in another program of the same kind. In memory only:
 * a reload forgets it, the banner cancels it, a paste uses it up.
 */
@Injectable({ providedIn: 'root' })
export class ProgramDayClipboardService {
  private copied: CopiedDay | null = null;

  copy(kind: ProgramDayKind, day: any, label: string): void {
    this.copied = { kind, day: JSON.parse(JSON.stringify(day)), label };
  }

  get(kind: ProgramDayKind): CopiedDay | null {
    return this.copied?.kind === kind ? this.copied : null;
  }

  clear(): void {
    this.copied = null;
  }
}
