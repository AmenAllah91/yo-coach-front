import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { Router } from '@angular/router';
import { CoachSettingsService } from 'app/service/coach-settings.service';

@Component({
  selector: 'app-choose-macro-type-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule],
  templateUrl: './choose-macro-type-modal.component.html',
  styleUrls: ['./choose-macro-type-modal.component.scss'],
})
export class ChooseMacroTypeModalComponent implements OnChanges {
  @Input() isVisible = false;
  @Input() isAssign = false;
  @Input() idClient: string = null;
  @Input() returnUrl: string | null = null;
  @Input() assignAfterCreate = false;

  @Output() close = new EventEmitter<void>();

  durationWeeks = 4;
  programName = '';
  readonly durationOptions = [1, 2, 3, 4, 5, 6, 8, 10, 12];
  selectedMacroType: 'total' | 'each' | null = null;
  private autoSelectionDone = false;

  constructor(
    private router: Router,
    private coachSettingsService: CoachSettingsService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isVisible']?.currentValue === true) {
      this.autoSelectionDone = false;
      setTimeout(() => this.applyAutoSelectionRules());
    }
  }

  get canCreateMacroDailyPlan(): boolean {
    return this.coachSettingsService.canCreateMacroDailyPlan();
  }

  get canCreateMacroEachMealPlan(): boolean {
    return this.coachSettingsService.canCreateMacroEachMealPlan();
  }

  get enabledMacroCount(): number {
    let count = 0;

    if (this.canCreateMacroDailyPlan) count++;
    if (this.canCreateMacroEachMealPlan) count++;

    return count;
  }

  get hasAnyMacroPlanType(): boolean {
    return this.canCreateMacroDailyPlan || this.canCreateMacroEachMealPlan;
  }

  get shouldShowModal(): boolean {
    return this.isVisible && this.enabledMacroCount !== 1 && !this.selectedMacroType;
  }

  get shouldShowDurationModal(): boolean {
    return this.isVisible && !!this.selectedMacroType;
  }

  closeModal(): void {
    this.selectedMacroType = null;
    this.close.emit();
  }

  selectTotalForDay(): void {
    if (!this.canCreateMacroDailyPlan) return;

    this.selectedMacroType = 'total';
  }

  selectEachMeal(): void {
    if (!this.canCreateMacroEachMealPlan) return;

    this.selectedMacroType = 'each';
  }

  closeDurationModal(): void {
    if (this.enabledMacroCount === 1) {
      this.closeModal();
      return;
    }

    this.selectedMacroType = null;
  }

  confirmDuration(): void {
    if (!this.programName.trim()) return;

    if (this.selectedMacroType === 'total') {
      this.navigateToTotalForDay();
      return;
    }

    if (this.selectedMacroType === 'each') {
      this.navigateToEachMeal();
    }
  }

  private navigateToTotalForDay(): void {
    this.closeModal();

    const queryParams: any = {
      type: 'total',
      assignAfterCreate: this.assignAfterCreate,
      durationWeeks: this.normalizedDurationWeeks,
      name: this.programName.trim(),
    };

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

  private navigateToEachMeal(): void {
    this.closeModal();

    const queryParams: any = {
      type: 'each',
      assignAfterCreate: this.assignAfterCreate,
      durationWeeks: this.normalizedDurationWeeks,
      name: this.programName.trim(),
    };

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

  private applyAutoSelectionRules(): void {
    if (!this.isVisible || this.autoSelectionDone) return;

    if (this.enabledMacroCount !== 1) return;

    this.autoSelectionDone = true;

    if (this.canCreateMacroDailyPlan) {
      this.selectTotalForDay();
      return;
    }

    if (this.canCreateMacroEachMealPlan) {
      this.selectEachMeal();
    }
  }

  get normalizedDurationWeeks(): number {
    const value = Number(this.durationWeeks) || 4;
    return Math.max(1, Math.min(value, 52));
  }
}
