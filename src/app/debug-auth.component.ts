import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from './config/auth.service';
import { HttpClient } from '@angular/common/http';
import {environment} from "@env/environment";

@Component({
  selector: 'app-debug-auth',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="padding: 20px;">
      <h3>Authentication Debug</h3>
      <div>
        <p><strong>Logged In:</strong> {{ isLoggedIn }}</p>
        <p><strong>Token Expired:</strong> {{ isExpired }}</p>
        <p><strong>Token Preview:</strong> {{ tokenPreview }}</p>
        <button (click)="testPublicEndpoint()">Test Public Endpoint</button>
        <button (click)="testProtectedEndpoint()">Test Protected Endpoint</button>
        <div *ngIf="testResult">
          <h4>Test Result:</h4>
          <pre>{{ testResult | json }}</pre>
        </div>
      </div>
    </div>
  `
})
export class DebugAuthComponent implements OnInit {
  isLoggedIn = false;
  isExpired = false;
  tokenPreview = '';
  testResult: any = null;

  constructor(
    private authService: AuthService,
    private http: HttpClient
  ) {}

  async ngOnInit() {
    this.isLoggedIn = this.authService.isLoggedIn();
    this.isExpired = this.authService.isExpired();

    try {
      const token = await this.authService.getToken();
      this.tokenPreview = token ? token.substring(0, 100) + '...' : 'No token';
    } catch (error) {
      this.tokenPreview = 'Error getting token: ' + error;
    }
  }

  testPublicEndpoint() {
    this.http.get(environment.baseApiUrl + '/public/enums/').subscribe({
      next: (result) => this.testResult = { success: true, data: result },
      error: (error) => this.testResult = { success: false, error: error.message }
    });
  }

  testProtectedEndpoint() {
    this.http.get(environment.baseApiUrl + '/api/exercise-ref/templates?page=0&size=1').subscribe({
      next: (result) => this.testResult = { success: true, data: result },
      error: (error) => this.testResult = { success: false, error: error.message }
    });
  }
}
