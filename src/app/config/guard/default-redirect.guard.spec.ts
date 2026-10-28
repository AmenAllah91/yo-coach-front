import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, UrlTree } from '@angular/router';
import { AuthService } from '@config/auth.service';
import { homeRedirectGuard } from './default-redirect.guard';

describe('Home redirect', () => {
  it('sends each role from "/" to its home page', async () => {
    let roles: string[] = [];
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthService, useValue: { extractRoles: async () => roles } }] });
    const target = async (userRoles: string[]) => {
      roles = userRoles;
      const result = await TestBed.runInInjectionContext(() => homeRedirectGuard({} as any, {} as any));
      return TestBed.inject(Router).serializeUrl(result as UrlTree);
    };
    expect(await target(['ROLE_COACH'])).toBe('/coach-dashboard');
    expect(await target(['ROLE_CLIENT'])).toBe('/client-dashboard');
    expect(await target(['ROLE_ADMIN'])).toBe('/admin/dashboard');
    expect(await target(['ROLE_SUPPORT'])).toBe('/admin/coaches');
    expect(await target([])).toBe('/landing-page');
  });
});
