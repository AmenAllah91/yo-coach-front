import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-configuration-coachng',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './configuration-coachng.component.html',
  styleUrl: './configuration-coachng.component.scss',
})
export class ConfigurationCoachngComponent {

  config = {
    nutrition: {
      fullMealPlan: true,
      macroPlanDaily: true,
      macroPlanMeal: true,
      defaultMeals: '5',
      autoCreateMeals: true,
    },
    quickActions: {
      assignAfterNutrition: true,
      assignAfterWorkout: true,
      assignAfterCheckIn: true,
      createAsTemplate: false,
    },
    workout: {
      strengthSets: '4',
      strengthReps: '12',
      cardioSets: '3',
      cardioMinutes: '20',
      autoFillDefaults: true,
    },
    defaults: {
      language: 'English',
    },
  };

  onCancel(): void { }
  onSave(): void { }

  toggleFullMealPlan(): void { this.config.nutrition.fullMealPlan = !this.config.nutrition.fullMealPlan; }
  toggleMacroPlanDaily(): void { this.config.nutrition.macroPlanDaily = !this.config.nutrition.macroPlanDaily; }
  toggleMacroPlanMeal(): void { this.config.nutrition.macroPlanMeal = !this.config.nutrition.macroPlanMeal; }
  toggleAutoCreateMeals(): void { this.config.nutrition.autoCreateMeals = !this.config.nutrition.autoCreateMeals; }
  toggleAssignAfterNutrition(): void { this.config.quickActions.assignAfterNutrition = !this.config.quickActions.assignAfterNutrition; }
  toggleAssignAfterWorkout(): void { this.config.quickActions.assignAfterWorkout = !this.config.quickActions.assignAfterWorkout; }
  toggleAssignAfterCheckIn(): void { this.config.quickActions.assignAfterCheckIn = !this.config.quickActions.assignAfterCheckIn; }
  toggleCreateAsTemplate(): void { this.config.quickActions.createAsTemplate = !this.config.quickActions.createAsTemplate; }
  toggleAutoFillDefaults(): void { this.config.workout.autoFillDefaults = !this.config.workout.autoFillDefaults; }
}
