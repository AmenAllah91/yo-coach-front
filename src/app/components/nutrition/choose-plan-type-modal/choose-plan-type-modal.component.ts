import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { Router } from '@angular/router';
import { CoachSettingsService } from 'app/service/coach-settings.service';

export type NutritionPlanChoice = 'full' | 'macro-total' | 'macro-each';

@Component({
  selector: 'app-choose-plan-type-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule],
  templateUrl: './choose-plan-type-modal.component.html',
  styleUrls: ['./choose-plan-type-modal.component.scss'],
})
export class ChoosePlanTypeModalComponent implements OnChanges {
  @Input() isVisible = false;
  @Input() isAssign = false;
  @Input() idClient: string = null;
  @Input() returnUrl: string | null = null;
  @Input() assignAfterCreate = false;
  @Input() presetProgramName = '';
  @Input() presetDurationWeeks: number | null = null;
  @Input() presetStartDate = '';
  @Input() presetEndDate = '';
  @Input() skipDurationStep = false;
  @Input() selectOnly = false;

  @Output() onClose = new EventEmitter<void>();
  @Output() planTypeSelected = new EventEmitter<NutritionPlanChoice>();

  showDurationModal = false;
  nutritionDurationWeeks = 4;
  nutritionProgramName = '';
  readonly nutritionDurationOptions = [1, 2, 3, 4, 5, 6, 8, 10, 12];
  selectedPlanType: NutritionPlanChoice | null = null;

  constructor(
    private router: Router,
    private coachSettingsService: CoachSettingsService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isVisible']?.currentValue === true) {
      this.showDurationModal = false;
      this.nutritionProgramName = this.presetProgramName || '';
      this.nutritionDurationWeeks = this.normalizedPresetDurationWeeks;
      this.selectedPlanType = null;

      setTimeout(() => this.applyAutoSelectionRules());
    }

