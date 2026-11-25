import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MacroChartComponent } from './macro-chart.component';

describe('MacroChartComponent', () => {
  let fixture: ComponentFixture<MacroChartComponent>;
  let chart: MacroChartComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MacroChartComponent, TranslateModule.forRoot()] });
    fixture = TestBed.createComponent(MacroChartComponent);
    chart = fixture.componentInstance;
  });

  it('shows an empty grey ring when every macro is 0', () => {
    fixture.detectChanges();
    expect(chart.isEmpty).toBeTrue();
    expect(chart.segments.length).toBe(0);
    expect(chart.kcal).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('.mc__seg').length).toBe(0);
  });

  it('cuts the donut by the share of calories (4/4/9)', fakeAsync(() => {
    chart.protein = 100; // 400 kcal
    chart.carbs = 100; // 400 kcal
    chart.fat = 22.2222; // 200 kcal
    fixture.detectChanges();
    tick(50);
    fixture.detectChanges();
    expect(chart.share('protein')).toBe(40);
    expect(chart.share('carbs')).toBe(40);
    expect(chart.share('fat')).toBe(20);
    // Calories left empty: computed from the macros.
    expect(chart.kcal).toBe(1000);
    expect(fixture.nativeElement.querySelectorAll('.mc__seg').length).toBe(3);
  }));

  it('keeps the typed calories in the middle', () => {
    chart.calories = 850;
    chart.protein = 50;
    expect(chart.kcal).toBe(850);
  });

  it('shows what is over the goal in progress mode', fakeAsync(() => {
    chart.mode = 'progress';
    chart.calories = 2300;
    chart.goalCalories = 2000;
    chart.protein = 180;
    chart.goalProtein = 150;
    chart.carbs = 100;
    chart.goalCarbs = 200;
    fixture.detectChanges();
    tick(50);
    expect(chart.kcalLeft).toBe(-300);
    expect(chart.kcalOver).toBe(300);
    const rows = chart.rows;
    expect(rows[0].ratio).toBe(1);
    expect(rows[0].over).toBe(30);
    expect(rows[1].ratio).toBe(0.5);
    expect(rows[2].ratio).toBe(0); // no fat goal: no ring filled
  }));

  it('writes numbers the French way in French', () => {
    TestBed.inject(TranslateService).use('fr');
    expect(chart.fmt(2510).replace(/\s/g, ' ')).toBe('2 510');
    expect(chart.fmt(22.5, 1)).toBe('22,5');
    TestBed.inject(TranslateService).use('en');
    expect(chart.fmt(2510)).toBe('2,510');
  });
});
