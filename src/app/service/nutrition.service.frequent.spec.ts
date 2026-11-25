/* eslint-disable @typescript-eslint/no-explicit-any */
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { NutritionService } from './nutrition.service';

describe('NutritionService « Fréquents »', () => {
  let service: NutritionService;
  let http: HttpTestingController;
  const url = `${environment.baseApiUrl}/api/food-ref/frequent`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(NutritionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('asks the 12 most used foods once, quietly, then keeps them', () => {
    let first: any[] = [];
    service.loadFrequentFoods().subscribe((foods) => (first = foods));
    service.loadFrequentFoods().subscribe(); // same opening: the same request
    const request = http.expectOne((req) => req.url === url);
    expect(request.request.params.get('limit')).toBe('12');
    expect(request.request.headers.has('X-Skip-Toast')).toBeTrue();
    request.flush([{ id: 'a', name: 'Riz', general: false, protein: 3, carbohydrates: 28, fat: 0.3 }]);
    expect(first.map((food) => food.id)).toEqual(['a']);
    expect(first[0].carbohydrates).toBe(28);

    let again: any[] = [];
    service.loadFrequentFoods().subscribe((foods) => (again = foods));
    http.expectNone(url);
    expect(again.map((food) => food.id)).toEqual(['a']);
  });

  it('gives an empty list on an error, and asks again at the next opening', () => {
    let foods: any[] | null = null;
    service.loadFrequentFoods().subscribe((result) => (foods = result));
    http.expectOne((req) => req.url === url).flush('nope', { status: 404, statusText: 'Not Found' });
    expect(foods as any).toEqual([]);

    service.loadFrequentFoods().subscribe();
    http.expectOne((req) => req.url === url).flush([]);
  });

  it('forgets them when a food is created', () => {
    service.loadFrequentFoods().subscribe();
    http.expectOne((req) => req.url === url).flush([{ id: 'a', name: 'Riz' }]);

    service.createFood({ name: 'Riz maison', calories: 120, protein: 3, carbs: 25, fat: 1, servingSize: 100, servingUnit: 'g' }, true).subscribe();
    const create = http.expectOne(`${environment.baseApiUrl}/api/food-ref`);
    expect(create.request.method).toBe('POST');
    expect(create.request.body.energy).toBe(120);
    expect(create.request.body.carbohydrates).toBe(25);
    expect(create.request.headers.has('X-Skip-Toast')).toBeTrue();
    create.flush({ id: 'new', name: 'Riz maison', energy: 120 });

    service.loadFrequentFoods().subscribe();
    http.expectOne((req) => req.url === url).flush([]);
  });
});
