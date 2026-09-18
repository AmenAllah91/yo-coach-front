import { SimpleChange } from '@angular/core';
import { Subject, of } from 'rxjs';
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
    component = new AddMealModalComponent({} as any, service, { instant: (key: string) => key } as any);
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
