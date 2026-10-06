import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, UrlTree } from '@angular/router';
import { AuthService } from '@config/auth.service';
import { adminGuard } from './admin.guard';

describe('Admin dashboard access', () => {
  it('allows admins and redirects coaches away from the dashboard', async () => {
    let roles = ['ROLE_ADMIN'];
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthService, useValue: { extractRoles: async () => roles } }] });
    const route: any = {};
    const state: any = {};
    expect(await TestBed.runInInjectionContext(() => adminGuard(route, state))).toBeTrue();
    roles = ['ROLE_COACH'];
    const result = await TestBed.runInInjectionContext(() => adminGuard(route, state));
    expect(result instanceof UrlTree).toBeTrue();
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/coach-dashboard');
  });
});
