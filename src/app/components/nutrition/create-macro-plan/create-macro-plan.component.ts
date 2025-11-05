import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { Router, ActivatedRoute } from '@angular/router';

interface MacroDay {
  id: string;
  dayNumber: number;
  name: string;
  description?: string;
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
  showDescription?: boolean;
  mealMacros?: MealMacros;
}

interface MacroMeal {
  id: string;
  name: string;
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
}

interface MealMacros {
  breakfast: { protein: number; carbs: number; fat: number; calories: number };
  lunch: { protein: number; carbs: number; fat: number; calories: number };
  dinner: { protein: number; carbs: number; fat: number; calories: number };
  snack: { protein: number; carbs: number; fat: number; calories: number };
}

@Component({
  selector: 'app-create-macro-plan',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule],
  templateUrl: './create-macro-plan.component.html',
  styleUrls: ['./create-macro-plan.component.scss']
})
export class CreateMacroPlanComponent implements OnInit, AfterViewInit {
  planName = '';
  planDescription = '';
  showPlanDescription = false;
  days: MacroDay[] = [];
  selectedDay: MacroDay | null = null;
  selectedMeal: MacroMeal | null = null;
  showDayDescription = false;
  viewMode: 'total' | 'meals' = 'total';
  showModeModal = true;

  isEditMode = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    const planId = this.route.snapshot.paramMap.get('id');
    const type = this.route.snapshot.queryParamMap.get('type');
    this.isEditMode = !!planId;
    
