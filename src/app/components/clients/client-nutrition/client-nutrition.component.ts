import { Component } from '@angular/core';
import {CommonModule} from "@angular/common";
type DayStatus = 'completed' | 'missed' | 'pending';

interface Food {
  id: string;
  name: string;
  quantity: string;
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
}

interface Meal {
  id: string;
  name: string;
  foods: Food[];
}

interface NutritionDay {
  id: string;
  date: string;
  displayDate: string;
  programName: string;
  programType: string;
  status: DayStatus;
  mealCount: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalCalories: number;
  meals: Meal[];
}

@Component({
  selector: 'app-client-nutrition',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './client-nutrition.component.html',
  styleUrl: './client-nutrition.component.scss'
})
export class ClientNutritionComponent {
  activeTab: 'upcoming' | 'past' = 'upcoming';
  currentDate: Date = new Date(2022, 9, 1); // 1 Oct 2022
  selectedDay: NutritionDay | null = null;

  nutritionDays: NutritionDay[] = [
    {
      id: '1',
      date: '2022-10-01',
      displayDate: 'Today',
      programName: 'Balanced Diet Plan',
      programType: 'Weight Loss Program',
      // 👇 comme les workouts "Today" : pending
      status: 'pending',
      mealCount: 4,
      totalProtein: 169,
      totalCarbs: 180,
      totalFat: 60,
      totalCalories: 2000,
      meals: [
        {
          id: 'meal-1',
          name: 'Breakfast',
          foods: [
            {
              id: 'food-1',
              name: 'Oatmeal',
              quantity: '100g',
              protein: 13.2,
              carbs: 66.3,
              fat: 6.9,
              calories: 389,
            },
            {
              id: 'food-2',
              name: 'Banana',
              quantity: '1 medium',
              protein: 1.3,
              carbs: 27,
              fat: 0.4,
              calories: 105,
            },
          ],
        },
        {
          id: 'meal-2',
          name: 'Lunch',
          foods: [
            {
              id: 'food-3',
              name: 'Chicken Breast',
              quantity: '200g',
              protein: 62,
              carbs: 0,
              fat: 7.6,
              calories: 330,
            },
            {
              id: 'food-4',
              name: 'Brown Rice',
              quantity: '150g',
              protein: 7.5,
              carbs: 77.2,
              fat: 2.7,
              calories: 370,
            },
          ],
        },
        {
          id: 'meal-3',
          name: 'Snack',
          foods: [
            {
              id: 'food-5',
              name: 'Greek Yogurt',
              quantity: '200g',
              protein: 20,
              carbs: 7.8,
              fat: 10,
              calories: 200,
            },
          ],
        },
        {
          id: 'meal-4',
          name: 'Dinner',
          foods: [
            {
              id: 'food-6',
              name: 'Salmon',
              quantity: '150g',
              protein: 37.5,
              carbs: 0,
              fat: 20.3,
              calories: 344,
            },
            {
              id: 'food-7',
              name: 'Sweet Potato',
              quantity: '200g',
              protein: 4,
              carbs: 40,
              fat: 0.3,
              calories: 180,
            },
          ],
        },
      ],
    },
    {
      id: '2',
      date: '2022-10-11',
      displayDate: 'October 11, 2022',
      programName: 'High Protein Day',
      programType: 'Muscle Building',
      status: 'completed',
      mealCount: 5,
      totalProtein: 200,
      totalCarbs: 150,
      totalFat: 70,
      totalCalories: 2200,
      meals: [
        {
          id: 'meal-1',
          name: 'Breakfast',
          foods: [
            {
              id: 'food-1',
              name: 'Eggs',
              quantity: '4 large',
              protein: 25,
              carbs: 1.4,
              fat: 20,
              calories: 280,
            },
          ],
        },
        {
          id: 'meal-2',
          name: 'Morning Snack',
          foods: [
            {
              id: 'food-2',
              name: 'Protein Shake',
              quantity: '1 scoop',
              protein: 24,
              carbs: 3,
              fat: 1.5,
              calories: 120,
            },
          ],
        },
        {
          id: 'meal-3',
          name: 'Lunch',
          foods: [
            {
              id: 'food-3',
              name: 'Beef',
              quantity: '200g',
              protein: 52,
              carbs: 0,
              fat: 30,
              calories: 500,
            },
          ],
        },
        {
          id: 'meal-4',
          name: 'Afternoon Snack',
          foods: [
            {
              id: 'food-4',
              name: 'Almonds',
              quantity: '50g',
              protein: 10.5,
              carbs: 10.5,
              fat: 27,
              calories: 310,
            },
          ],
        },
        {
          id: 'meal-5',
          name: 'Dinner',
          foods: [
            {
              id: 'food-5',
              name: 'Turkey',
              quantity: '200g',
              protein: 58,
              carbs: 0,
              fat: 8,
              calories: 320,
            },
          ],
        },
      ],
    },
    {
      id: '3',
      date: '2022-10-09',
      displayDate: 'October 9, 2022',
      programName: 'Low Carb Day',
      programType: 'Keto Program',
      // tu peux en mettre un en "missed" si tu veux tester
      status: 'completed',
      mealCount: 3,
      totalProtein: 150,
      totalCarbs: 50,
      totalFat: 120,
      totalCalories: 1800,
      meals: [
        {
          id: 'meal-1',
          name: 'Breakfast',
          foods: [
            {
              id: 'food-1',
              name: 'Bacon',
              quantity: '100g',
              protein: 37,
              carbs: 1.4,
              fat: 42,
              calories: 541,
            },
          ],
        },
        {
          id: 'meal-2',
          name: 'Lunch',
          foods: [
            {
              id: 'food-2',
              name: 'Avocado',
              quantity: '1 whole',
              protein: 4,
              carbs: 17,
              fat: 30,
              calories: 320,
            },
          ],
        },
        {
          id: 'meal-3',
          name: 'Dinner',
          foods: [
            {
              id: 'food-3',
              name: 'Steak',
              quantity: '250g',
              protein: 65,
              carbs: 0,
              fat: 37.5,
              calories: 625,
            },
          ],
        },
      ],
    },
  ];

