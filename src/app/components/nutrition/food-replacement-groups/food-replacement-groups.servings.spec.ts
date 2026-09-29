import { of } from 'rxjs';
import { FoodReplacementGroupsComponent } from './food-replacement-groups.component';
import { ModalReplaceFoodComponent } from '../../clients/modal-replace-food/modal-replace-food.component';

describe('Replacement groups with servings', () => {
  const translate: any = { instant: (key: string) => (key === 'FOOD_UNIT_PIECE' ? 'pièce' : key) };
  const initial = { id: 'initial', size: 100, unit: 'Grams', energy: 143, protein: 12.6, carbohydrates: 0.7, fat: 9.5 };
  const egg = { id: 'egg', size: 1, unit: 'œuf', energy: 72, protein: 6.3, carbohydrates: 0.4, fat: 4.8 };
  const eggs = () => ({ id: 'eggs', name: 'Œufs', defaultServingId: 'initial', servings: [initial, egg] });
  const rice = () => ({ id: 'rice', name: 'Riz', energy: 130, protein: 2.7, carbohydrates: 28, fat: 0.3, servingSize: 100, servingDescription: 'Grams' });
  let groups: any;
  let nutrition: any;
  let component: FoodReplacementGroupsComponent;

  beforeEach(() => {
    groups = jasmine.createSpyObj('FoodReplacementGroupsService', ['getGroups', 'createGroup', 'updateGroup']);
    groups.getGroups.and.returnValue(of({ content: [], totalElements: 0, totalPages: 0, number: 0 }));
    groups.createGroup.and.returnValue(of({}));
    nutrition = jasmine.createSpyObj('NutritionService', ['getFoods', 'getFoodForClient']);
    nutrition.getFoods.and.returnValue(of({ content: [] }));
    nutrition.getFoodForClient.and.returnValue(of(eggs()));
    component = new FoodReplacementGroupsComponent(groups, nutrition, { nativeElement: document.createElement('div') } as any, translate);
  });

  function add(food: any, servingId?: string, quantity?: number) {
    component.openAddFoodModal();
    component.selectFood(food);
    if (servingId) component.selectServing(servingId);
    if (quantity !== undefined) component.selectedQuantity = quantity;
    component.addSelectedFood();
  }

  it('starts on the main serving and previews the chosen quantity', () => {
    component.openAddFoodModal();
    component.selectFood(eggs());
    expect(component.selectedServingId).toBe('initial');
    expect(component.selectedQuantity).toBe(1);
    expect(component.selectedAmount).toBe(100);
    expect(component.selectedUnit).toBe('g');
    component.selectServing('egg');
    component.selectedQuantity = 2;
    expect(component.selectedUnit).toBe('œuf');
    expect(component.selectedPreview?.calories).toBe(144);
  });

  it('stores the serving on the item and shows calories for its quantity', () => {
    add(eggs(), 'egg', 4);
    const item = component.groupFoods[0];
    expect(item).toEqual(jasmine.objectContaining({ foodRefId: 'eggs', servingId: 'egg', quantity: 4, unit: 'œuf', energy: 72, servingSize: 1, servingDescription: 'œuf' }));
    expect(component.itemMacros(item).calories).toBe(288);
  });

  it('sends each item serving when saving the group', () => {
    add(eggs(), 'egg', 4);
    add(rice(), undefined, 1.5);
    component.groupName = 'Protéines';
    component.saveGroup();
    const payload = groups.createGroup.calls.mostRecent().args[0];
    expect(payload.foods).toEqual([
      jasmine.objectContaining({ foodRefId: 'eggs', servingId: 'egg', quantity: 4, unit: 'œuf' }),
      jasmine.objectContaining({ foodRefId: 'rice', servingId: 'initial', quantity: 150, unit: 'g' }),
    ]);
  });

  it('reloads the food servings when editing an item and keeps a serving deleted since', () => {
    component.editGroupFood({ foodRefId: 'eggs', servingId: 'gone', quantity: 1, unit: 'pot', name: 'Œufs', energy: 90, protein: 10, carbohydrates: 5, fat: 3, servingSize: 1, servingDescription: 'pot' });
    expect(nutrition.getFoodForClient).toHaveBeenCalledWith('eggs');
    expect(component.servingOptions.map((s) => s.id)).toEqual(['gone', 'initial', 'egg']);
    expect(component.selectedServingId).toBe('gone');
    expect(component.selectedPreview?.calories).toBe(90);
  });

  it('shows client alternatives for their quantity and sends the serving on replace', () => {
    const modal = new ModalReplaceFoodComponent({} as any, translate);
    const chicken: any = { foodRefId: 'chicken', servingId: 'initial', quantity: 200, unit: 'g', energy: 165, protein: 31, carbohydrates: 0, fat: 3.6, servingSize: 100 };
    expect(modal.optionMacros(chicken).calories).toBe(330);
    const emitted: any[] = [];
    modal.replace.subscribe((event) => emitted.push(event));
    modal.selectReplacement(chicken, { name: 'P', foods: [chicken] } as any);
    modal.confirmReplace();
    expect(emitted).toEqual([{ replacementFoodRefId: 'chicken', quantity: 200, unit: 'g', servingId: 'initial' }]);
  });
});
