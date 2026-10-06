import { of, Subject, throwError } from 'rxjs';
import { CustomFoodsComponent } from './custom-foods.component';
import { Food } from '../../../service/nutrition.service';
import { FoodServingFormComponent } from '../food-servings/food-serving-form.component';

describe('CustomFoodsComponent servings', () => {
  const translate: any = { instant: (key: string) => (key === 'FOOD_UNIT_PIECE' ? 'pièce' : key) };
  let service: jasmine.SpyObj<any>;
  let component: CustomFoodsComponent;

  const legacyEggs = (): Food => ({
    id: 'eggs', name: 'Œufs', calories: 143, protein: 12.6, carbs: 0.7, fat: 9.5, fiber: null,
    servingSize: 100, servingUnit: 'Grams',
  } as Food);

  const eggsWithServings = (): Food => ({
    ...legacyEggs(),
    defaultServingId: 'initial',
    servings: [
      { id: 'initial', size: 100, unit: 'Grams', energy: 143, protein: 12.6, carbohydrates: 0.7, fat: 9.5 },
      { id: 'egg', size: 1, unit: 'œuf', energy: 72, protein: 6.3, carbohydrates: 0.4, fat: 4.8 },
    ],
  } as Food);

  beforeEach(() => {
    service = jasmine.createSpyObj('NutritionService', ['updateFood', 'createFood', 'getFoods','deleteFood']);
    service.updateFood.and.callFake((_id: string, food: Food) => of({ ...food, id: 'eggs' }));
    service.createFood.and.callFake((food: Food) => of({ ...food, id: 'new' }));
    service.getFoods.and.returnValue(of({ content: [] }));
    const auth = jasmine.createSpyObj('AuthService', ['extractRoles']);
    auth.extractRoles.and.resolveTo(['ROLE_COACH']);
    component = new CustomFoodsComponent(service, translate, auth);
  });

  it('opens a historical food on its initial serving shown as grams', async () => {
    component.editFood(legacyEggs());
    expect(component.mainServingId).toBe('initial');
    expect(component.servingDescription).toBe('g');
    expect(component.calories).toBe('143');
    expect(component.extraServings).toEqual([]);
    await component.saveFood();
    const payload = service.updateFood.calls.mostRecent().args[1];
    expect(payload.defaultServingId).toBe('initial');
    expect(payload.servings).toEqual([jasmine.objectContaining({ id: 'initial', size: 100, unit: 'g', energy: 143, carbohydrates: 0.7 })]);
  });
  it('admin saves Egg with 100 g, 1 egg and 2 eggs then edits nutrition without losing serving ids',async()=>{
    component.isAdmin=true;component.openAddModal();Object.assign(component,{foodName:'Egg',servingSize:'100',servingDescription:'g',calories:'143',protein:'12.6',carbs:'0.7',fat:'9.5'});
    component.onServingSaved({id:'egg',size:1,unit:'egg',energy:72,protein:6.3,carbohydrates:0.4,fat:4.8});component.onServingSaved({id:'eggs',size:2,unit:'eggs',energy:144,protein:12.6,carbohydrates:0.8,fat:9.6});
    await component.saveFood();const payload=service.createFood.calls.mostRecent().args[0];expect(payload.servings.map((s:any)=>`${s.size} ${s.unit}`)).toEqual(['100 g','1 egg','2 eggs']);
    payload.servings[0].vitaminA=12;component.editFood({...payload,id:'new',isGeneral:true,vitaminA:12} as Food);component.protein='13';await component.saveFood();expect(service.updateFood.calls.mostRecent().args[1].servings[0].protein).toBe(13);
    expect(service.updateFood.calls.mostRecent().args[1].vitaminA).toBe(12);
    expect(service.updateFood.calls.mostRecent().args[1].servings[0].vitaminA).toBe(12);
    expect(service.updateFood.calls.mostRecent().args[1].servings.slice(1).map((s:any)=>s.id)).toEqual(['egg','eggs']);
  });
  it('admin archives only after confirmation, blocks double submit and keeps visible errors for retry',()=>{
    component.isAdmin=true;const food={...legacyEggs(),isGeneral:true};const pending=new Subject<void>();service.deleteFood.and.returnValue(pending);
    component.deleteFood(food);expect(service.deleteFood).not.toHaveBeenCalled();component.closeDeleteModal();expect(service.deleteFood).not.toHaveBeenCalled();
    component.deleteFood(food);component.confirmDelete();component.confirmDelete();expect(service.deleteFood).toHaveBeenCalledTimes(1);component.closeDeleteModal();expect(component.showDeleteModal).toBeTrue();
    pending.error({status:409});expect(component.deleteError).toBe('FOOD_DELETE_IN_USE');expect(component.deleting).toBeFalse();service.deleteFood.and.returnValue(of(undefined));component.confirmDelete();expect(component.showDeleteModal).toBeFalse();
  });
  it('cancels stale food searches and exposes load errors instead of an empty success state',()=>{
    const first=new Subject<any>();const second=new Subject<any>();service.getFoods.and.returnValues(first,second);component.loadFoods();component.searchTerm=' Milk ';component.onSearch();
    expect(first.observed).toBeFalse();second.next({content:[legacyEggs()],totalElements:1,totalPages:1});expect(component.foods.length).toBe(1);expect(service.getFoods.calls.mostRecent().args[2]).toBe('Milk');
    service.getFoods.and.returnValue(throwError(()=>({status:503})));component.loadFoods();expect(component.loadError).toBeTrue();expect(component.foods).toEqual([]);component.ngOnDestroy();
  });

  it('swaps the main serving and saves both with their ids', async () => {
    component.editFood(eggsWithServings());
    expect(component.extraServings.map((s) => s.id)).toEqual(['egg']);
    component.setMainServing(0);
    expect(component.mainServingId).toBe('egg');
    expect(component.servingSize).toBe('1');
    expect(component.calories).toBe('72');
    expect(component.extraServings[0]).toEqual(jasmine.objectContaining({ id: 'initial', unit: 'g', energy: 143 }));
    await component.saveFood();
    const payload = service.updateFood.calls.mostRecent().args[1];
    expect(payload.defaultServingId).toBe('egg');
    expect(payload.servings.map((s: any) => s.id)).toEqual(['egg', 'initial']);
  });

  it('adds a serving and refuses a duplicate main serving', () => {
    component.editFood(legacyEggs());
    component.openServingForm(null);
    expect(component.canSave).toBeTrue();
    component.onServingSaved({ size: 100, unit: 'G', energy: 1, protein: 1, carbohydrates: 1, fat: 1 });
    expect(component.servingFormOpen).toBeFalse();
    expect(component.errors['servingDescription']).toBe('FOOD_VALID_SERVING_DUPLICATE');
    expect(component.fieldError('servingDescription')).toBe('FOOD_VALID_SERVING_DUPLICATE');
    component.removeServing(0);
    expect(component.canSave).toBeTrue();
  });

  it('creates a new food whose first serving becomes the main one', async () => {
    component.openAddModal();
    Object.assign(component, { foodName: 'Barre', servingSize: '1', servingDescription: 'barre', calories: '210', protein: '20', carbs: '22', fat: '7' });
    component.onServingSaved({ size: 3, unit: 'barres', energy: 630, protein: 60, carbohydrates: 66, fat: 21 });
    await component.saveFood();
    const payload = service.createFood.calls.mostRecent().args[0];
    expect(payload.defaultServingId).toBeNull();
    expect(payload.servings.map((s: any) => `${s.size} ${s.unit}`)).toEqual(['1 barre', '3 barres']);
    expect(payload.servings[0].id).toBeUndefined();
  });

  function pendingForm(values: Partial<Record<string, string>>): FoodServingFormComponent {
    const form = new FoodServingFormComponent(translate);
    form.ngOnChanges();
    Object.assign(form.draft, values);
    component.openServingForm(null);
    component.servingForm = form;
    return form;
  }

  it('saves the main serving and the serving being typed in one click', async () => {
    component.openAddModal();
    Object.assign(component, { foodName: 'Œufs', servingSize: '100', servingDescription: 'g', calories: '143', protein: '12.6', carbs: '0.7', fat: '9.5' });
    pendingForm({ unit: 'œuf', energy: '72', protein: '6.3', carbohydrates: '0.4', fat: '4.8' });
    await component.saveFood();
    const payload = service.createFood.calls.mostRecent().args[0];
    expect(payload.servings.map((s: any) => `${s.size} ${s.unit}`)).toEqual(['100 g', '1 œuf']);
  });

  it('keeps the food unsaved while the serving being typed is incomplete', async () => {
    component.openAddModal();
    Object.assign(component, { foodName: 'Œufs', calories: '143', protein: '12.6', carbs: '0.7', fat: '9.5' });
    const form = pendingForm({ unit: 'œuf', energy: '72' });
    await component.saveFood();
    expect(service.createFood).not.toHaveBeenCalled();
    expect(form.error('protein')).toBe('FOOD_VALID_REQUIRED');
    expect(component.servingFormOpen).toBeTrue();
  });

  it('ignores a serving form left empty', async () => {
    component.openAddModal();
    Object.assign(component, { foodName: 'Œufs', calories: '143', protein: '12.6', carbs: '0.7', fat: '9.5' });
    pendingForm({});
    await component.saveFood();
    expect(service.createFood.calls.mostRecent().args[0].servings.length).toBe(1);
  });

  it('lets any admin manage the catalog and a coach only their own foods', () => {
    const catalog = { ...legacyEggs(), isGeneral: true } as Food;
    const own = { ...legacyEggs(), isGeneral: false } as Food;
    expect([catalog, own].map((food) => component.canManage(food))).toEqual([false, true]);
    component.deleteFood(catalog);
    expect(component.showDeleteModal).toBeFalse();
    component.isAdmin = true;
    expect(component.canManage(catalog)).toBeTrue();
    component.deleteFood(catalog);
    expect(component.showDeleteModal).toBeTrue();
  });

  it('imports only the valid foods of a file and shows the report', () => {
    service.importFoods = jasmine.createSpy('importFoods').and.returnValue(of({ created: 1, duplicates: 1, rejected: 0, entries: [
      { name: 'Œufs', status: 'CREATED', message: null }, { name: 'Riz', status: 'DUPLICATE', message: null },
    ] }));
    component.importPreview = {
      foods: [
        { name: 'Œufs', rows: [2, 3], valid: true, servings: [{ size: 100, unit: 'g', energy: 143, protein: 12.6, carbohydrates: 0.7, fat: 9.5 }] },
        { name: 'Riz', rows: [4], valid: true, servings: [{ size: 100, unit: 'g', energy: 130, protein: 2.7, carbohydrates: 28, fat: 0.3 }] },
        { name: 'Skyr', rows: [5], valid: false, servings: [] },
      ],
      errors: [], fileError: null, validFoods: 2, validServings: 2, invalidFoods: 1, errorRows: 1,
    };
    component.showImportModal = true;
    expect(component.canConfirmImport).toBeTrue();
    component.confirmImport();
    expect(service.importFoods).toHaveBeenCalledWith([
      jasmine.objectContaining({ name: 'Œufs' }), jasmine.objectContaining({ name: 'Riz' }),
    ]);
    expect(component.importReport?.created).toBe(1);
    expect(component.importEntries('DUPLICATE').map((entry) => entry.name)).toEqual(['Riz']);
    expect(service.getFoods).toHaveBeenCalled();
    component.closeImportModal();
    expect(component.showImportModal).toBeFalse();
    expect(component.importReport).toBeNull();
  });

  it('shows the main serving and the number of extra servings in the list', () => {
    expect(component.mainServingOf(eggsWithServings()).id).toBe('initial');
    expect(component.servingCount(eggsWithServings())).toBe(2);
    expect(component.servingCount(legacyEggs())).toBe(1);
  });
});
