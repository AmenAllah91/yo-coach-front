import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { Subscription } from 'rxjs';
import { AiQuotaService, AiQuotaStatus, aiErrorKey, quotaExhausted, quotaOf } from 'app/service/ai-quota.service';
import { AiQuotaComponent } from 'app/components/ai-quota/ai-quota.component';
import { ClientService } from 'app/service/client.service';
import {
  NutritionAiDraft, NutritionAiDraftRequest, NutritionAiService, NutritionTargetsRequest,
} from 'app/service/nutrition-ai.service';

type Step = 'profile' | 'meals' | 'loading';

/**
 * IA-41 / IA-43 / IA-53: an AI meal plan in two steps. 1) the client's needs: the server proposes calories and macros
 * (free, no AI); 2) the coach adjusts them and gives meals, diet, allergies: the AI writes 7 days. Prefilled from the
 * client's profile when there is one. Emits the draft; the caller opens the nutrition editor with it.
 */
@Component({
  selector: 'app-nutrition-ai-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslateModule, FeatherModule, AiQuotaComponent],
  templateUrl: './nutrition-ai-dialog.component.html',
  styleUrls: ['../../website/website-ai-dialog/website-ai-dialog.component.scss',
    '../../program-library/workout-ai-dialog/workout-ai-dialog.component.scss'],
})
export class NutritionAiDialogComponent implements OnDestroy {
  @ViewChild('dialog') dialog?: ElementRef<HTMLDialogElement>;
  @Input() language: 'fr' | 'en' | 'ar' = 'fr';
  @Output() drafted = new EventEmitter<NutritionAiDraft>();
  /** The dialog closed (generated or not). */
  @Output() closed = new EventEmitter<void>();

  readonly goals = ['WEIGHT_LOSS', 'MAINTAIN', 'MUSCLE'] as const;
  readonly activities = ['SEDENTARY', 'LIGHT', 'ACTIVE', 'VERY_ACTIVE'] as const;
  readonly diets = ['NONE', 'VEGETARIAN', 'VEGAN', 'HALAL'] as const;
  readonly allergyOptions = ['GLUTEN', 'LACTOSE', 'NUTS', 'EGGS', 'FISH', 'SEAFOOD'] as const;
  readonly mealOptions = [3, 4, 5, 6];

  step: Step = 'profile';
  error = '';
  computing = false;
  quota: AiQuotaStatus | null = null;
  profile: NutritionTargetsRequest = this.emptyProfile();
  answers: NutritionAiDraftRequest = this.emptyAnswers(4);
  medicalCondition = false;
  private requests: Subscription[] = [];

  constructor(private nutrition: NutritionAiService, private quotas: AiQuotaService, private clients: ClientService) {}

  ngOnDestroy(): void { this.requests.forEach(r => r.unsubscribe()); }

  /** Opens step 1. {@code clientId}: the questions are filled from that client's profile. */
  open(options: { weeks?: number; clientId?: string | null } = {}): void {
    this.step = 'profile';
    this.error = '';
    this.profile = this.emptyProfile();
    this.medicalCondition = false;
    this.answers = this.emptyAnswers(options.weeks || 4);
    this.dialog?.nativeElement.showModal();
    this.requests.push(this.quotas.overview().subscribe({
      next: (o) => (this.quota = quotaOf(o, 'ai.nutrition')), error: () => (this.quota = null),
    }));
    if (options.clientId) {
      this.requests.push(this.clients.getClientById(options.clientId, true).subscribe({
        next: (client) => (this.profile = { ...this.profile, ...nutritionPrefillFromClient(client) }),
        error: () => undefined,
      }));
    }
  }

  close(): void { if (this.step !== 'loading' && !this.computing) this.dialog?.nativeElement.close(); }
  cancel(event: Event): void { if (this.step === 'loading' || this.computing) event.preventDefault(); }

  get exhausted(): boolean { return quotaExhausted(this.quota); }

  get profileValid(): boolean {
    const p = this.profile;
    return !!p.gender && between(p.age, 10, 100) && between(p.weightKg, 25, 300) && between(p.heightCm, 100, 250)
      && !!p.activity && !!p.goal;
  }

