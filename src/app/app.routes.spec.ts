import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

describe('Application route configuration', () => {
  it('initializes the router with all real routes, including the legacy foods redirect', async () => {
    // The legacy SockJS dependency requires a global alias in the browser test environment.
    (window as any).global = window;
    const { APP_ROUTE } = await import('./app.routes');
    TestBed.configureTestingModule({providers: [provideRouter(APP_ROUTE)]});
    expect(() => TestBed.inject(Router)).not.toThrow();
    const layout = TestBed.inject(Router).config.find(route => route.children?.some(child => child.path === 'admin/foods'));
    expect(layout?.children?.find(route => route.path === 'admin/foods')?.redirectTo).toBe('nutrition/custom-foods');
  });
});
