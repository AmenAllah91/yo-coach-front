import { SimpleChange } from '@angular/core';
import { Subject, of, throwError } from 'rxjs';
import { AddMealModalComponent } from './add-meal-modal.component';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FeatherModule } from 'angular-feather';
import { allIcons } from 'angular-feather/icons';
import { TranslateModule } from '@ngx-translate/core';
import { MealsService } from 'app/service/meals.service';
import { NutritionService } from 'app/service/nutrition.service';

describe('Meals create and edit validation', () => {
  let component: AddMealModalComponent;
  let service: any;
  const food = { id: 'rice', name: 'Rice', servingSize: 100, imageUrl: 'rice.png' };

  beforeEach(() => {
    service = jasmine.createSpyObj('MealsService', ['createMeal', 'updateMeal', 'saveTemplate']);
    const nutrition = jasmine.createSpyObj('NutritionService', ['getFoodForClient']);
    nutrition.getFoodForClient.and.returnValue(of({}));
    component = new AddMealModalComponent(nutrition, service, { instant: (key: string) => key } as any);
    component.choose('recipe');
    component.name = ' Lunch ';
    component.addFood(food);
  });

  it('requires a trimmed title, meal type, ingredients and servings >= 1', () => {
    expect(component.canSave).toBeTrue();
    component.name = ' '; expect(component.canSave).toBeFalse();
    component.name = 'x'.repeat(101); expect(component.canSave).toBeFalse();
    component.name = 'x'.repeat(100); expect(component.canSave).toBeTrue();
    component.mealType = ''; expect(component.canSave).toBeFalse();
    component.mealType = 'LUNCH'; component.servings = 0.5; expect(component.canSave).toBeFalse();
    component.servings = 1.5; expect(component.canSave).toBeTrue();
    component.ingredients = []; expect(component.canSave).toBeFalse();
  });

  it('requires positive finite quantities and an explicit unit in both formats', () => {
    for (const step of ['foods', 'recipe'] as const) {
      component.choose(step);
      for (const value of [null, 0, -1, NaN, Infinity]) {
        component.ingredients[0].quantity = value;
        expect(component.canSave).toBeFalse();
      }
      component.ingredients[0].quantity = 0.001;
      component.ingredients[0].unit = ' '; expect(component.canSave).toBeFalse();
      component.ingredients[0].unit = 'g'; expect(component.canSave).toBeTrue();
    }
  });

  it('prevents adding duplicate database foods and rejects renamed manual duplicates', () => {
    component.addFood({ ...food }); expect(component.ingredients.length).toBe(1);
    component.addManualIngredient();
    Object.assign(component.ingredients[1], { name: ' RICE ', quantity: 1, unit: 'g' });
    expect(component.canSave).toBeFalse(); expect(component.canSaveDraft).toBeFalse();
  });

  it('allows incomplete drafts but rejects entered invalid values', () => {
    component.name = ''; component.mealType = ''; component.servings = null; component.ingredients = [];
    expect(component.canSave).toBeFalse(); expect(component.canSaveDraft).toBeTrue();
    component.addManualIngredient(); expect(component.canSaveDraft).toBeTrue();
    component.ingredients[0].quantity = -1; expect(component.canSaveDraft).toBeFalse();
    component.ingredients[0].quantity = null; component.ingredients[0].protein = -0.2;
    expect(component.canSaveDraft).toBeFalse();
    component.ingredients[0].protein = 0.2; expect(component.canSaveDraft).toBeTrue();
    component.choose('foods'); expect(component.canSaveDraft).toBeFalse();
  });

  it('trims the title and removes empty direction steps before saving', () => {
    service.saveTemplate.and.returnValue(of({}));
    component.directions = [' Mix ', '', '  ']; component.servings = 1.5;
    component.save();
    const payload = service.saveTemplate.calls.mostRecent().args[0];
    expect(payload.name).toBe('Lunch'); expect(payload.directions).toEqual(['Mix']); expect(payload.servings).toBe(1.5);
  });

  it('saves an incomplete draft without substituting missing values', () => {
    service.saveTemplate.and.returnValue(of({}));
    component.name = ''; component.ingredients = []; component.servings = null;
    component.save(true);
    expect(service.saveTemplate.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ name: '', draft: true, servings: null, foods: [] }));
  });

  it('blocks duplicate saves and allows retry after failure', () => {
    const request = new Subject<any>(); service.saveTemplate.and.returnValue(request);
    component.save(); component.save(); component.save(true);
    expect(service.saveTemplate).toHaveBeenCalledTimes(1);
    expect(component.canSave).toBeFalse(); expect(component.canSaveDraft).toBeFalse();
    request.error(new Error('Failed')); expect(component.canSave).toBeTrue();
  });

  it('validates edit snapshots without replacing missing quantities or units', () => {
    component.isVisible = true;
    component.meal = { id: 'meal', name: 'Lunch', template: true, mealType: '', servings: 0.5,
      foods: [{ foodRef: food, name: 'Rice', quantity: null, unit: '' }] };
    component.ngOnChanges({ meal: new SimpleChange(null, component.meal, false) });
    expect(component.canSave).toBeFalse(); expect(component.ingredients[0].quantity).toBeNull();
    expect(component.ingredients[0].unit).toBe('');
    component.mealType = 'LUNCH'; component.servings = 1; component.ingredients[0].quantity = 1; component.ingredients[0].unit = 'g';
    service.updateMeal.and.returnValue(of({})); component.save(); expect(service.updateMeal).toHaveBeenCalled();
  });

  it('rejects non JPG/PNG images and images over 5 MB', () => {
    for (const file of [{ type: 'image/gif', size: 1 }, { type: 'image/png', size: 5 * 1024 * 1024 + 1 }]) {
      component.onCoverImageSelected({ target: { files: [file], value: 'image' } } as any);
      expect(component.imageError).toBeTruthy(); expect(component.canSave).toBeFalse(); expect(component.canSaveDraft).toBeFalse();
      component.removeCoverImage(); expect(component.canSave).toBeTrue();
    }
  });

  it('checks image content and keeps save disabled during the file read', () => {
    let reader: any;
    spyOn(window, 'FileReader').and.callFake(function () {
      reader = { result: '', readAsDataURL: () => {} };
      return reader;
    });
    const select = () => component.onCoverImageSelected({ target: { files: [{ type: 'image/png', size: 8, name: 'cover.png' }], value: '' } } as any);
    select(); expect(component.canSave).toBeFalse(); expect(component.canSaveDraft).toBeFalse();
    reader.result = 'data:image/png;base64,YWJj'; reader.onload();
    expect(component.imageError).toBeTruthy(); expect(component.canSave).toBeFalse();
    select(); reader.result = 'data:image/png;base64,iVBORw0KGgo='; reader.onload();
    expect(component.canSave).toBeTrue(); expect(component.coverImageName).toBe('cover.png');
    select(); component.removeCoverImage(); reader.onload(); expect(component.coverImage).toBeNull();
  });
});

