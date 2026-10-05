import { of } from 'rxjs';
import { ClientService } from './client.service';

describe('ClientService assignment clients', () => {
  it('requests active clients and excludes archived and legacy paused profiles', () => {
    const http = jasmine.createSpyObj('HttpClient', ['get']);
    http.get.and.returnValue(of([
      { id: 'active', clientStatus: 'ACTIVE' },
      { id: 'archived', clientStatus: 'ARCHIVED' },
      { id: 'paused', clientStatus: 'PAUSED' },
      { id: 'legacy' },
    ]));
    const service = new ClientService(http);

    service.getActiveClientsForAssignment('coach').subscribe(clients => {
      expect(clients.map(client => client.id)).toEqual(['active', 'legacy']);
    });
    const [url, options] = http.get.calls.mostRecent().args;
    expect(url).toContain('/clients/coach/coach/all');
    expect(options.params.get('status')).toBe('ACTIVE');
  });

  it('keeps archived profiles available for history browsing', () => {
    const http = jasmine.createSpyObj('HttpClient', ['get']);
    const clients = [{ id: 'archived', clientStatus: 'ARCHIVED' }];
    http.get.and.returnValue(of(clients));

    new ClientService(http).getListClientsByCoachWithoutPagination('coach')
      .subscribe(result => expect(result).toEqual(clients));
    expect(http.get.calls.mostRecent().args[1].params).toBeUndefined();
  });
});
