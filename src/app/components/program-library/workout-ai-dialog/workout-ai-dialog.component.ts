import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { Subscription } from 'rxjs';
import { AiQuotaService, AiQuotaStatus, aiErrorKey, quotaExhausted, quotaOf } from 'app/service/ai-quota.service';
import { AiQuotaComponent } from 'app/components/ai-quota/ai-quota.component';
import {
  MAX_PROGRAM_WEEKS, SPLIT_DAYS, WorkoutAiDraft, WorkoutAiDraftRequest, WorkoutAiPhase, WorkoutAiService, WorkoutAiSplit,
} from 'app/service/workout-ai.service';

/**
 * IA-33 / IA-34 / IA-53: the questions of an AI workout program (choices to click, phases, cases that need care).
 * Emits the draft; the caller opens the editor with it. Prefilled from the client's profile when there is one.
 */
@Component({
  selector: 'app-workout-ai-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslateModule, FeatherModule, AiQuotaComponent],
  templateUrl: './workout-ai-dialog.component.html',
  styleUrls: ['../../website/website-ai-dialog/website-ai-dialog.component.scss', './workout-ai-dialog.component.scss'],
})
export class WorkoutAiDialogComponent implements OnDestroy {
  @ViewChild('dialog') dialog?: ElementRef<HTMLDialogElement>;
  @Input() quota: AiQuotaStatus | null = null;
  @Input() language: 'fr' | 'en' | 'ar' = 'fr';
  /** Client name shown in the title (null = library program). */
  @Input() clientName: string | null = null;
  @Output() drafted = new EventEmitter<WorkoutAiDraft>();

  readonly goals = ['MUSCLE', 'WEIGHT_LOSS', 'STRENGTH', 'FITNESS'] as const;
  readonly levels = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;
  readonly dayOptions = [2, 3, 4, 5, 6];
  readonly minuteOptions = [30, 45, 60, 90];
  readonly equipments = ['GYM', 'HOME_BODYWEIGHT', 'DUMBBELLS'] as const;
  readonly injuryOptions = ['KNEE', 'BACK', 'SHOULDER'] as const;
  readonly splits: WorkoutAiSplit[] = ['AUTO', 'FULL_BODY', 'UPPER_LOWER', 'PPL', 'BRO_SPLIT', 'OTHER'];
  readonly focuses = ['BASICS', 'HYPERTROPHY', 'STRENGTH', 'FAT_LOSS'] as const;
  readonly maxWeeks = MAX_PROGRAM_WEEKS;

  loading = false;
  error = '';
  answers: WorkoutAiDraftRequest = this.emptyAnswers();
  private request?: Subscription;

  constructor(private workouts: WorkoutAiService, private quotas: AiQuotaService) {}

  ngOnDestroy(): void { this.request?.unsubscribe(); }

  /** Opens the questions; {@code prefill} comes from the client's profile (goal, age, gender, weight). */
  open(prefill: Partial<WorkoutAiDraftRequest> = {}): void {
    this.error = '';
    this.answers = { ...this.emptyAnswers(), ...prefill, phases: [this.phase()] };
    this.dialog?.nativeElement.showModal();
    // The counter is read at each opening (the server checks it again when generating).
    this.quotas.overview().subscribe({ next: (o) => (this.quota = quotaOf(o, 'ai.workout')), error: () => (this.quota = null) });
  }

  close(): void { if (!this.loading) this.dialog?.nativeElement.close(); }
  cancel(event: Event): void { if (this.loading) event.preventDefault(); }

  /** IA-51: the example client's first AI program is free (the server takes it once; else it counts as usual). */
  get free(): boolean { return !!this.answers.exampleClient; }
  get exhausted(): boolean { return !this.free && quotaExhausted(this.quota); }
  get totalWeeks(): number { return this.answers.phases.reduce((sum, p) => sum + (Number(p.weeks) || 0), 0); }

  /** IA-34: the split fits the days a week (else the coach is told before anything is sent). */
  fits(phase: WorkoutAiPhase): boolean { return SPLIT_DAYS[phase.split].includes(Number(this.answers.daysPerWeek)); }
  splitDays(split: WorkoutAiSplit): number[] { return SPLIT_DAYS[split]; }

