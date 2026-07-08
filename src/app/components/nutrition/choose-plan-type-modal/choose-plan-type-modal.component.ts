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
import { ChooseMacroTypeModalComponent } from '../choose-macro-type-modal/choose-macro-type-modal.component';
import { Router } from '@angular/router';
import { CoachSettingsService } from 'app/service/coach-settings.service';

@Component({
  selector: 'app-choose-plan-type-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, ChooseMacroTypeModalComponent],
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

  @Output() onClose = new EventEmitter<void>();

  showMacroTypeModal = false;
  showDurationModal = false;
  nutritionDurationWeeks = 4;
  nutritionProgramName = '';
  readonly nutritionDurationOptions = [1, 2, 3, 4, 5, 6, 8, 10, 12];
  private openedDirectlyToMacro = false;

  constructor(
    private router: Router,
    private coachSettingsService: CoachSettingsService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isVisible']?.currentValue === true) {
      this.showMacroTypeModal = false;
      this.showDurationModal = false;
      this.nutritionProgramName = this.presetProgramName || '';
      this.nutritionDurationWeeks = this.normalizedPresetDurationWeeks;
      this.openedDirectlyToMacro = false;

      setTimeout(() => this.applyAutoSelectionRules());
    }

    if (changes['isVisible']?.currentValue === false) {
      this.showMacroTypeModal = false;
      this.showDurationModal = false;
      this.openedDirectlyToMacro = false;
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

  get hasAnyPlanType(): boolean {
    return this.canCreateFullMealPlan || this.canCreateAnyMacroPlan;
  }

  get shouldShowMainModal(): boolean {
    return this.isVisible && !this.showMacroTypeModal && !this.showDurationModal;
  }

  get shouldShowDurationModal(): boolean {
    return this.isVisible && this.showDurationModal;
  }

  closeModal(): void {
    this.showMacroTypeModal = false;
    this.showDurationModal = false;
    this.openedDirectlyToMacro = false;
    this.onClose.emit();
  }

  createFullMealPlan(): void {
    if (!this.canCreateFullMealPlan) return;

    if (this.skipDurationStep) {
      this.confirmFullMealPlanDuration();
      return;
    }

    this.showDurationModal = true;
  }

  closeDurationModal(): void {
    this.showDurationModal = false;
  }

  confirmFullMealPlanDuration(): void {
    if (!this.nutritionProgramName.trim()) return;

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

  createMacroOnlyPlan(): void {
    if (!this.canCreateAnyMacroPlan) return;

    if (this.enabledMacroCount === 1) {
      this.openedDirectlyToMacro = true;
      this.showMacroTypeModal = true;
      return;
    }

    this.openedDirectlyToMacro = false;
    this.showMacroTypeModal = true;
  }

  closeMacroTypeModal(): void {
    this.showMacroTypeModal = false;

    if (this.openedDirectlyToMacro) {
      this.closeModal();
    }
  }

  private applyAutoSelectionRules(): void {
    if (!this.isVisible) return;

    if (!this.canCreateFullMealPlan && this.canCreateAnyMacroPlan) {
      if (this.enabledMacroCount === 1) {
        this.openedDirectlyToMacro = true;
        this.showMacroTypeModal = true;
        return;
      }

      this.openedDirectlyToMacro = true;
      this.showMacroTypeModal = true;
    }
  }

  private selectMacroDaily(): void {
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

  private selectMacroEachMeal(): void {
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
