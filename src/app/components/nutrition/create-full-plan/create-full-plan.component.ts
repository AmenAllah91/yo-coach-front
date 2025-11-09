import { Component, OnInit } from '@angular/core';
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

  // ➜ ajoute ceci :
  meals?: MacroMeal[];
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
interface Food {
  id: number | string;
  name: string;
  protein: number; // pour 100g
  carbs: number;   // pour 100g
  fat: number;     // pour 100g
  calories: number; // pour 100g
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
  days: MacroDay[] = [];
  selectedDay: MacroDay | null = null;
  selectedMeal: MacroMeal | null = null;
  showDayDescription = false;
  viewMode: 'total' | 'meals' = 'total';
  showModeModal = true;

  isEditMode = false;
  trackByDay = (_: number, d: MacroDay) => d.id;
  trackByMeal = (_: number, m: MacroMeal) => m.id;   // <-- NEW
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
  private makeMeal(name = 'New Meal'): MacroMeal {
    return { id: crypto.randomUUID?.() ?? Date.now().toString(), name, protein: 0, carbs: 0, fat: 0, calories: 0 };
  }

  loadExistingPlan(planId: string) {
    // const existingPlan = this.findPlanById(planId);
    // if (existingPlan) {
    //   this.planName = existingPlan.name;
    //   this.planDescription = existingPlan.description || '';
    //
    //   this.days = existingPlan.days?.map(day => ({
    //     id: day.dayNumber.toString(),
    //     dayNumber: day.dayNumber,
    //     name: day.name,
    //     description: day.description,
    //     protein: day.totalProtein || 0,
    //     carbs: day.totalCarbs || 0,
    //     fat: day.totalFat || 0,
    //     calories: day.totalCalories || 0,
    //     mealMacros: {
    //       breakfast: { protein: 0, carbs: 0, fat: 0, calories: 0 },
    //       lunch: { protein: 0, carbs: 0, fat: 0, calories: 0 },
    //       dinner: { protein: 0, carbs: 0, fat: 0, calories: 0 },
    //       snack: { protein: 0, carbs: 0, fat: 0, calories: 0 }
    //     }
    //   })) || [];
    //
    //   if (this.days.length === 0) {
    //     this.addDay();
    //   } else {
    //     this.selectedDay = this.days[0];
    //   }
    // } else {
    //   this.addDay();
    // }
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

  addDay() {
    const newDay: MacroDay = {
      id: Date.now().toString(),
      dayNumber: this.days.length + 1,
      name: `Day ${this.days.length + 1}`,
      protein: 0, carbs: 0, fat: 0, calories: 0,
      mealMacros: {
        breakfast: { protein: 0, carbs: 0, fat: 0, calories: 0 },
        lunch:     { protein: 0, carbs: 0, fat: 0, calories: 0 },
        dinner:    { protein: 0, carbs: 0, fat: 0, calories: 0 },
        snack:     { protein: 0, carbs: 0, fat: 0, calories: 0 }
      },
      // ➜ initialise la liste de repas
      meals: [
        { id: crypto.randomUUID?.() ?? String(Date.now()),
          name: 'New Meal', protein: 0, carbs: 0, fat: 0, calories: 0 }
      ]
    };
    this.days.push(newDay);
    this.selectedDay = newDay;
  }


  // Deep copy pour duplicate (inclure les meals)
  duplicateDay(day: MacroDay, event: Event) {
    event.stopPropagation();
    const duplicated: MacroDay = {
      ...day,
      id: Date.now().toString() + Math.random(),
      dayNumber: this.days.length + 1,
      name: `Day ${this.days.length + 1}`,
      meals: day.meals.map(m => ({ ...m, id: Date.now().toString() + Math.random() }))
    };
    this.days.push(duplicated);
    this.selectedDay = duplicated;
  }
  duplicateSelectedDay() {
    if (!this.selectedDay) return;
    const src = this.selectedDay;
    const duplicated: MacroDay = {
      ...src,
      id: Date.now().toString() + Math.random(),
      dayNumber: this.days.length + 1,
      name: `Day ${this.days.length + 1}`,
      meals: src.meals.map(m => ({ ...m, id: Date.now().toString() + Math.random() }))
    };
    this.days.push(duplicated);
    this.selectedDay = duplicated;
  }

  // === Meals actions ===
  addMeal() {
    if (!this.selectedDay) return;
    this.selectedDay.meals ??= [];
    this.selectedDay.meals.push({
      id: crypto.randomUUID?.() ?? String(Date.now()),
      name: 'New Meal', protein: 0, carbs: 0, fat: 0, calories: 0
    });
  }


  removeMeal(meal: MacroMeal, day?: MacroDay) {
    const d = day ?? this.selectedDay;
    if (!d) return;
    d.meals = d.meals.filter(m => m.id !== meal.id);
    this.calculateCalories(d);
  }

  renameMeal(meal: MacroMeal, name: string) {
    meal.name = name?.trim() || meal.name;
  }

  // Recalcule les totals depuis les meals (pratique même en mode 'meals')
  private recalcDayFromMeals(day: MacroDay) {
    day.protein = day.meals.reduce((s,m)=>s+m.protein,0);
    day.carbs   = day.meals.reduce((s,m)=>s+m.carbs,0);
    day.fat     = day.meals.reduce((s,m)=>s+m.fat,0);
    day.calories = (day.protein*4) + (day.carbs*4) + (day.fat*9);
  }

  calculateMealCalories(meal: MacroMeal) {
    meal.calories = (meal.protein*4)+(meal.carbs*4)+(meal.fat*9);
    if (this.selectedDay) this.recalcDayFromMeals(this.selectedDay);
  }

  calculateCalories(day: MacroDay) {
    // si tu veux prioriser le mode 'meals'
    if (day.meals?.length) {
      this.recalcDayFromMeals(day);
    } else {
      day.calories = (day.protein * 4) + (day.carbs * 4) + (day.fat * 9);
    }
  }

  isFoodModalOpen = false;
  mealForModal: MacroMeal | null = null;
  foodSearch = '';
  recentFoods = [
    { id: 1, name: 'Chicken Breast', protein: 31, carbs: 0,  fat: 3.6, calories: 165 },
    { id: 2, name: 'Brown Rice',     protein: 2.6, carbs: 23, fat: 0.9, calories: 112 },
    { id: 3, name: 'Broccoli',       protein: 2.8, carbs: 6.6, fat: 0.4, calories: 34 },
  ];
  filteredFoods = [...this.recentFoods];

  // openFoodModal(meal: MacroMeal){ this.mealForModal = meal; this.isFoodModalOpen = true; this.foodSearch=''; this.filteredFoods=[...this.recentFoods]; }
  selectFood(f:any){ if(!this.mealForModal) return; this.mealForModal.protein+=f.protein; this.mealForModal.carbs+=f.carbs; this.mealForModal.fat+=f.fat; this.calculateMealCalories(this.mealForModal); this.closeFoodModal(); }


// ======== MODAL STATE ========
  foodStep: 'list' | 'detail' = 'list';

// Étape détail
  selectedFood: Food | null = null;
  foodQty = 100;            // quantité saisie
  foodUnit: 'g' | 'serving' = 'g';
  servingGram = 100;        // 1 "serving" = 100g par défaut (change si tu as des vraies tailles)
  adj = { calories: 0, protein: 0, carbs: 0, fat: 0 }; // valeurs ajustées affichées

  openFoodModal(meal: MacroMeal) {
    this.mealForModal = meal;
    this.isFoodModalOpen = true;
    this.foodStep = 'list';
    this.foodSearch = '';
    this.filteredFoods = [...this.recentFoods];
    this.selectedFood = null;
  }

  closeFoodModal() {
    this.isFoodModalOpen = false;
    this.mealForModal = null;
    this.selectedFood = null;
  }

  filterFoods() {
    const q = (this.foodSearch || '').toLowerCase();
    this.filteredFoods = !q ? [...this.recentFoods] :
      this.recentFoods.filter(f => f.name.toLowerCase().includes(q));
  }

  showFoodDetail(f: Food) {
    this.selectedFood = f;
    this.foodStep = 'detail';
    this.foodQty = 100;
    this.foodUnit = 'g';
    this.servingGram = 100; // adapte ici si tu as des portions propres à chaque aliment
    this.recomputeAdjusted();
  }

  backToList() {
    this.foodStep = 'list';
    this.selectedFood = null;
  }

  onUnitChange() {
    // Quand on passe de g -> serving, on garde visuellement la même masse
    // Ex: 100g -> 1 serving (si serving=100g), 150g -> 1.5 serving, etc.
    if (!this.selectedFood) return;
    if (this.foodUnit === 'serving') {
      this.foodQty = +(this.foodQty / this.servingGram).toFixed(2);
    } else {
      this.foodQty = +(this.foodQty * this.servingGram).toFixed(0);
    }
    this.recomputeAdjusted();
  }

  recomputeAdjusted() {
    if (!this.selectedFood) return;

    // Base: valeurs pour 100g
    const base = this.selectedFood;

    // Masse sélectionnée en grammes
    const grams = this.foodUnit === 'g'
      ? this.foodQty
      : this.foodQty * this.servingGram;

    const factor = grams / 100;

    this.adj = {
      calories: base.calories * factor,
      protein:  base.protein  * factor,
      carbs:    base.carbs    * factor,
      fat:      base.fat      * factor,
    };
  }

// Ajoute l’aliment au repas courant
  addFoodToMeal() {
    if (!this.mealForModal || !this.selectedFood) return;

    // Ajout des macros calculées au meal
    this.mealForModal.protein += this.adj.protein;
    this.mealForModal.carbs   += this.adj.carbs;
    this.mealForModal.fat     += this.adj.fat;

    // Recalcule calories du repas puis du day
    this.calculateMealCalories(this.mealForModal);

    // Ferme
    this.closeFoodModal();
  }

}