    if (changes['isVisible']?.currentValue === false) {
      this.showDurationModal = false;
      this.selectedPlanType = null;
    }
  }

  get canCreateFullMealPlan(): boolean {
    return this.coachSettingsService.canCreateFullMealPlan();
  }

  get canCreateMacroDailyPlan(): boolean {
    return this.coachSettingsService.canCreateMacroDailyPlan();
  }

  get canCreateMacroEachMealPlan(): boolean {
    return this.coachSettingsService.canCreateMacroEachMealPlan();
  }

  get canCreateAnyMacroPlan(): boolean {
    return this.canCreateMacroDailyPlan || this.canCreateMacroEachMealPlan;
  }

  get enabledMacroCount(): number {
    let count = 0;

    if (this.canCreateMacroDailyPlan) count++;
    if (this.canCreateMacroEachMealPlan) count++;

    return count;
  }

  get enabledPlanCount(): number {
    let count = 0;

    if (this.canCreateFullMealPlan) count++;
    if (this.canCreateMacroDailyPlan) count++;
    if (this.canCreateMacroEachMealPlan) count++;

    return count;
  }

  get hasAnyPlanType(): boolean {
    return this.canCreateFullMealPlan || this.canCreateAnyMacroPlan;
  }

  get shouldShowMainModal(): boolean {
    return this.isVisible && !this.showDurationModal;
  }

  get shouldShowDurationModal(): boolean {
    return this.isVisible && this.showDurationModal && !!this.selectedPlanType;
  }

  closeModal(): void {
    this.showDurationModal = false;
    this.selectedPlanType = null;
    this.onClose.emit();
  }

  createFullMealPlan(): void {
    if (!this.canCreateFullMealPlan) return;

    this.selectPlanType('full');
  }

  createMacroTotalPlan(): void {
    if (!this.canCreateMacroDailyPlan) return;

    this.selectPlanType('macro-total');
  }

  createMacroEachMealPlan(): void {
    if (!this.canCreateMacroEachMealPlan) return;

    this.selectPlanType('macro-each');
  }

  private selectPlanType(type: NutritionPlanChoice): void {
    this.selectedPlanType = type;

    if (this.selectOnly) {
      this.planTypeSelected.emit(type);
      return;
    }

    if (this.skipDurationStep) {
      this.confirmNutritionPlanDetails();
      return;
    }

    this.showDurationModal = true;
  }

  closeDurationModal(): void {
    this.showDurationModal = false;
    this.selectedPlanType = null;
  }

  confirmNutritionPlanDetails(): void {
    if (!this.nutritionProgramName.trim()) return;

    if (this.selectedPlanType === 'full') {
      this.navigateToFullMealPlan();
      return;
    }

    if (this.selectedPlanType === 'macro-total') {
      this.navigateToMacroDaily();
      return;
    }

    if (this.selectedPlanType === 'macro-each') {
      this.navigateToMacroEachMeal();
    }
  }

  private navigateToFullMealPlan(): void {
    this.closeModal();
    const queryParams: any = {
      type: 'each',
      assignAfterCreate: this.assignAfterCreate,
      durationWeeks: this.normalizedDurationWeeks,
      name: this.nutritionProgramName.trim(),
    };
    this.addPresetSchedule(queryParams);

    if (this.returnUrl) {
      queryParams.returnUrl = this.returnUrl;
    }

    if (this.isAssign) {
      this.router.navigate([`/clients/create-full-plan/${this.idClient}`], { queryParams });
      return;
    }

    this.router.navigate(['/nutrition/create-full-plan'], { queryParams });
  }

  private applyAutoSelectionRules(): void {
    if (!this.isVisible) return;

    const enabledChoices: NutritionPlanChoice[] = [];

    if (this.canCreateFullMealPlan) enabledChoices.push('full');
    if (this.canCreateMacroDailyPlan) enabledChoices.push('macro-total');
    if (this.canCreateMacroEachMealPlan) enabledChoices.push('macro-each');

    if (enabledChoices.length === 1) {
      this.selectPlanType(enabledChoices[0]);
    }
  }

  private navigateToMacroDaily(): void {
    if (!this.canCreateMacroDailyPlan) return;

    this.closeModal();

    const queryParams: any = {
      type: 'total',
      assignAfterCreate: this.assignAfterCreate,
      durationWeeks: this.normalizedDurationWeeks,
      name: this.nutritionProgramName.trim(),
    };
    this.addPresetSchedule(queryParams);

    if (this.returnUrl) {
      queryParams.returnUrl = this.returnUrl;
    }

    if (this.isAssign) {
      this.router.navigate([
        `/clients/create-macro-plan-total-day/${this.idClient}`,
      ], { queryParams });
      return;
    }

    this.router.navigate(['/nutrition/create-macro-plan-total-day'], {
      queryParams,
    });
  }

  private navigateToMacroEachMeal(): void {
    if (!this.canCreateMacroEachMealPlan) return;

    this.closeModal();

    const queryParams: any = {
      type: 'each',
      assignAfterCreate: this.assignAfterCreate,
      durationWeeks: this.normalizedDurationWeeks,
      name: this.nutritionProgramName.trim(),
    };
    this.addPresetSchedule(queryParams);

    if (this.returnUrl) {
      queryParams.returnUrl = this.returnUrl;
    }

    if (this.isAssign) {
      this.router.navigate([`/clients/create-macro-plan/${this.idClient}`], { queryParams });
      return;
    }

    this.router.navigate(['/nutrition/create-macro-plan'], {
      queryParams,
    });
  }

  get selectedPlanTypeLabel(): string {
    if (this.selectedPlanType === 'full') return 'Full Meal Plan';
    if (this.selectedPlanType === 'macro-total') return 'Macro Total Day Plan';
    if (this.selectedPlanType === 'macro-each') return 'Macro Each Meal Plan';
    return 'Nutrition Plan';
  }

  get normalizedDurationWeeks(): number {
    const value = Number(this.presetDurationWeeks || this.nutritionDurationWeeks) || 4;
    return Math.max(1, Math.min(value, 52));
  }

  private get normalizedPresetDurationWeeks(): number {
    const value = Number(this.presetDurationWeeks || this.nutritionDurationWeeks) || 4;
    return Math.max(1, Math.min(value, 52));
  }

  private addPresetSchedule(queryParams: any): void {
    if (this.presetStartDate) {
      queryParams.startDate = this.presetStartDate;
    }

    if (this.presetEndDate) {
      queryParams.endDate = this.presetEndDate;
    }
  }
}
