import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { AVATAR_REUSE_MS, UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(UsersService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getAvatarUrl (shared photos of the client list and profile)', () => {
    it('asks the server once per user and without the page loader', () => {
      const urls: string[] = [];
      service.getAvatarUrl('c1').subscribe((url) => urls.push(url));
      service.getAvatarUrl('c1').subscribe((url) => urls.push(url));

      const request = http.expectOne((r) => r.url.endsWith('/api/users/c1'));
      expect(request.request.headers.get('X-Skip-Loader')).toBe('true');
      request.flush({ id: 'c1', avatarUrl: 'https://files/c1?sig=1' });

      service.getAvatarUrl('c1').subscribe((url) => urls.push(url));
      expect(urls).toEqual(['https://files/c1?sig=1', 'https://files/c1?sig=1', 'https://files/c1?sig=1']);
    });

    it('asks again once the link is an hour old', () => {
      const start = Date.now();
      const now = spyOn(Date, 'now').and.returnValue(start);
      service.getAvatarUrl('c1').subscribe();
      http.expectOne((r) => r.url.endsWith('/api/users/c1')).flush({ avatarUrl: 'https://files/c1?sig=1' });

      now.and.returnValue(start + AVATAR_REUSE_MS + 1);
      let url = '';
      service.getAvatarUrl('c1').subscribe((value) => (url = value));
      http.expectOne((r) => r.url.endsWith('/api/users/c1')).flush({ avatarUrl: 'https://files/c1?sig=2' });
      expect(url).toBe('https://files/c1?sig=2');
    });

    it('gives an empty link for "not found" and does not remember a failure', () => {
      let url = 'unset';
      service.getAvatarUrl('c2').subscribe((value) => (url = value));
      http.expectOne((r) => r.url.endsWith('/api/users/c2')).flush({ avatarUrl: 'not found' });
      expect(url).toBe('');

      service.getAvatarUrl('c3').subscribe((value) => (url = value));
      http.expectOne((r) => r.url.endsWith('/api/users/c3')).flush('down', { status: 503, statusText: 'Unavailable' });
      expect(url).toBe('');
      service.getAvatarUrl('c3').subscribe((value) => (url = value));
      http.expectOne((r) => r.url.endsWith('/api/users/c3')).flush({ avatarUrl: 'https://files/c3?sig=1' });
      expect(url).toBe('https://files/c3?sig=1');
    });
  });
});
