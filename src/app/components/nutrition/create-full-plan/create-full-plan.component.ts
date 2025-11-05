import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { Router, ActivatedRoute } from '@angular/router';

interface Food {
  id: string;
  name: string;
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
  servingSize: number;
  servingUnit: string;
  isOwn?: boolean;
}

interface MealFood {
  food: Food;
  quantity: number;
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
}

interface Meal {
  id: string;
  name: string;
  foods: MealFood[];
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalCalories: number;
}

interface FullDay {
  id: string;
  dayNumber: number;
  name: string;
  description?: string;
  meals: Meal[];
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalCalories: number;
  showDescription?: boolean;
}

@Component({
  selector: 'app-create-full-plan',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule],
  templateUrl: './create-full-plan.component.html',
  styleUrls: ['./create-full-plan.component.scss']
})
export class CreateFullPlanComponent implements OnInit {
  planName = '';
  planDescription = '';
  showPlanDescription = false;
  days: FullDay[] = [];
  selectedDay: FullDay | null = null;
  showAddFoodModal = false;
  showMealTemplateModal = false;
  selectedMeal: Meal | null = null;
  foodSearchTerm = '';
  templateSearchTerm = '';
  foodSearchType: 'all' | 'own' = 'all';
  selectedFood: Food | null = null;
  foodQuantity = 1;
  openMealDropdown: string | null = null;
  trackingMethod: 'total' | 'each' | null = null;
  isEditMode = false;

  allFoods: Food[] = [
    {
      id: '1',
      name: 'Chicken Breast',
      protein: 31,
      carbs: 0,
      fat: 3.6,
      calories: 165,
      servingSize: 100,
      servingUnit: 'g'
    },
    {
      id: '2',
      name: 'Brown Rice',
      protein: 2.6,
      carbs: 23,
      fat: 0.9,
      calories: 111,
      servingSize: 100,
      servingUnit: 'g'
    },
    {
      id: '3',
      name: 'Banana',
      protein: 1.1,
      carbs: 23,
      fat: 0.3,
      calories: 89,
      servingSize: 1,
      servingUnit: 'pcs'
    },
    {
      id: '5',
      name: 'Milk',
      protein: 3.4,
      carbs: 5,
      fat: 1,
      calories: 42,
      servingSize: 100,
      servingUnit: 'ml'
    },
    {
      id: '6',
      name: 'Eggs',
      protein: 13,
      carbs: 1.1,
      fat: 11,
      calories: 155,
      servingSize: 1,
      servingUnit: 'pcs'
    }
  ];

  ownFoods: Food[] = [
    {
      id: '4',
      name: 'Protein Shake',
      protein: 25,
      carbs: 5,
      fat: 2,
      calories: 140,
      servingSize: 250,
      servingUnit: 'ml',
      isOwn: true
    }
  ];

  mealTemplates: Meal[] = [
    {
      id: 't1',
      name: 'High Protein Breakfast',
      foods: [],
      totalProtein: 30,
      totalCarbs: 15,
      totalFat: 10,
      totalCalories: 250
    },
    {
      id: 't2',
      name: 'Balanced Lunch',
      foods: [],
      totalProtein: 25,
      totalCarbs: 40,
      totalFat: 15,
      totalCalories: 365
    }
  ];

  constructor(
    private router: Router,
    public route: ActivatedRoute
  ) {}