  // ======= helpers & computed =======

  get filteredDays(): NutritionDay[] {
    return this.nutritionDays.filter((day) =>
      this.activeTab === 'upcoming'
        ? day.status === 'pending'
        : day.status === 'completed' || day.status === 'missed'
    );
  }

  formatMonthYear(date: Date): string {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }

  handlePrevMonth(): void {
    this.currentDate = new Date(
      this.currentDate.getFullYear(),
      this.currentDate.getMonth() - 1,
      1
    );
  }

  handleNextMonth(): void {
    this.currentDate = new Date(
      this.currentDate.getFullYear(),
      this.currentDate.getMonth() + 1,
      1
    );
  }

  setActiveTab(tab: 'upcoming' | 'past'): void {
    this.activeTab = tab;
    this.selectedDay = null;
  }

  selectDay(day: NutritionDay): void {
    this.selectedDay = { ...day };
  }

  backToList(): void {
    this.selectedDay = null;
  }

  calculateMealTotals(meal: Meal): {
    protein: number;
    carbs: number;
    fat: number;
    calories: number;
  } {
    return meal.foods.reduce(
      (acc, food) => ({
        protein: acc.protein + food.protein,
        carbs: acc.carbs + food.carbs,
        fat: acc.fat + food.fat,
        calories: acc.calories + food.calories,
      }),
      { protein: 0, carbs: 0, fat: 0, calories: 0 }
    );
  }

  // 👇 version simple : on met à jour le seul tableau nutritionDays
  updateDayStatus(status: DayStatus) {
    if (!this.selectedDay) return;

    this.nutritionDays = this.nutritionDays.map((day) =>
      day.id === this.selectedDay!.id ? { ...day, status } : day
    );

    this.selectedDay = { ...this.selectedDay, status };
  }

  get greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  userName = 'Kolton';
}
