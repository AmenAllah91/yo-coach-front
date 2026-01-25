import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import {
  NutritionService,
  NutritionPlan,
} from '../../../service/nutrition.service';
import { NutritionBlocService } from '../../../service/nutrition-bloc.service';
import { DeleteNutritionPlanModalComponent } from '../delete-nutrition-plan-modal/delete-nutrition-plan-modal.component';
import { ChoosePlanTypeModalComponent } from '../choose-plan-type-modal/choose-plan-type-modal.component';
import { ModalAssignToclientComponent } from 'app/components/clients/modal-assign-toclient/modal-assign-toclient.component';

@Component({
  selector: 'app-nutrition-plans',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FeatherModule,
    DeleteNutritionPlanModalComponent,
    ChoosePlanTypeModalComponent,
    ModalAssignToclientComponent,
  ],
  templateUrl: './nutrition-plans.component.html',
  styleUrls: ['./nutrition-plans.component.scss'],
})
export class NutritionPlansComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  plans: NutritionPlan[] = [];
  searchTerm = '';

  showChooseModal = false;
  showDeleteModal = false;
  selectedPlan: NutritionPlan | null = null;
  openDropdownId: string | null = null;
  loading = false;

  constructor(
    private nutritionService: NutritionService,
    private nutritionBloc: NutritionBlocService,
    private router: Router
  ) {}

  ngOnInit() {
    // Subscribe to nutrition state
    this.nutritionBloc.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe((state) => {
        this.plans = state.plans;
        this.loading = state.loading;
      });

    this.loadPlans();

    // Close dropdown when clicking outside
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown')) {
        this.openDropdownId = null;
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadPlans() {
    this.nutritionBloc.setLoading(true);

    // Uncomment when backend is ready
    this.nutritionService.getNutritionPlansTemplates().subscribe({
      next: (plans) => {
        this.plans = plans.content;
      },
      error: (error) => {
        console.error('Error loading plans:', error);
        this.nutritionBloc.setError('Failed to load nutrition plans');
      },
    });
  }

  get filteredPlans() {
    return this.plans.filter((plan) =>
      plan.name.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }

  openChooseModal() {
    this.showChooseModal = true;
  }

  closeChooseModal() {
    this.showChooseModal = false;
  }


  editPlan(plan: NutritionPlan) {
    if (plan.trackingMode === 'EACH_MEAL') {
      const url = 'nutrition/create-macro-plan/' + plan.id;
      this.router.navigateByUrl(url);
    } else if (plan.trackingMode === 'TOTAL_FOR_DAY') {
      const url = 'nutrition/create-macro-plan-total-day/' + plan.id;
      this.router.navigateByUrl(url);
    } else {
      const url = 'nutrition/create-full-plan/' + plan.id;
      this.router.navigateByUrl(url);
    }
  }

  openDeleteModal(plan: any) {
    console.log(plan);
    this.selectedPlan = plan;
    this.showDeleteModal = true;
    this.openDropdownId = null;
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
    this.selectedPlan = null;
  }

  confirmDelete() {
    if (this.selectedPlan) {
      this.nutritionService
        .deleteNutritionPlan(this.selectedPlan.id!)
        .subscribe({
          next: () => {
            this.closeDeleteModal();

            // 🔥 Rafraîchir la liste après suppression
            this.loadPlans();
          },
          error: (error) => {
            console.error('Error deleting plan:', error);
            this.nutritionBloc.setError('Failed to delete nutrition plan');
            this.closeDeleteModal();
          },
        });
    }
  }

  toggleDropdown(planId: string, event: Event) {
    event.stopPropagation();
    this.openDropdownId = this.openDropdownId === planId ? null : planId;
  }
  programToAssign: NutritionPlan | null = null;
  showAssignModal = false;
  assignToClients(program: NutritionPlan) {
    console.log('Assign to clients:', program);
    this.programToAssign = program;
    this.showAssignModal = true;
    this.openDropdownId = null;
  }

  closeAssignModal() {
    this.showAssignModal = false;
    this.programToAssign = null;
  }

  onProgramAssigned(event: any) {
    if (event.clients.length > 0) {
      for (const client of event.clients) {
        console.log(client);
        this.programToAssign.client = client;
        this.programToAssign.startDate = event.date;
        this.nutritionService
          .assignNutritionPlan(this.programToAssign)
          .subscribe((res) => {
            console.log(res);
            this.loadPlans();
          });
      }
    }
    console.log(event);

    /** event = { date: string, clients: Client[] } */

    this.showAssignModal = false;
  }

  duplicatePlan(id: string) {
    this.nutritionService.duplicate(id).subscribe({
      next: () => {
        this.loadPlans();
        this.openDropdownId = null;
      },
      error: (error) => console.error('Error duplicating program:', error),
    });
  }

  formatDate(date: string | undefined): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  getTotalProtein(plan: NutritionPlan): string {
    const total =
      plan.mealDays?.reduce(
        (sum, day) => sum + (day.dayTargets.proteinG || 0),
        0
      ) || 0;
    return `${total}g Protein`;
  }

  getTotalCarbs(plan: NutritionPlan): string {
    const total =
      plan.mealDays?.reduce(
        (sum, day) => sum + (day.dayTargets.carbsG || 0),
        0
      ) || 0;
    return `${total}g Carbs`;
  }

  getTotalFat(plan: NutritionPlan): string {
    const total =
      plan.mealDays?.reduce(
        (sum, day) => sum + (day.dayTargets.fatG || 0),
        0
      ) || 0;
    return `${total}g Fat`;
  }

  getTotalCalories(plan: NutritionPlan): string {
    console.log(plan);
    const total =
      plan.mealDays?.reduce(
        (sum, day) => sum + (day.dayTargets.calories || 0),
        0
      ) || 0;
    return `${total} Kcal`;
  }
}
