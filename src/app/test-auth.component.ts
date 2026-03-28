import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from './config/auth.service';
import { HttpClient } from '@angular/common/http';
import {environment} from "@env/environment";

@Component({
  selector: 'app-test-auth',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="padding: 20px;">
      <h2>Auth Test</h2>
      <button (click)="testAuth()">Test Auth</button>
      <pre>{{ result | json }}</pre>
    </div>
  `
})
export class TestAuthComponent {
  result: any = {};

  constructor(
    private authService: AuthService,
    private http: HttpClient
  ) {}

  async testAuth() {
    try {
      const isLoggedIn = this.authService.isLoggedIn();
      const token = await this.authService.getToken();

      this.result = {
        isLoggedIn,
        tokenExists: !!token,
        tokenLength: token?.length || 0,
        tokenPreview: token ? token.substring(0, 50) + '...' : 'No token'
      };

      // Test manual API call with token
      if (token) {
        const headers = { 'Authorization': `Bearer ${token}` };
        this.http.get(environment.baseApiUrl + '/public/enums/', { headers }).subscribe({
          next: (response) => {
            this.result.apiTest = { success: true, response };
          },
          error: (error) => {
            this.result.apiTest = { success: false, error: error.message, status: error.status };
          }
        });
      }
    } catch (error) {
      this.result = { error: error.message };
    }
  }
}
