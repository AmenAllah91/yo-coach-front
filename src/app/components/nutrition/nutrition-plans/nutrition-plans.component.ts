import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { NutritionService, NutritionPlan } from '../../../service/nutrition.service';
import { NutritionBlocService } from '../../../service/nutrition-bloc.service';
import { DeleteNutritionPlanModalComponent } from '../delete-nutrition-plan-modal/delete-nutrition-plan-modal.component';
import { ChoosePlanTypeModalComponent } from '../choose-plan-type-modal/choose-plan-type-modal.component';

@Component({
  selector: 'app-nutrition-plans',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, DeleteNutritionPlanModalComponent, ChoosePlanTypeModalComponent],
  templateUrl: './nutrition-plans.component.html',
  styleUrls: ['./nutrition-plans.component.scss']
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
      .subscribe(state => {
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
    
    // Template data with coach ID: 9247e8e1-0ce7-469e-9569-10ed490fb755
    const templatePlans: NutritionPlan[] = [
      {
        id: '1',
        name: 'meal1',
        description: 'Full Plan',
        type: 'FULL_MEAL',
        coachId: '9247e8e1-0ce7-469e-9569-10ed490fb755',
        days: [
          {
            dayNumber: 1,
            name: 'Day 1',
            description: '',
            totalProtein: 13,
            totalCarbs: 1.1,
            totalFat: 11,
            totalCalories: 158
          }
        ],
        lastModifiedDate: '2025-08-16T05:57:00Z'
      },
      {
        id: '2',
        name: '2750kcal',
        description: 'Full Plan',
        type: 'FULL_MEAL',
        coachId: '9247e8e1-0ce7-469e-9569-10ed490fb755',
        days: [
          {
            dayNumber: 1,
            name: 'Day 1',
            description: '',
            totalProtein: 230,
            totalCarbs: 170,
            totalFat: 123,
            totalCalories: 2759
          }
        ],
        lastModifiedDate: '2025-08-16T05:11:00Z'
      },
      {
        id: '3',
        name: '2000kcal',
        description: 'Full Plan',
        type: 'MACRO_ONLY',
        coachId: '9247e8e1-0ce7-469e-9569-10ed490fb755',
        days: [
          {
            dayNumber: 1,
            name: 'Day 1',
            description: '',
            totalProtein: 169,
            totalCarbs: 180,
            totalFat: 60,
            totalCalories: 2020
          }
        ],
        lastModifiedDate: '2025-08-16T05:11:00Z'
      },
      {
        id: '4',
        name: '2250kcal',
        description: 'Full Plan',
        type: 'MACRO_ONLY',
        coachId: '9247e8e1-0ce7-469e-9569-10ed490fb755',
        days: [
          {
            dayNumber: 1,
            name: 'Day 1',
            description: '',
            totalProtein: 202,
            totalCarbs: 171,
            totalFat: 73,
            totalCalories: 2241
          }
        ],
        lastModifiedDate: '2025-08-16T05:11:00Z'
      },
      {
        id: '5',
        name: '1750kcal',
        description: 'Full Plan',
        type: 'MACRO_ONLY',
        coachId: '9247e8e1-0ce7-469e-9569-10ed490fb755',
        days: [
          {
            dayNumber: 1,
            name: 'Day 1',
            description: '',
            totalProtein: 143,
            totalCarbs: 148,
            totalFat: 59,
            totalCalories: 1753
          }
        ],
        lastModifiedDate: '2025-08-16T05:11:00Z'
      }
    ];
    
    this.nutritionBloc.setPlans(templatePlans);
    
    // Uncomment when backend is ready
    // this.nutritionService.getNutritionPlans().subscribe({
    //   next: (plans) => {
    //     this.nutritionBloc.setPlans(plans);
    //   },
    //   error: (error) => {
    //     console.error('Error loading plans:', error);
    //     this.nutritionBloc.setError('Failed to load nutrition plans');
    //   }
    // });
  }

  get filteredPlans() {
    return this.plans.filter(plan =>
      plan.name.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }

  openChooseModal() {
    this.showChooseModal = true;
  }

  closeChooseModal() {
    this.showChooseModal = false;
  }

  createMacroOnlyPlan() {
    this.closeChooseModal();
    this.router.navigate(['/nutrition/create-macro-plan']);
  }

  createFullMealPlan() {
    this.closeChooseModal();
    // TODO: Navigate to full meal plan creation
  }

  editPlan(plan: NutritionPlan) {
    console.log('Edit plan:', plan.name);
    this.openDropdownId = null;
  }

  openDeleteModal(plan: NutritionPlan) {
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
      this.nutritionService.deleteNutritionPlan(this.selectedPlan.id!).subscribe({
        next: () => {
          this.nutritionBloc.removePlan(this.selectedPlan!.id!);
          this.closeDeleteModal();
        },
        error: (error) => {
          console.error('Error deleting plan:', error);
          this.nutritionBloc.setError('Failed to delete nutrition plan');
          this.closeDeleteModal();
        }
      });
    }
  }

  toggleDropdown(planId: string, event: Event) {
    event.stopPropagation();
    this.openDropdownId = this.openDropdownId === planId ? null : planId;
  }

  assignPlan(plan: NutritionPlan) {
    // TODO: Implement assign functionality
    console.log('Assign plan:', plan.name);
    this.openDropdownId = null;
  }

  duplicatePlan(plan: NutritionPlan) {
    // TODO: Implement duplicate functionality
    console.log('Duplicate plan:', plan.name);
    this.openDropdownId = null;
  }

  formatDate(date: string | undefined): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getTotalProtein(plan: NutritionPlan): string {
    const total = plan.days?.reduce((sum, day) => sum + (day.totalProtein || 0), 0) || 0;
    return `${Math.round(total)}g Protein`;
  }

  getTotalCarbs(plan: NutritionPlan): string {
    const total = plan.days?.reduce((sum, day) => sum + (day.totalCarbs || 0), 0) || 0;
    return `${Math.round(total)}g Carbs`;
  }

  getTotalFat(plan: NutritionPlan): string {
    const total = plan.days?.reduce((sum, day) => sum + (day.totalFat || 0), 0) || 0;
    return `${Math.round(total)}g Fat`;
  }

  getTotalCalories(plan: NutritionPlan): string {
    const total = plan.days?.reduce((sum, day) => sum + (day.totalCalories || 0), 0) || 0;
    return `${Math.round(total)}Kcal`;
  }
}