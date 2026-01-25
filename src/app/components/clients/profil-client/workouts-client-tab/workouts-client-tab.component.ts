import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { WorkoutService } from 'app/service/workout.service';
import { WorkoutPlan } from '@shared/models/workout.models';

@Component({
  selector: 'app-workouts-client-tab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './workouts-client-tab.component.html',
  styleUrl: './workouts-client-tab.component.scss',
})
export class WorkoutsClientTabComponent implements OnInit {
  @Input() clientId!: string;
  @Input() coachId!: string;
  @Output() assignNew = new EventEmitter<void>();
  workoutPlan: WorkoutPlan[] = [];

  workoutPage = 0;
  workoutSize = 5;
  workoutTotalPages = 0;
  workoutPagesArray: number[] = [];

  constructor(private workoutService: WorkoutService, private router: Router) {}

  ngOnInit(): void {
    if (this.clientId && this.coachId) {
      this.getWorkOutPlanByCoachAndClient(this.coachId, this.clientId);
    }
  }

  changeWorkoutPage(newPage: number) {
    if (newPage < 0 || newPage >= this.workoutTotalPages) return;
    this.workoutPage = newPage;
    this.getWorkOutPlanByCoachAndClient(this.coachId, this.clientId);
  }

  getWorkOutPlanByCoachAndClient(idCoach: string, idClient: string) {
    this.workoutService
      .getWorkoutByCoachIdAndClient(
        idCoach,
        idClient,
        this.workoutPage,
        this.workoutSize
      )
      .subscribe((res) => {
        this.workoutTotalPages = res.totalPages;
        this.workoutPagesArray = Array.from(
          { length: this.workoutTotalPages },
          (_, i) => i
        );

        this.workoutPlan = res.content.map((program: WorkoutPlan) => {
          const start = new Date(program.startDate);
          const totalDays = program.workoutDays?.length || 0;

          const end = new Date(start);
          end.setDate(end.getDate() + totalDays);
          program.endDate = end.toDateString();

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

  // ton HTML appelle ça
  editWorkout(workout: WorkoutPlan) {
    const url =
      '/clients/create-workout/' + this.clientId + '/edit/' + workout.id;
    this.router.navigateByUrl(url);
  }

  openAssignWorkout() {
    this.assignNew.emit();
  }
}
