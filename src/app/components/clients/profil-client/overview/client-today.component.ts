import { CommonModule, registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';

registerLocaleData(localeFr);
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

export interface TodayExercise {
  name: string;
  /** « 3 × 12 », « 3 × 30 s », « 20 min »… empty when nothing is set. */
  volume: string;
  image: string | null;
}

export interface TodayWorkoutView {
  programName: string;
  currentWeek: number;
  totalWeeks: number;
  name: string;
  exercises: TodayExercise[];
  totalSets: number;
  minutes: number;
}

export interface TodayNutritionView {
  name: string;
  dailyCalories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealCount?: number;
}

/** Status of today's day as the client logged it (from the activities), shown as a chip. */
export interface TodayStatus {
  label: string;
  tone: 'done' | 'progress' | 'warn' | 'bad' | 'planned';
}

/**
 * Profile dashboard, top row: today's workout and today's nutrition, side by side and compact.
 * Without anything today a card is a single line (with assign / create when the client has no plan).
 */
@Component({
  selector: 'app-client-today',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./overview.scss', './client-today.component.scss'],
  template: `
    <div class="ov-today" [class.ov-today--mixed]="!workout !== !nutrition">
      <!-- Workout -->
      <article class="ov-card" [class.is-empty]="!workout">
        <ng-container *ngIf="workout as w; else noWorkout">
          <header class="ov-head">
            <span class="ov-tile"><i class="fas fa-dumbbell"></i></span>
            <span class="ov-head__titles">
              <small>{{ t("Today's workout", 'Séance du jour') }}</small>
              <h3 [title]="w.name">{{ w.name }}</h3>
            </span>
            <span *ngIf="workoutStatus" class="ov-chip" [attr.data-tone]="workoutStatus.tone">{{ workoutStatus.label }}</span>
            <button type="button" class="ov-link" (click)="openWorkout.emit()">{{ t('View', 'Voir') }} <i class="fas fa-chevron-right"></i></button>
          </header>

          <p class="ov-meta">
            <span class="ov-meta__plan" [title]="w.programName">{{ w.programName }} · {{ t('Week', 'Semaine') }} {{ w.currentWeek }}/{{ w.totalWeeks }}</span>
            <span><i class="fas fa-dumbbell"></i>{{ w.exercises.length }} {{ w.exercises.length > 1 ? t('exercises', 'exercices') : t('exercise', 'exercice') }}</span>
            <span *ngIf="w.totalSets">{{ w.totalSets }} {{ w.totalSets > 1 ? t('sets', 'séries') : t('set', 'série') }}</span>
            <span *ngIf="w.minutes > 0"><i class="far fa-clock"></i>~{{ w.minutes }} min</span>
          </p>

          <ul class="tw-list">
            <li *ngFor="let exercise of w.exercises | slice:0:shownExercises; let i = index" class="tw-ex">
              <span class="tw-ex__label">{{ letter(i) }}</span>
              <span class="tw-ex__thumb">
                <img *ngIf="exercise.image && !failed.has(exercise.image); else noThumb" [src]="exercise.image" alt="" loading="lazy" (error)="failed.add(exercise.image!)" />
                <ng-template #noThumb><i class="fas fa-dumbbell"></i></ng-template>
              </span>
              <span class="tw-ex__name" [title]="exercise.name">{{ exercise.name }}</span>
              <span *ngIf="exercise.volume" class="tw-ex__volume">{{ exercise.volume }}</span>
            </li>
          </ul>
          <button *ngIf="w.exercises.length > shownExercises" type="button" class="tw-more" (click)="openWorkout.emit()">
            {{ t('+' + (w.exercises.length - shownExercises) + ' more exercises', '+' + (w.exercises.length - shownExercises) + ' autres exercices') }}
          </button>
        </ng-container>

        <ng-template #noWorkout>
          <div class="ov-empty">
            <span class="ov-tile"><i class="fas fa-dumbbell"></i></span>
            <span class="ov-empty__copy">
              <strong>{{ hasWorkoutPlan ? t('No workout today', 'Pas de séance aujourd’hui') : t('No workout program', 'Aucun programme d’entraînement') }}</strong>
              <span>{{ hasWorkoutPlan ? t('Rest day or nothing planned', 'Repos ou rien de prévu ce jour') : t('Assign or create a program', 'Assignez ou créez un programme') }}</span>
            </span>
            <span class="ov-empty__actions">
              <ng-container *ngIf="hasWorkoutPlan; else workoutActions">
                <button type="button" class="ov-btn" (click)="openWorkout.emit()">{{ t('See workouts', 'Voir les séances') }}</button>
              </ng-container>
              <ng-template #workoutActions>
                <button type="button" class="ov-btn ov-btn--primary" (click)="assignWorkout.emit()"><i class="fas fa-plus"></i>{{ t('Assign', 'Assigner') }}</button>
                <button type="button" class="ov-btn" (click)="createWorkout.emit()">{{ t('Create', 'Créer') }}</button>
              </ng-template>
            </span>
          </div>
        </ng-template>
      </article>

      <!-- Nutrition -->
      <article class="ov-card" [class.is-empty]="!nutrition">
        <ng-container *ngIf="nutrition as n; else noNutrition">
          <header class="ov-head">
            <span class="ov-tile ov-tile--green"><i class="fas fa-apple-alt"></i></span>
            <span class="ov-head__titles">
              <small>{{ t("Today's nutrition", 'Nutrition du jour') }}</small>
              <h3 [title]="n.name">{{ n.name }}</h3>
            </span>
            <span *ngIf="nutritionStatus" class="ov-chip" [attr.data-tone]="nutritionStatus.tone">{{ nutritionStatus.label }}</span>
            <button type="button" class="ov-link" (click)="openNutrition.emit()">{{ t('View', 'Voir') }} <i class="fas fa-chevron-right"></i></button>
          </header>

          <div class="tn-body">
            <div class="tn-kcal">
              <strong>{{ n.dailyCalories || 0 | number:'1.0-0':locale }}</strong>
              <span>kcal</span>
              <small *ngIf="n.mealCount">{{ n.mealCount }} {{ n.mealCount > 1 ? t('meals', 'repas') : t('meal', 'repas') }}</small>
            </div>
            <ul class="tn-macros">
              <li *ngFor="let macro of macros(n)">
                <span class="tn-macros__head">
                  <span><i [style.background]="macro.color"></i>{{ macro.label }}</span>
                  <strong>{{ macro.grams | number:'1.0-0':locale }} g</strong>
                </span>
                <span class="tn-macros__bar"><b [style.width.%]="macro.percent" [style.background]="macro.color"></b></span>
              </li>
            </ul>
          </div>
        </ng-container>

        <ng-template #noNutrition>
          <div class="ov-empty">
            <span class="ov-tile ov-tile--green"><i class="fas fa-apple-alt"></i></span>
            <span class="ov-empty__copy">
              <strong>{{ hasNutritionPlan ? t('No nutrition today', 'Pas de nutrition aujourd’hui') : t('No nutrition plan', 'Aucun plan nutritionnel') }}</strong>
              <span>{{ hasNutritionPlan ? t('Nothing planned this day', 'Rien de prévu ce jour') : t('Assign or create a plan', 'Assignez ou créez un plan') }}</span>
            </span>
            <span class="ov-empty__actions">
              <ng-container *ngIf="hasNutritionPlan; else nutritionActions">
                <button type="button" class="ov-btn" (click)="openNutrition.emit()">{{ t('See plan', 'Voir le plan') }}</button>
              </ng-container>
              <ng-template #nutritionActions>
                <button type="button" class="ov-btn ov-btn--green" (click)="assignNutrition.emit()"><i class="fas fa-plus"></i>{{ t('Assign', 'Assigner') }}</button>
                <button type="button" class="ov-btn" (click)="createNutrition.emit()">{{ t('Create', 'Créer') }}</button>
              </ng-template>
            </span>
          </div>
        </ng-template>
      </article>
    </div>
  `,
})
export class ClientTodayComponent {
  @Input() fr = false;
  @Input() workout: TodayWorkoutView | null = null;
  @Input() workoutStatus: TodayStatus | null = null;
  @Input() hasWorkoutPlan = false;
  @Input() nutrition: TodayNutritionView | null = null;
  @Input() nutritionStatus: TodayStatus | null = null;
  @Input() hasNutritionPlan = false;

  @Output() openWorkout = new EventEmitter<void>();
  @Output() assignWorkout = new EventEmitter<void>();
  @Output() createWorkout = new EventEmitter<void>();
  @Output() openNutrition = new EventEmitter<void>();
  @Output() assignNutrition = new EventEmitter<void>();
  @Output() createNutrition = new EventEmitter<void>();

  /** Exercises listed before « +N autres exercices ». */
  readonly shownExercises = 4;
  readonly failed = new Set<string>();

  get locale(): string {
    return this.fr ? 'fr' : 'en';
  }

  t(en: string, fr: string): string {
    return this.fr ? fr : en;
  }

  letter(index: number): string {
    return String.fromCharCode(65 + index);
  }

  /** Grams of each macro and its share of the day's calories (protein/carbs 4 kcal/g, fat 9 kcal/g); colors of the nutrition builder. */
  macros(n: TodayNutritionView): { label: string; grams: number; percent: number; color: string }[] {
    const protein = Number(n.protein) || 0;
    const carbs = Number(n.carbs) || 0;
    const fat = Number(n.fat) || 0;
    const total = protein * 4 + carbs * 4 + fat * 9;
    const share = (kcal: number) => (total ? Math.round((kcal / total) * 100) : 0);
    return [
      { label: this.t('Protein', 'Protéines'), grams: protein, percent: share(protein * 4), color: '#44b4df' },
      { label: this.t('Carbs', 'Glucides'), grams: carbs, percent: share(carbs * 4), color: '#f59e0b' },
      { label: this.t('Fat', 'Lipides'), grams: fat, percent: share(fat * 9), color: '#8b5cf6' },
    ];
  }
}