  ngOnInit() {
    const planId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!planId;
    if (planId) {
      this.loadExistingPlan(planId);
    } else {
      this.addDay();
      const type = this.route.snapshot.queryParamMap.get('type');
      if (type === 'total' || type === 'each') {
        this.trackingMethod = type;
      }
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
        meals: [this.createMeal('Breakfast')],
        totalProtein: day.totalProtein || 0,
        totalCarbs: day.totalCarbs || 0,
        totalFat: day.totalFat || 0,
        totalCalories: day.totalCalories || 0
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
        id: '1',
        name: 'meal1',
        description: 'Full Plan',
        type: 'FULL_MEAL',
        days: [{
          dayNumber: 1,
          name: 'Day 1',
          description: '',
          totalProtein: 13,
          totalCarbs: 1.1,
          totalFat: 11,
          totalCalories: 158
        }]
      }
    ];
    return plans.find(p => p.id === id);
  }

  get filteredFoods(): Food[] {
    const foods = this.foodSearchType === 'all' ? this.allFoods : this.ownFoods;
    return foods.filter(food => 
      food.name.toLowerCase().includes(this.foodSearchTerm.toLowerCase())
    );
  }

  get filteredTemplates(): Meal[] {
    return this.mealTemplates.filter(template => 
      template.name.toLowerCase().includes(this.templateSearchTerm.toLowerCase())
    );
  }

  addDay() {
    const newDay: FullDay = {
      id: Date.now().toString(),
      dayNumber: this.days.length + 1,
      name: `Day ${this.days.length + 1}`,
      meals: [this.createMeal('Breakfast')],
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
      totalCalories: 0
    };
    this.days.push(newDay);
    this.selectedDay = newDay;
  }

  duplicateDay(day: FullDay, event: Event) {
    event.stopPropagation();
    const duplicated: FullDay = {
      ...day,
      id: Date.now().toString() + Math.random(),
      dayNumber: this.days.length + 1,
      name: `Day ${this.days.length + 1}`,
      meals: day.meals.map(meal => ({
        ...meal,
        id: Date.now().toString() + Math.random(),
        foods: meal.foods.map(food => ({ ...food }))
      }))
    };
    this.days.push(duplicated);
    this.selectedDay = duplicated;
  }

  selectDay(day: FullDay) {
    this.selectedDay = day;
  }

  createMeal(name: string): Meal {
    return {
      id: Date.now().toString() + Math.random(),
      name,
      foods: [],
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
      totalCalories: 0
    };
  }

  addMeal() {
    if (this.selectedDay) {
      const mealNumber = this.selectedDay.meals.length + 1;
      const mealName = mealNumber === 2 ? 'Lunch' : 
                      mealNumber === 3 ? 'Dinner' : 
                      mealNumber === 4 ? 'Snack' : `Meal ${mealNumber}`;
      
      this.selectedDay.meals.push(this.createMeal(mealName));
    }
  }

  duplicateMeal(meal: Meal) {
    if (this.selectedDay) {
      const duplicated: Meal = {
        ...meal,
        id: Date.now().toString() + Math.random(),
        name: `${meal.name} (Copy)`,
        foods: [...meal.foods]
      };
      this.selectedDay.meals.push(duplicated);
    }
  }

  saveMealAsTemplate(meal: Meal) {
    const template: Meal = {
      ...meal,
      id: 't' + Date.now(),
      foods: [...meal.foods]
    };
    this.mealTemplates.push(template);
  }

  openAddFoodModal(meal: Meal) {
    this.selectedMeal = meal;
    this.showAddFoodModal = true;
    this.foodSearchTerm = '';
    this.selectedFood = null;
  }

  selectFood(food: Food) {
    this.selectedFood = food;
    this.foodQuantity = food.servingSize;
  }

  calculateNutrition(): { protein: number, carbs: number, fat: number, calories: number } {
    if (!this.selectedFood) return { protein: 0, carbs: 0, fat: 0, calories: 0 };
    
    const ratio = this.foodQuantity / this.selectedFood.servingSize;
    return {
      protein: Math.round(this.selectedFood.protein * ratio * 10) / 10,
      carbs: Math.round(this.selectedFood.carbs * ratio * 10) / 10,
      fat: Math.round(this.selectedFood.fat * ratio * 10) / 10,
      calories: Math.round(this.selectedFood.calories * ratio)
    };
  }

  addFoodToMeal() {
    if (this.selectedFood && this.selectedMeal) {
      const nutrition = this.calculateNutrition();
      const mealFood: MealFood = {
        food: this.selectedFood,
        quantity: this.foodQuantity,
        ...nutrition
      };
      
      this.selectedMeal.foods.push(mealFood);
      this.updateMealTotals(this.selectedMeal);
      this.updateDayTotals();
      this.closeAddFoodModal();
    }
  }

  updateMealTotals(meal: Meal) {
    meal.totalProtein = Math.round(meal.foods.reduce((sum, f) => sum + f.protein, 0) * 10) / 10;
    meal.totalCarbs = Math.round(meal.foods.reduce((sum, f) => sum + f.carbs, 0) * 10) / 10;
    meal.totalFat = Math.round(meal.foods.reduce((sum, f) => sum + f.fat, 0) * 10) / 10;
    meal.totalCalories = Math.round(meal.foods.reduce((sum, f) => sum + f.calories, 0));
  }

  updateDayTotals() {
    if (this.selectedDay) {
      this.selectedDay.totalProtein = this.selectedDay.meals.reduce((sum, m) => sum + m.totalProtein, 0);
      this.selectedDay.totalCarbs = this.selectedDay.meals.reduce((sum, m) => sum + m.totalCarbs, 0);
      this.selectedDay.totalFat = this.selectedDay.meals.reduce((sum, m) => sum + m.totalFat, 0);
      this.selectedDay.totalCalories = this.selectedDay.meals.reduce((sum, m) => sum + m.totalCalories, 0);
    }
  }

  removeFoodFromMeal(meal: Meal, index: number) {
    meal.foods.splice(index, 1);
    this.updateMealTotals(meal);
    this.updateDayTotals();
  }

  closeAddFoodModal() {
    this.showAddFoodModal = false;
    this.selectedMeal = null;
    this.selectedFood = null;
    this.foodQuantity = 1;
    this.foodSearchTerm = '';
  }

  selectTrackingMethod(method: 'total' | 'each') {
    this.trackingMethod = method;
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
    this.router.navigate(['/nutrition/plans']);
  }

  toggleMealDropdown(mealId: string, event: Event) {
    event.stopPropagation();
    this.openMealDropdown = this.openMealDropdown === mealId ? null : mealId;
  }

  closeMealDropdown() {
    this.openMealDropdown = null;
  }

  goBack() {
    this.router.navigate(['/nutrition/plans']);
  }

  addMealFromTemplate(template: Meal) {
    if (this.selectedDay) {
      const newMeal: Meal = {
        ...template,
        id: Date.now().toString() + Math.random(),
        foods: [...template.foods]
      };
      this.selectedDay.meals.push(newMeal);
      this.updateDayTotals();
      this.showMealTemplateModal = false;
    }
  }

  openMealTemplateModal() {
    this.showMealTemplateModal = true;
    this.templateSearchTerm = '';
  }
}