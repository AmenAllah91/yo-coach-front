import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest
} from '@angular/common/http';
import { LoaderService } from '../service/loader.service';
import { ToastService } from '../service/toast.service';
import { Observable, from, switchMap, catchError, finalize, throwError } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  private errorMessageMapping = {
    GET: 'Failed to retrieve data.',
    POST: 'Failed to submit data.',
    PUT: 'Failed to update data.',
    DELETE: 'Failed to delete data.'
  };

  constructor(
    private loaderService: LoaderService,
    private toastService: ToastService,
    private authService: AuthService
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const skipToast = req.headers.has('X-Skip-Toast');
    const skipLoader = req.headers.has('X-Skip-Loader');

    let cleanReq = req;

    if (skipToast || skipLoader) {
      cleanReq = req.clone({
        headers: req.headers
          .delete('X-Skip-Toast')
          .delete('X-Skip-Loader')
      });
    }

    if (!skipLoader) {
      this.loaderService.show();
    }

    const handle = (request: HttpRequest<any>) => {
      return next.handle(request).pipe(
        catchError(error => {
          if (!this.isToastExcluded(request.url) && !skipToast) {
            this.showErrorToast(request.method);
          }

          return throwError(() => error);
        }),

        finalize(() => {
          if (!skipLoader) {
            this.loaderService.hide();
          }
        })
      );
    };

    if (this.authService.isLoggedIn()) {
      return from(this.authService.getToken()).pipe(
        switchMap(token => {
          const authReq = token
            ? cleanReq.clone({
              setHeaders: {
                Authorization: `Bearer ${token}`
              }
            })
            : cleanReq;

          return handle(authReq);
        })
      );
    }

    return handle(cleanReq);
  }

  private showErrorToast(method: string): void {
    const message =
      this.errorMessageMapping[
        method as keyof typeof this.errorMessageMapping
        ];

    if (!message) {
      return;
    }

    this.toastService.error(message);
  }

  private isToastExcluded(url: string): boolean {
    return (
      url.includes('/chat') ||
      url.includes('/api/notifications') ||
      url.includes('/ws') ||
      url.includes('/sync') ||
      url.includes('/token') ||
      url.includes('UNSAVED')
    );
  }
}