  get mealsValid(): boolean {
    const a = this.answers;
    return between(a.calories, 1000, 6000) && between(a.proteinG, 20, 400) && between(a.carbsG, 0, 900)
      && between(a.fatG, 20, 300) && between(a.weeks, 1, 12);
  }

  /** Calories from the macros (4 / 4 / 9 kcal per gram), to show the coach whether the two agree. */
  get caloriesFromMacros(): number {
    return Math.round((+this.answers.proteinG || 0) * 4 + (+this.answers.carbsG || 0) * 4 + (+this.answers.fatG || 0) * 9);
  }

  /** Step 1 → 2: the server proposes the targets (IA-41). */
  computeTargets(): void {
    if (!this.profileValid || this.computing) return;
    this.computing = true;
    this.error = '';
    this.requests.push(this.nutrition.targets({ ...this.profile, age: +this.profile.age, weightKg: +this.profile.weightKg,
      heightCm: +this.profile.heightCm }).subscribe({
      next: (t) => {
        this.computing = false;
        this.answers = { ...this.answers, goal: this.profile.goal, calories: t.calories, proteinG: t.proteinG,
          carbsG: t.carbsG, fatG: t.fatG, minor: this.profile.minor, pregnancy: this.profile.pregnancy,
          medicalCondition: this.medicalCondition };
        this.step = 'meals';
      },
      error: () => {
        this.computing = false;
        this.error = 'AI_ERROR_UNAVAILABLE';
      },
    }));
  }

  toggleAllergy(value: NutritionAiDraftRequest['allergies'][number]): void {
    const list = this.answers.allergies;
    this.answers.allergies = list.includes(value) ? list.filter(v => v !== value) : [...list, value];
  }

  submit(): void {
    if (this.step === 'profile') {
      this.computeTargets();
      return;
    }
    if (!this.mealsValid || this.exhausted || this.step === 'loading') return;
    this.step = 'loading';
    this.error = '';
    const a = this.answers;
    this.requests.push(this.nutrition.draft({ ...a, calories: +a.calories, proteinG: +a.proteinG, carbsG: +a.carbsG,
      fatG: +a.fatG, mealsPerDay: +a.mealsPerDay, weeks: +a.weeks, avoid: a.avoid?.trim() || null }).subscribe({
      next: (draft) => {
        this.step = 'meals';
        this.drafted.emit(draft);
        this.dialog?.nativeElement.close();
      },
      error: (e) => {
        this.step = 'meals';
        this.error = e?.error?.message === 'NO_FOODS' ? 'AI_NUTRITION_NO_FOODS' : aiErrorKey(e);
      },
    }));
  }

  private emptyProfile(): NutritionTargetsRequest {
    return { gender: null as any, age: null as any, weightKg: null as any, heightCm: null as any, activity: 'LIGHT',
      goal: 'MAINTAIN', minor: false, pregnancy: false };
  }

  private emptyAnswers(weeks: number): NutritionAiDraftRequest {
    return { goal: 'MAINTAIN', calories: 2000, proteinG: 120, carbsG: 230, fatG: 65, mealsPerDay: 4, diet: 'NONE',
      allergies: [], avoid: '', weeks: Math.max(1, Math.min(12, weeks)), minor: false, pregnancy: false,
      medicalCondition: false, language: this.language };
  }
}

function between(value: unknown, min: number, max: number): boolean {
  const n = Number(value);
  return value !== null && value !== '' && Number.isFinite(n) && n >= min && n <= max;
}

/** IA-43: what a client's profile fills in advance (gender, age, weight in kg, goal; minor checked under 18). */
export function nutritionPrefillFromClient(client: any, today = new Date()): Partial<NutritionTargetsRequest> {
  if (!client) return {};
  const prefill: Partial<NutritionTargetsRequest> = {};
  if (client.gender === 'MALE' || client.gender === 'FEMALE') prefill.gender = client.gender;
  const goal: Record<string, NutritionTargetsRequest['goal']> = {
    LOSE_WEIGHT: 'WEIGHT_LOSS', BUILD_MUSCLE: 'MUSCLE', GET_FIT: 'MAINTAIN', STAY_HEALTHY: 'MAINTAIN', IMPROVE_PERFORMANCE: 'MAINTAIN',
  };
  if (goal[client.mainObjective]) prefill.goal = goal[client.mainObjective];
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
