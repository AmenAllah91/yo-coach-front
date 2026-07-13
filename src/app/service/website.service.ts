import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {environment} from "@env/environment";

export interface CoachWebsiteLead {
  id: string;
  websiteId: string;
  coachId: string;
  slug: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  message?: string;
  sourceType?: 'COACH_WEBSITE' | 'CONTACT_FORM';
  status?: 'NEW' | 'INVITED' | 'DECLINED';
  sourceTheme?: string;
  createdAt: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}

export interface CoachWebsiteLeadPayload {
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
}

export interface CoachWebsiteLead {
  id: string;
  websiteId: string;
  coachId: string;
  slug: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  message?: string;
  sourceType?: 'COACH_WEBSITE' | 'CONTACT_FORM';
  status?: 'NEW' | 'INVITED' | 'DECLINED';
  sourceTheme?: string;
  createdAt: string;
}
export interface CoachWebsitePayload {
  slug: string;
  themeKey: 'elegance' | 'dynamic' | 'trust' | 'serenity';
  themeName: string;

  descriptionBlocks: Array<{
    id: string;
    type: 'text' | 'heading' | 'image';
    content: string;
  }>;

  profile: {
    image: string;
    fullName: string;
    title: string;
    slogan: string;
    bio: string;
  };

  video: {
    url: string;
  };

  announcement: {
    enabled: boolean;
    message: string;
    bgColor: string;
    textColor: string;
  };

  cta: {
    enabled: boolean;
    label: string;
    sticky: boolean;
  };

  leadFields: {
    firstName: boolean;
    lastName: boolean;
    email: boolean;
    phone: boolean;
    buttonLabel: string;
  };

  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    announcementBg: string;
    announcementText: string;
  };

  results: Array<{
    beforeImage: string;
    afterImage: string;
    text: string;
  }>;

  services: Array<{
    image: string;
    title: string;
    price: string;
    description: string;
  }>;

  certificates: Array<{
    image: string;
    title: string;
    organization: string;
    year: string;
  }>;

  testimonials: Array<{
    author: string;
    rating: number;
    text: string;
  }>;

  published: boolean;
}
@Injectable({
  providedIn: 'root'
})
export class WebsiteService {
  private resourceUrl = environment.baseApiUrl + '/api/websites';
  private leadsUrl = environment.baseApiUrl + '/api/website-leads';

  constructor(private http: HttpClient) {}

  saveMyWebsite(payload: CoachWebsitePayload): Observable<any> {
    return this.http.post(`${this.resourceUrl}/me`, payload);
  }

  getMyWebsite(): Observable<any> {
    return this.http.get(`${this.resourceUrl}/me`);
  }

  getPublicWebsite(slug: string): Observable<any> {
    return this.http.get(`${this.resourceUrl}/public/${slug}`);
  }

  submitPublicLead(slug: string, payload: CoachWebsiteLeadPayload): Observable<CoachWebsiteLead> {
    return this.http.post<CoachWebsiteLead>(`${this.leadsUrl}/public/${slug}`, payload);
  }

  getMyLeads(search = '', page = 0, size = 10): Observable<PageResponse<CoachWebsiteLead>> {
    return this.http.get<PageResponse<CoachWebsiteLead>>(
      `${this.leadsUrl}/me?search=${encodeURIComponent(search)}&page=${page}&size=${size}`
    );
  }

  updateLeadStatus(id: string, status: 'NEW' | 'INVITED' | 'DECLINED'): Observable<CoachWebsiteLead> {
    return this.http.patch<CoachWebsiteLead>(
      `${this.leadsUrl}/${encodeURIComponent(id)}/status?status=${status}`,
      {},
    );
  }
}
