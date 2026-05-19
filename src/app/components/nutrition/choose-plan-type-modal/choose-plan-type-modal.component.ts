import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { ChooseMacroTypeModalComponent } from '../choose-macro-type-modal/choose-macro-type-modal.component';
import { Router } from '@angular/router';
import { CoachSettingsService } from 'app/service/coach-settings.service';

@Component({
  selector: 'app-choose-plan-type-modal',
  standalone: true,
  imports: [CommonModule, FeatherModule, ChooseMacroTypeModalComponent],
  templateUrl: './choose-plan-type-modal.component.html',
  styleUrls: ['./choose-plan-type-modal.component.scss'],
})
export class ChoosePlanTypeModalComponent implements OnChanges {
  @Input() isVisible = false;
  @Input() isAssign = false;
  @Input() idClient: string = null;
  @Input() returnUrl: string | null = null;
  @Input() assignAfterCreate = false;

  @Output() onClose = new EventEmitter<void>();

  showMacroTypeModal = false;
  private openedDirectlyToMacro = false;

  constructor(
    private router: Router,
    private coachSettingsService: CoachSettingsService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isVisible']?.currentValue === true) {
      this.showMacroTypeModal = false;
      this.openedDirectlyToMacro = false;

      setTimeout(() => this.applyAutoSelectionRules());
    }

    if (changes['isVisible']?.currentValue === false) {
      this.showMacroTypeModal = false;
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
    return this.isVisible && !this.showMacroTypeModal;
  }

  closeModal(): void {
    this.showMacroTypeModal = false;
    this.openedDirectlyToMacro = false;
    this.onClose.emit();
  }

  createFullMealPlan(): void {
    if (!this.canCreateFullMealPlan) return;

    this.closeModal();

    const queryParams: any = {
      type: 'each',
      assignAfterCreate: this.assignAfterCreate,
    };

    if (this.returnUrl) {
      queryParams.returnUrl = this.returnUrl;
    }

    if (this.isAssign) {
      this.router.navigate([`/clients/create-full-plan/${this.idClient}`]);
      return;
    }

    this.router.navigate(['/nutrition/create-full-plan'], { queryParams });
  }

  createMacroOnlyPlan(): void {
    if (!this.canCreateAnyMacroPlan) return;

    if (this.enabledMacroCount === 1) {
      if (this.canCreateMacroDailyPlan) {
        this.selectMacroDaily();
        return;
      }

      if (this.canCreateMacroEachMealPlan) {
        this.selectMacroEachMeal();
        return;
      }
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
        if (this.canCreateMacroDailyPlan) {
          this.selectMacroDaily();
          return;
        }

        if (this.canCreateMacroEachMealPlan) {
          this.selectMacroEachMeal();
          return;
        }
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
    };

    if (this.returnUrl) {
      queryParams.returnUrl = this.returnUrl;
    }

    if (this.isAssign) {
      this.router.navigate([
        `/clients/create-macro-plan-total-day/${this.idClient}`,
      ]);
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
    };

    if (this.returnUrl) {
      queryParams.returnUrl = this.returnUrl;
    }

    if (this.isAssign) {
      this.router.navigate([`/clients/create-macro-plan/${this.idClient}`]);
      return;
    }

    this.router.navigate(['/nutrition/create-macro-plan'], {
      queryParams,
    });
  }
}
