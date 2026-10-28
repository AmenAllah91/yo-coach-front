import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {environment} from "@env/environment";
import { SocialLinks, StatItem, WebsiteDesign } from 'app/components/website/models/website-design';

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
  sourceType?: LeadSource;
  status?: LeadStatus;
  sourceTheme?: string;
  createdAt: string;
}

export type LeadStatus = 'NEW' | 'INVITED' | 'DECLINED';
export type LeadSource = 'COACH_WEBSITE' | 'CONTACT_FORM';

/** Counters of the whole inbox, whatever the current search. */
export interface CoachWebsiteLeadSummary {
  total: number;
  newCount: number;
  invited: number;
  declined: number;
  website: number;
  contactForm: number;
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

/** Sent by a visitor of a coach website: every field is optional, but an email or a phone is required. */
export interface CoachWebsiteLeadPayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  message?: string;
  website?: string;
}

/** DNS check of the coach's own domain, as answered by the API. */
export interface CustomDomainCheck {
  domain: string;
  ownershipVerified: boolean;
  pointsToPlatform: boolean;
  status: 'PENDING' | 'VERIFIED';
}

export interface CoachWebsitePayload {
  slug: string;
  /** Id of the design preset the coach started from (old sites: elegance | dynamic | trust | serenity). */
  themeKey: string;
  themeName: string;

  design: WebsiteDesign;
  socialLinks: SocialLinks;
  stats: StatItem[];
  /** The coach's own domain (apex, without www); empty when the site only uses the slug. */
  customDomain: string;

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
    return this.http.get(`${this.resourceUrl}/public/${encodeURIComponent(slug)}`);
  }

  /** The site behind the host the visitor typed (slug.yo-coach.app or a coach's own domain). */
  resolvePublicWebsite(host: string): Observable<any> {
    const params = new HttpParams({ fromObject: { host } });
    return this.http.get(`${this.resourceUrl}/public/resolve`, { params });
  }

  verifyCustomDomain(): Observable<CustomDomainCheck> {
    return this.http.post<CustomDomainCheck>(`${this.resourceUrl}/me/custom-domain/verify`, {}, { headers: { 'X-Skip-Loader': 'true' } });
  }

  submitPublicLead(slug: string, payload: CoachWebsiteLeadPayload): Observable<void> {
    return this.http.post<void>(`${this.leadsUrl}/public/${encodeURIComponent(slug)}`, payload);
  }

  getMyLeads(search = '', page = 0, size = 10, status: LeadStatus | '' = '', source: LeadSource | '' = ''): Observable<PageResponse<CoachWebsiteLead>> {
    const params = new HttpParams({ fromObject: { search, page, size, status, source } });
    return this.http.get<PageResponse<CoachWebsiteLead>>(`${this.leadsUrl}/me`, {
      params,
      headers: { 'X-Skip-Loader': 'true' }, // the leads page shows its own loading state
    });
  }

  getMyLeadsSummary(): Observable<CoachWebsiteLeadSummary> {
    return this.http.get<CoachWebsiteLeadSummary>(`${this.leadsUrl}/me/summary`, { headers: { 'X-Skip-Loader': 'true' } });
  }

  updateLeadStatus(id: string, status: LeadStatus): Observable<CoachWebsiteLead> {
    return this.http.patch<CoachWebsiteLead>(
      `${this.leadsUrl}/${encodeURIComponent(id)}/status?status=${status}`,
      {},
    );
  }
}
