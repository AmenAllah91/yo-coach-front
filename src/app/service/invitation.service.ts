import { Injectable } from '@angular/core';
import {environment} from "@env/environment";
import {HttpClient} from "@angular/common/http";

@Injectable({
  providedIn: 'root'
})
export class InvitationService {

  private baseUrl = environment.baseApiUrl + '/invitation';

  constructor(private http: HttpClient) {}

  generateInvitation(data: any) {
    return this.http.post<any>(`${this.baseUrl}/generate`, data);
  }

  getInvitationByToken(token: string) {
    return this.http.get<any>(`${this.baseUrl}/token/${token}`);
  }

  acceptInvitation(token: string, userId: string) {
    return this.http.post(`${this.baseUrl}/token/${token}/accept`, null, {
      params: { userId }
    });
  }

  sendInvitation(token: string, coachId: string, email: string) {
    return this.http.post(`${this.baseUrl}/send`, null, {
      params: { token, coachId, email }
    });
  }

  deleteInvitationByToken(token: string) {
    return this.http.delete(`${this.baseUrl}/token/${token}`);
  }
}
