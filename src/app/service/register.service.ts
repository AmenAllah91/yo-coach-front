import { Injectable } from '@angular/core';
import {HttpClient, HttpErrorResponse} from "@angular/common/http";
import {Observable, throwError} from "rxjs";
import {catchError} from "rxjs/operators";
import {environment} from "@env/environment";
import {RegistrationUser} from '../models/subscription-onboarding.model';

export class RegistrationRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'RegistrationRequestError';
  }
}

@Injectable({
  providedIn: 'root'
})
export class RegisterService {
  private baseUrl = environment.baseApiUrl + '/public/register';
  constructor(private http: HttpClient) { }

  registerUser(user: RegistrationUser): Observable<void> {
    return this.http.post<void>(this.baseUrl, user).pipe(
      catchError((error: HttpErrorResponse) => this.handleError(error))
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

    return throwError(() => new RegistrationRequestError(errorMessage, error.status));
  }

  private getApiMessage(error: HttpErrorResponse, fallback: string): string {
    if (typeof error.error === 'string' && error.error.trim()) {
      return error.error;
    }
    if (error.error?.error && typeof error.error.error === 'string') {
      return error.error.error;
    }
    if (error.error?.errorMessage && typeof error.error.errorMessage === 'string') {
      return error.error.errorMessage;
    }
    if (error.error?.message && typeof error.error.message === 'string') {
      return error.error.message;
    }
    return fallback;
  }
}