describe('Meal ingredient servings', () => {
  let component: AddMealModalComponent;
  let meals: any;
  let nutrition: any;
  const initial = { id: 'initial', size: 100, unit: 'Grams', energy: 143, protein: 12.6, carbohydrates: 0.7, fat: 9.5 };
  const egg = { id: 'egg', size: 1, unit: 'œuf', energy: 72, protein: 6.3, carbohydrates: 0.4, fat: 4.8 };
  const eggs = () => ({ id: 'eggs', name: 'Œufs', imageUrl: 'eggs.png', defaultServingId: 'initial', servings: [initial, egg] });
  const select = (value: string) => ({ value } as HTMLSelectElement);

  beforeEach(() => {
    meals = jasmine.createSpyObj('MealsService', ['createMeal', 'updateMeal', 'saveTemplate']);
    nutrition = jasmine.createSpyObj('NutritionService', ['getFoodForClient', 'addFoodServing']);
    nutrition.getFoodForClient.and.returnValue(of({}));
    component = new AddMealModalComponent(nutrition, meals, { instant: (key: string) => (key === 'FOOD_UNIT_PIECE' ? 'pièce' : key) } as any);
    component.choose('foods');
    component.name = 'Petit-déjeuner';
    component.addFood(eggs());
  });

  it('starts on the main serving and switches to another one with its own values', () => {
    const row = component.ingredients[0];
    expect(row.servingId).toBe('initial');
    expect(row.quantity).toBe(100);
    expect(row.unit).toBe('g');
    component.onServingChange(row, select('egg'));
    expect(row.servingId).toBe('egg');
    expect(row.quantity).toBe(1);
    expect(row.unit).toBe('œuf');
    row.quantity = 2;
    expect(component.ingredientTotal(row, 'calories')).toBe(144);
  });

  it('opens the new serving form without changing the current selection', () => {
    const row = component.ingredients[0];
    const element = select(component.newServingOption);
    component.onServingChange(row, element);
    expect(component.servingFormRowId).toBe(row.id);
    expect(element.value).toBe('initial');
    expect(row.servingId).toBe('initial');
  });

  it('creates a serving on the food and selects it right away', () => {
    const box = { id: 'box', size: 6, unit: 'œufs', energy: 430, protein: 37.8, carbohydrates: 2.4, fat: 28.5 };
    nutrition.addFoodServing.and.returnValue(of({ ...eggs(), servings: [initial, egg, box] }));
    const row = component.ingredients[0];
    component.openServingForm(row);
    component.createServing(row, { size: 6, unit: ' œufs ', energy: 430, protein: 37.8, carbohydrates: 2.4, fat: 28.5 });
    expect(nutrition.addFoodServing).toHaveBeenCalledWith('eggs', jasmine.objectContaining({ size: 6 }));
    expect(row.servingId).toBe('box');
    expect(row.quantity).toBe(6);
    expect(component.servingOptions(row).map((s) => s.id)).toEqual(['initial', 'egg', 'box']);
    expect(component.servingFormRowId).toBeNull();
  });

  it('explains why a serving could not be added', () => {
    nutrition.addFoodServing.and.returnValue(throwError(() => ({ status: 403 })));
    const row = component.ingredients[0];
    component.openServingForm(row);
    component.createServing(row, { size: 6, unit: 'œufs', energy: 1, protein: 1, carbohydrates: 1, fat: 1 });
    expect(component.servingError).toBe('MEAL_SERVING_NOT_OWNED');
    expect(component.servingFormRowId).toBe(row.id);
  });

  it('keeps the copy of a serving that no longer exists on the food', () => {
    component.isVisible = true;
    component.meal = { id: 'meal', name: 'Snack', mealType: 'SNACK', foods: [{
      id: 'line', name: 'Œufs', quantity: 2, unit: 'pot', foodRef: eggs(), servingId: 'gone',
      serving: { id: 'gone', size: 1, unit: 'pot', energy: 90, protein: 10, carbohydrates: 5, fat: 3 },
    }] };
    component.ngOnChanges({ meal: new SimpleChange(null, component.meal, false) });
    const row = component.ingredients[0];
    expect(component.servingOptions(row).map((s) => s.id)).toEqual(['gone', 'initial', 'egg']);
    expect(component.ingredientTotal(row, 'calories')).toBe(180);
  });

  it('refreshes the servings of loaded foods and sends the chosen serving id', () => {
    const pot = { id: 'pot', size: 1, unit: 'pot', energy: 90, protein: 10, carbohydrates: 5, fat: 3 };
    nutrition.getFoodForClient.and.returnValue(of({ ...eggs(), servings: [initial, egg, pot] }));
    component.isVisible = true;
    component.meal = { id: 'meal', name: 'Snack', mealType: 'SNACK', foods: [{ id: 'line', name: 'Œufs', quantity: 2, unit: 'œuf', foodRef: eggs(), servingId: 'egg' }] };
    component.ngOnChanges({ meal: new SimpleChange(null, component.meal, false) });
    expect(nutrition.getFoodForClient).toHaveBeenCalledWith('eggs');
    expect(component.servingOptions(component.ingredients[0]).map((s) => s.id)).toEqual(['initial', 'egg', 'pot']);
    meals.updateMeal.and.returnValue(of({}));
    component.save();
    expect(meals.updateMeal.calls.mostRecent().args[1].foods[0]).toEqual(jasmine.objectContaining({ servingId: 'egg', quantity: 2, unit: 'œuf' }));
  });
});

