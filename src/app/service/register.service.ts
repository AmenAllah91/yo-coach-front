import { Injectable } from '@angular/core';
import {HttpClient, HttpErrorResponse} from "@angular/common/http";
import {Observable, throwError} from "rxjs";
import {catchError} from "rxjs/operators";
import {environment} from "@env/environment";
import {RegistrationUser} from '../models/subscription-onboarding.model';

@Injectable({
  providedIn: 'root'
})
export class RegisterService {
  private baseUrl = environment.baseApiUrl + '/public/register';
  constructor(private http: HttpClient) { }

  registerUser(user: RegistrationUser): Observable<void> {
    return this.http.post<void>(this.baseUrl, user).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = '';

    if (error.status === 409) {
      errorMessage = this.getApiMessage(error, 'A user with this username or email already exists.');
    } else if (error.error instanceof ErrorEvent) {
      errorMessage = `Erreur: ${error.error.message}`;
    } else {
      errorMessage = this.getApiMessage(error, `Erreur serveur: ${error.status}\nMessage: ${error.message}`);
    }

    return throwError(() => new Error(errorMessage));
  }

  private getApiMessage(error: HttpErrorResponse, fallback: string): string {
    if (typeof error.error === 'string' && error.error.trim()) {
      return error.error;
    }
    if (error.error?.error && typeof error.error.error === 'string') {
      return error.error.error;
    }
    return fallback;
  }
}
