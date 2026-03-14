import { Injectable } from '@angular/core';
import {HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpResponse} from '@angular/common/http';
import {LoaderService} from '../service/loader.service';
import {ToastService} from '../service/toast.service';
import {Observable, from, switchMap, tap, catchError, finalize} from 'rxjs';
import { AuthService } from './auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private messageMapping = {
    GET: {
      success: 'Data retrieved successfully!',
      error: 'Failed to retrieve data.'
    },
    POST: {
      success: 'Data submitted successfully!',
      error: 'Failed to submit data.'
    },
    PUT: {
      success: 'Data updated successfully!',
      error: 'Failed to update data.'
    },
    DELETE: {
      success: 'Data deleted successfully!',
      error: 'Failed to delete data.'
    }
  };

  constructor(
    private loaderService: LoaderService,
    private toastService: ToastService,
    private authService: AuthService
  ) {
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    this.loaderService.show();

    if (this.authService.isLoggedIn()) {
      return from(this.authService.getToken()).pipe(
        switchMap(token => {
          if (token) {
            const authReq = req.clone({
              setHeaders: {
                Authorization: `Bearer ${token}`
              }
            });
            return next.handle(authReq);
          }
          return next.handle(req);
        }),
        tap((event) => {
          if (event instanceof HttpResponse) {
            const method = req.method;

            if (!this.isToastExcluded(req.url) && ['POST', 'PUT', 'DELETE'].includes(method)) {
              this.showToast(method, 'success');
            }
          }
        }),
        catchError(error => {

          if (!this.isToastExcluded(req.url)) {
            this.showToast(req.method, 'error');
          }

          throw error;
        }),
        finalize(() => {
          this.loaderService.hide();
        })
      );
    }

    return next.handle(req).pipe(
      tap(() => {
        const method = req.method;

        if (!this.isToastExcluded(req.url) && ['POST', 'PUT', 'DELETE'].includes(method)) {
          this.showToast(method, 'success');
        }
      }),
      catchError(error => {

        if (!this.isToastExcluded(req.url)) {
          this.showToast(req.method, 'error');
        }

        throw error;
      }),
      finalize(() => {
        this.loaderService.hide();
      })
    );
  }


  private setAuthHeader(request: HttpRequest<any>, token: string): HttpRequest<any> {
    return request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  private showToast(method: string, type: 'success' | 'error'): void {
    const messages = this.messageMapping[method];
    if (messages) {
      if (type === 'success') {
        this.toastService.success(messages.success);
      } else {
        this.toastService.error(messages.error);
      }
    }
  }

  private isToastExcluded(url: string): boolean {
    return url.includes('/chat') ||
      url.includes('/api/notifications') ||
      url.includes('/ws') ||
      url.includes('/sync') ||
      url.includes('/token');
  }
}
