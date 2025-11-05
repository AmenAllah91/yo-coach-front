import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from './config/auth.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Component({
  selector: 'app-token-test',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="padding: 20px;">
      <h2>Token Test</h2>
      <button (click)="testToken()">Test Token</button>
      <pre>{{ result | json }}</pre>
    </div>
  `
})
export class TokenTestComponent {
  result: any = {};

  constructor(
    private authService: AuthService,
    private http: HttpClient
  ) {}

  async testToken() {
    try {
      const token = this.authService.getToken();
      const userId = await this.authService.extractUserId();
      
      console.log('=== TOKEN TEST ===');
      console.log('Token:', token);
      console.log('User ID:', userId);
      
      if (token && userId) {
        const headers = new HttpHeaders({
          'Authorization': `Bearer ${token}`
        });
        
        const url = `http://localhost:8080/gym_coaching/clients/coach/${userId}?page=0&size=1`;
        console.log('Testing URL:', url);
        
        this.http.get(url, { headers }).subscribe({
          next: (response) => {
            this.result = { success: true, response };
            console.log('SUCCESS:', response);
          },
          error: (error) => {
            this.result = { success: false, error: error.message, status: error.status };
            console.log('ERROR:', error);
          }
        });
      } else {
        this.result = { error: 'No token or user ID' };
      }
    } catch (error) {
      this.result = { error: error.message };
    }
  }
}