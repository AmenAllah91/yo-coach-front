import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NutritionService } from 'app/service/nutrition.service';

@Component({
  selector: 'app-nutrition-client-tab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './nutrition-client-tab.component.html',
  styleUrl: './nutrition-client-tab.component.scss',
})
export class NutritionClientTabComponent implements OnInit {
  @Input() clientId!: string;
  @Input() coachId!: string;
  @Output() assignNew = new EventEmitter<void>();
  mealPlan: any[] = [];

  page = 0;
  size = 5;
  totalPages = 0;
  pagesArray: number[] = [];

  constructor(
    private nutritionService: NutritionService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (this.clientId && this.coachId) {
      this.getMealPlanByCoachAndClient(this.coachId, this.clientId);
    }
  }

  changePage(newPage: number) {
    if (newPage < 0 || newPage >= this.totalPages) return;
    this.page = newPage;
    this.getMealPlanByCoachAndClient(this.coachId, this.clientId);
  }

  getMealPlanByCoachAndClient(idCoach: string, idClient: string) {
    this.nutritionService
      .getNutritionPlanByCoachIdAndClient(
        idCoach,
        idClient,
        this.page,
        this.size
      )
      .subscribe((res) => {
        this.totalPages = res.totalPages;
        this.pagesArray = Array.from({ length: this.totalPages }, (_, i) => i);

        this.mealPlan = res.content.map((program: any) => {
          const start = new Date(program.startDate);

          // ⚠️ ici corrige selon ton backend:
          // probablement program.mealDays (pas workoutDays)
          const totalDays = program.mealDays?.length || 0;

          const end = new Date(start);
          end.setDate(end.getDate() + totalDays);
          program.endDate = end;

          const today = new Date();

          if (today < start) program.status = 'upcoming';
          else if (today >= start && today <= end) program.status = 'active';
          else program.status = 'completed';

          let daysPassed = 0;
          if (program.status === 'active') {
            const diffTime = today.getTime() - start.getTime();
            daysPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
          } else if (program.status === 'completed') {
            daysPassed = totalDays;
          }

          program.totalDays = totalDays;
          program.currentDay = Math.min(daysPassed, totalDays);
          program.progressPercent =
            (program.currentDay / program.totalDays) * 100;

          return program;
        });
      });
  }

  getDays(start: string, end: string): number {
    const s = new Date(start);
    const e = new Date(end);
    const diff = e.getTime() - s.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  editPlan(plan: any) {
    let url = 'clients';

    if (plan.trackingMode === 'TOTAL_FOR_DAY') {
      url =
        url +
        '/create-macro-plan-total-day/' +
        plan.client.id +
        '/edit/' +
        plan.id;
      this.router.navigateByUrl(url);
    } else if (plan.trackingMode === 'EACH_MEAL') {
      url = url + '/create-macro-plan/' + plan.client.id + '/edit/' + plan.id;
      this.router.navigateByUrl(url);
    } else {
      url = url + '/create-full-plan/' + plan.client.id + '/edit/' + plan.id;
      this.router.navigateByUrl(url);
    }
  }

  openAssignNutrition() {
    this.assignNew.emit();
  }
}
