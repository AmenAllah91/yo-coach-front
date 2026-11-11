import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { WorkoutPlan } from '@shared/models/workout.models';

export type WorkoutAiSplit = 'AUTO' | 'FULL_BODY' | 'UPPER_LOWER' | 'PPL' | 'BRO_SPLIT' | 'OTHER';
export type WorkoutAiFocus = 'BASICS' | 'HYPERTROPHY' | 'STRENGTH' | 'FAT_LOSS';

/** IA-34: one phase of the program. */
export interface WorkoutAiPhase { weeks: number; split: WorkoutAiSplit; splitOther?: string | null; focus: WorkoutAiFocus; }

/** IA-33: the coach's answers (fixed codes, short texts; age, gender and weight only, nothing else personal). */
export interface WorkoutAiDraftRequest {
  goal: 'MUSCLE' | 'WEIGHT_LOSS' | 'STRENGTH' | 'FITNESS';
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  daysPerWeek: number;
  sessionMinutes: number;
  equipment: 'GYM' | 'HOME_BODYWEIGHT' | 'DUMBBELLS';
  injuries: ('KNEE' | 'BACK' | 'SHOULDER')[];
  injuryOther?: string | null;
  minor: boolean;
  pregnancy: boolean;
  medicalCondition: boolean;
  phases: WorkoutAiPhase[];
  deload: boolean;
  /** IA-51: from the "First steps" guide for the example client (free once, checked by the server). */
  exampleClient?: boolean;
  age?: number | null;
  gender?: 'MALE' | 'FEMALE' | null;
  weightKg?: number | null;
  language: 'fr' | 'en' | 'ar';
}

/** IA-33: the draft (never saved) and the health warnings to show above it (IA-53). */
export interface WorkoutAiDraft { plan: WorkoutPlan; warnings: string[]; carefulModel: boolean; }

/** IA-34: the days a week each split fits (same rule as the server). */
export const SPLIT_DAYS: Record<WorkoutAiSplit, number[]> = {
  AUTO: [2, 3, 4, 5, 6], FULL_BODY: [2, 3, 4], UPPER_LOWER: [2, 4], PPL: [3, 6], BRO_SPLIT: [4, 5, 6], OTHER: [2, 3, 4, 5, 6],
};
/** The editor holds 12 weeks at most. */
export const MAX_PROGRAM_WEEKS = 12;

@Injectable({ providedIn: 'root' })
export class WorkoutAiService {
  private url = `${environment.baseApiUrl}/api/ai/workout-draft`;
  constructor(private http: HttpClient) {}

  draft(answers: WorkoutAiDraftRequest): Observable<WorkoutAiDraft> {
    return this.http.post<WorkoutAiDraft>(this.url, answers, { headers: { 'X-Skip-Loader': 'true' } });
  }
}

/** IA-33: number of weeks of a draft (7 days a week, at least 1). */
export function workoutDraftWeeks(draft: WorkoutAiDraft): number {
  return Math.max(1, Math.ceil((draft.plan.workoutDays?.length || 7) / 7));
}
