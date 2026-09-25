import { HttpErrorResponse } from '@angular/common/http';
import { throwError } from 'rxjs';

import { RegisterService } from './register.service';

describe('RegisterService', () => {
  it('preserves the API conflict message instead of crashing the error handler', (done) => {
    const http = jasmine.createSpyObj('HttpClient', ['post']);
    http.post.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 409,
      error: { error: 'An account already exists with this email.' }
    })));
    const service = new RegisterService(http);

    service.registerUser({} as any).subscribe({
      next: () => done.fail('Expected the registration to fail'),
      error: (error: Error & { status?: number }) => {
        expect(error.message).toBe('An account already exists with this email.');
        expect(error.status).toBe(409);
        done();
      }
    });
  });
});