    if (planId) {
      this.showModeModal = false;
      this.viewMode = 'total';
      this.loadExistingPlan(planId);
    } else if (type === 'total' || type === 'each') {
      this.showModeModal = false;
      this.viewMode = type === 'total' ? 'total' : 'meals';
      this.addDay();
    } else {
      this.showModeModal = true;
      this.addDay();
    }
  }

  loadExistingPlan(planId: string) {
    const existingPlan = this.findPlanById(planId);
    if (existingPlan) {
      this.planName = existingPlan.name;
      this.planDescription = existingPlan.description || '';
      
      this.days = existingPlan.days?.map(day => ({
        id: day.dayNumber.toString(),
        dayNumber: day.dayNumber,
        name: day.name,
        description: day.description,
        protein: day.totalProtein || 0,
        carbs: day.totalCarbs || 0,
        fat: day.totalFat || 0,
        calories: day.totalCalories || 0,
        mealMacros: {
          breakfast: { protein: 0, carbs: 0, fat: 0, calories: 0 },
          lunch: { protein: 0, carbs: 0, fat: 0, calories: 0 },
          dinner: { protein: 0, carbs: 0, fat: 0, calories: 0 },
          snack: { protein: 0, carbs: 0, fat: 0, calories: 0 }
        }
      })) || [];
      
      if (this.days.length === 0) {
        this.addDay();
      } else {
        this.selectedDay = this.days[0];
      }
    } else {
      this.addDay();
    }
  }

  findPlanById(id: string) {
    const plans = [
      {
        id: '2',
        name: '2750kcal',
        description: 'Full Plan',
        type: 'MACRO_ONLY',
        days: [{
          dayNumber: 1,
          name: 'Day 1',
          description: '',
          totalProtein: 230,
          totalCarbs: 170,
          totalFat: 123,
          totalCalories: 2759
        }]
      }
    ];
    return plans.find(p => p.id === id);
  }



  addDay() {
    const newDay: MacroDay = {
      id: Date.now().toString(),
      dayNumber: this.days.length + 1,
      name: `Day ${this.days.length + 1}`,
      protein: 0,
      carbs: 0,
      fat: 0,
      calories: 0,
      mealMacros: {
        breakfast: { protein: 0, carbs: 0, fat: 0, calories: 0 },
        lunch: { protein: 0, carbs: 0, fat: 0, calories: 0 },
        dinner: { protein: 0, carbs: 0, fat: 0, calories: 0 },
        snack: { protein: 0, carbs: 0, fat: 0, calories: 0 }
      }
    };
    this.days.push(newDay);
    this.selectedDay = newDay;
  }

  duplicateDay(day: MacroDay, event: Event) {
    event.stopPropagation();
    const duplicated: MacroDay = {
      ...day,
      id: Date.now().toString() + Math.random(),
      dayNumber: this.days.length + 1,
      name: `Day ${this.days.length + 1}`,
      mealMacros: day.mealMacros ? {
        breakfast: { ...day.mealMacros.breakfast },
        lunch: { ...day.mealMacros.lunch },
        dinner: { ...day.mealMacros.dinner },
        snack: { ...day.mealMacros.snack }
      } : {
        breakfast: { protein: 0, carbs: 0, fat: 0, calories: 0 },
        lunch: { protein: 0, carbs: 0, fat: 0, calories: 0 },
        dinner: { protein: 0, carbs: 0, fat: 0, calories: 0 },
        snack: { protein: 0, carbs: 0, fat: 0, calories: 0 }
      }
    };
    this.days.push(duplicated);
    this.selectedDay = duplicated;
  }

  duplicateSelectedDay() {
    if (this.selectedDay) {
      const duplicated: MacroDay = {
        ...this.selectedDay,
        id: Date.now().toString() + Math.random(),
        dayNumber: this.days.length + 1,
        name: `Day ${this.days.length + 1}`,
        mealMacros: this.selectedDay.mealMacros ? {
          breakfast: { ...this.selectedDay.mealMacros.breakfast },
          lunch: { ...this.selectedDay.mealMacros.lunch },
          dinner: { ...this.selectedDay.mealMacros.dinner },
          snack: { ...this.selectedDay.mealMacros.snack }
        } : {
          breakfast: { protein: 0, carbs: 0, fat: 0, calories: 0 },
          lunch: { protein: 0, carbs: 0, fat: 0, calories: 0 },
          dinner: { protein: 0, carbs: 0, fat: 0, calories: 0 },
          snack: { protein: 0, carbs: 0, fat: 0, calories: 0 }
        }
      };
      this.days.push(duplicated);
      this.selectedDay = duplicated;
    }
  }

  deleteDay(day: MacroDay, event: Event) {
    event.stopPropagation();
    if (this.days.length > 1) {
      const index = this.days.findIndex(d => d.id === day.id);
      this.days.splice(index, 1);
      
      // Renumber remaining days
      this.days.forEach((d, i) => {
        d.dayNumber = i + 1;
        d.name = `Day ${i + 1}`;
      });
      
      // Select another day if the deleted one was selected
      if (this.selectedDay?.id === day.id) {
        this.selectedDay = this.days[Math.max(0, index - 1)];
      }
    }
  }

  selectDay(day: MacroDay) {
    this.selectedDay = day;
  }

  calculateCalories(day: MacroDay) {
    if (this.viewMode === 'total') {
      day.calories = (day.protein * 4) + (day.carbs * 4) + (day.fat * 9);
    } else {
      // Calculate from meal macros
      const meals = day.mealMacros!;
      day.protein = meals.breakfast.protein + meals.lunch.protein + meals.dinner.protein + meals.snack.protein;
      day.carbs = meals.breakfast.carbs + meals.lunch.carbs + meals.dinner.carbs + meals.snack.carbs;
      day.fat = meals.breakfast.fat + meals.lunch.fat + meals.dinner.fat + meals.snack.fat;
      day.calories = (day.protein * 4) + (day.carbs * 4) + (day.fat * 9);
    }
  }

  calculateMealCalories(meal: any) {
    meal.calories = (meal.protein * 4) + (meal.carbs * 4) + (meal.fat * 9);
    if (this.selectedDay) {
      this.calculateCalories(this.selectedDay);
    }
  }

  togglePlanDescription() {
    this.showPlanDescription = !this.showPlanDescription;
  }

  toggleDayDescription() {
    if (this.selectedDay) {
      this.selectedDay.showDescription = !this.selectedDay.showDescription;
    }
  }

  savePlan() {
    // TODO: Implement save functionality
    console.log('Saving plan:', { name: this.planName, description: this.planDescription, days: this.days });
    this.router.navigate(['/nutrition/plans']);
  }

  selectMode(mode: 'total' | 'meals') {
    this.viewMode = mode;
    this.showModeModal = false;
  }

  ngAfterViewInit() {
    // Modal handling
  }

  goBack() {
    this.router.navigate(['/nutrition/plans']);
  }
}