describe('Meals validation messages after interaction', () => {
  let fixture: ComponentFixture<AddMealModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddMealModalComponent, TranslateModule.forRoot(), FeatherModule.pick(allIcons)],
      providers: [
        { provide: MealsService, useValue: {} },
        { provide: NutritionService, useValue: {} },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AddMealModalComponent);
    fixture.componentInstance.isVisible = true;
    fixture.detectChanges();
  });

  it('opens foods without errors and shows a required title after blur', async () => {
    fixture.componentInstance.choose('foods'); fixture.detectChanges(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.ingredient-validation')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('TITLE_REQUIRED');
    expect(fixture.nativeElement.querySelector('.button--primary').disabled).toBeTrue();
    fixture.nativeElement.querySelector('.foods-field--title input').dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('TITLE_REQUIRED');
  });

  it('keeps new ingredient fields quiet until each field is edited', async () => {
    fixture.componentInstance.choose('recipe'); fixture.componentInstance.addManualIngredient();
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.inline-error')).toBeNull();
    const quantity = fixture.nativeElement.querySelector('.compact-field input');
    quantity.value = '-1'; quantity.dispatchEvent(new Event('input'));
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('MEAL_QUANTITY_POSITIVE');
    expect(fixture.nativeElement.textContent).not.toContain('MEAL_UNIT_REQUIRED');
  });
});
