import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, shareReplay, tap } from 'rxjs';
import { environment } from '@env/environment';

export interface ClientNote {
  id: string;
  clientId: string;
  text: string;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Private notes and labels of the coach on his clients (2026-11-18). Never shown to the client. The labels of all
 * clients are read once (the list filters on them) and kept up to date here after each change.
 */
@Injectable({ providedIn: 'root' })
export class ClientNotesService {
  private readonly baseUrl = `${environment.baseApiUrl}/api/coach`;
  /** Each card shows its own state: no full-page loader. */
  private readonly quiet = new HttpHeaders({ 'X-Skip-Loader': 'true' });
  private tagsByClient$?: Observable<Record<string, string[]>>;
  private tagsByClient: Record<string, string[]> = {};

  constructor(private http: HttpClient) {}

  notes(clientId: string): Observable<ClientNote[]> {
    return this.http.get<ClientNote[]>(`${this.baseUrl}/clients/${encodeURIComponent(clientId)}/notes`, { headers: this.quiet });
  }

  addNote(clientId: string, text: string): Observable<ClientNote> {
    return this.http.post<ClientNote>(`${this.baseUrl}/clients/${encodeURIComponent(clientId)}/notes`, { text }, { headers: this.quiet });
  }

  updateNote(noteId: string, text: string): Observable<ClientNote> {
    return this.http.put<ClientNote>(`${this.baseUrl}/client-notes/${encodeURIComponent(noteId)}`, { text }, { headers: this.quiet });
  }

  deleteNote(noteId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/client-notes/${encodeURIComponent(noteId)}`, { headers: this.quiet });
  }

  /** {clientId: labels} of every client of the coach, read once per session (pass true to read it again). */
  allTags(reload = false): Observable<Record<string, string[]>> {
    if (reload || !this.tagsByClient$) {
      this.tagsByClient$ = this.http
        .get<Record<string, string[]>>(`${this.baseUrl}/client-tags`, { headers: this.quiet })
        .pipe(tap((tags) => (this.tagsByClient = { ...(tags || {}) })), shareReplay(1));
    }
    return this.tagsByClient$;
  }

  /** Every label the coach already uses, sorted (suggestions when adding one). */
  knownTags(): string[] {
    const all = new Map<string, string>();
    Object.values(this.tagsByClient).forEach((tags) => tags.forEach((tag) => all.set(tag.toLowerCase(), tag)));
    return [...all.values()].sort((a, b) => a.localeCompare(b));
  }

  tagsOf(clientId: string): string[] {
    return this.tagsByClient[clientId] || [];
  }

  setTags(clientId: string, tags: string[]): Observable<string[]> {
    return this.http
      .put<string[]>(`${this.baseUrl}/clients/${encodeURIComponent(clientId)}/tags`, { tags }, { headers: this.quiet })
      .pipe(tap((saved) => {
        this.tagsByClient = { ...this.tagsByClient, [clientId]: saved };
        this.tagsByClient$ = of(this.tagsByClient);
      }));
  }
}
