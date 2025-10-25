import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest} from '@angular/common/http';
import {ToastrService} from 'ngx-toastr';
import {LoaderService} from '../service/loader.service';
import {Observable} from 'rxjs';

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
    private toastr: ToastrService,
    private loaderService: LoaderService
  ) {
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        throw new Error('Method not implemented.');
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
        this.toastr.success(messages.success, 'Success', {
          timeOut: 3000,
          closeButton: true,
          progressBar: true
        });
      } else {
        this.toastr.error(messages.error, 'Error', {
          timeOut: 5000,
          closeButton: true,
          progressBar: true,
          toastClass: 'toast toast-error'
        });
      }
    }
  }
}