  get valid(): boolean {
    const a = this.answers;
    return !!a.goal && !!a.level && !!a.equipment && this.totalWeeks >= 1 && this.totalWeeks <= MAX_PROGRAM_WEEKS
      && a.phases.length >= 1 && a.phases.length <= 3
      && a.phases.every(p => Number.isInteger(Number(p.weeks)) && p.weeks >= 1 && this.fits(p)
        && (p.split !== 'OTHER' || !!p.splitOther?.trim()));
  }

  addPhase(): void {
    if (this.answers.phases.length >= 3) return;
    const left = Math.max(1, MAX_PROGRAM_WEEKS - this.totalWeeks);
    this.answers.phases = [...this.answers.phases, { ...this.phase(), weeks: Math.min(4, left) }];
  }

  removePhase(index: number): void {
    if (this.answers.phases.length > 1) this.answers.phases = this.answers.phases.filter((_, i) => i !== index);
  }

  toggleInjury(value: WorkoutAiDraftRequest['injuries'][number]): void {
    const list = this.answers.injuries;
    this.answers.injuries = list.includes(value) ? list.filter(v => v !== value) : [...list, value];
  }

  submit(): void {
    if (!this.valid || this.exhausted || this.loading) return;
    this.loading = true;
    this.error = '';
    this.request = this.workouts.draft(this.cleaned()).subscribe({
      next: (draft) => {
        this.loading = false;
        this.dialog?.nativeElement.close();
        this.drafted.emit(draft);
      },
      error: (e) => {
        this.loading = false;
        this.error = e?.error?.message === 'SPLIT_DAYS_MISMATCH' ? 'AI_WORKOUT_SPLIT_MISMATCH'
          : e?.error?.message === 'NO_EXERCISES' ? 'AI_WORKOUT_NO_EXERCISES' : aiErrorKey(e);
      },
    });
  }

  private cleaned(): WorkoutAiDraftRequest {
    const a = this.answers;
    const text = (value?: string | null) => value?.trim() || null;
    return {
      ...a,
      daysPerWeek: Number(a.daysPerWeek),
      sessionMinutes: Number(a.sessionMinutes),
      injuryOther: text(a.injuryOther),
      phases: a.phases.map(p => ({ ...p, weeks: Number(p.weeks), splitOther: p.split === 'OTHER' ? text(p.splitOther) : null })),
      age: a.age || null,
      weightKg: a.weightKg ? Math.round(a.weightKg) : null,
      gender: a.gender || null,
    };
  }

  private phase(): WorkoutAiPhase { return { weeks: 4, split: 'AUTO', focus: 'BASICS' }; }

  private emptyAnswers(): WorkoutAiDraftRequest {
    return {
      goal: 'FITNESS', level: 'BEGINNER', daysPerWeek: 3, sessionMinutes: 60, equipment: 'GYM', injuries: [],
      minor: false, pregnancy: false, medicalCondition: false, phases: [this.phase()], deload: false,
      language: this.language,
    };
  }
}

/** IA-33: the answers a client's profile fills in advance (goal, age, gender, weight in kg). */
export function workoutPrefillFromClient(client: any, today = new Date()): Partial<WorkoutAiDraftRequest> {
  if (!client) return {};
  const prefill: Partial<WorkoutAiDraftRequest> = {};
  const goal: Record<string, WorkoutAiDraftRequest['goal']> = {
    LOSE_WEIGHT: 'WEIGHT_LOSS', BUILD_MUSCLE: 'MUSCLE', GET_FIT: 'FITNESS', STAY_HEALTHY: 'FITNESS', IMPROVE_PERFORMANCE: 'STRENGTH',
  };
  if (goal[client.mainObjective]) prefill.goal = goal[client.mainObjective];
  if (client.gender === 'MALE' || client.gender === 'FEMALE') prefill.gender = client.gender;
  const birth = client.birthDate ? new Date(client.birthDate) : null;
  if (birth && !isNaN(birth.getTime())) {
    let age = today.getFullYear() - birth.getFullYear();
    if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate())) age--;
    if (age >= 10 && age <= 100) {
      prefill.age = age;
      if (age < 18) prefill.minor = true;
    }
  }
  const weight = Number(client.currentWeight);
  if (Number.isFinite(weight) && weight > 0) {
    const kg = client.weightUnit === 'lbs' ? weight * 0.453592 : weight;
    if (kg >= 25 && kg <= 300) prefill.weightKg = Math.round(kg);
  }
  return prefill;
}
