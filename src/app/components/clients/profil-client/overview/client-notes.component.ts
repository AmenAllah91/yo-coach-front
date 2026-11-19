import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ClientNote, ClientNotesService } from 'app/service/client-notes.service';
import { ConfirmDialogService } from 'app/shared/components/confirm-dialog/confirm-dialog.service';
import { ToastService } from 'app/service/toast.service';

/**
 * Profile dashboard, right column: the coach's private notes on this client (2026-11-18), newest first.
 * « Douleur au genou gauche, éviter les squats lourds ». Never shown to the client.
 */
@Component({
  selector: 'app-client-notes',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  styleUrls: ['./overview.scss', './client-notes.component.scss'],
  template: `
    <article class="ov-card notes">
      <header class="ov-head ov-head--main">
        <span class="ov-tile ov-tile--slate"><i class="fas fa-note-sticky"></i></span>
        <span class="ov-head__titles">
          <h3>{{ 'CLIENT_NOTES_TITLE' | translate }}<span class="notes-count" *ngIf="notes.length">{{ notes.length }}</span></h3>
          <small><i class="fas fa-lock"></i> {{ 'CLIENT_NOTES_PRIVATE' | translate }}</small>
        </span>
      </header>

      <form class="notes-new" (ngSubmit)="add()">
        <textarea name="newNote" rows="2" [(ngModel)]="draft" [maxlength]="maxLength"
                  [placeholder]="'CLIENT_NOTES_PLACEHOLDER' | translate"
                  [attr.aria-label]="'CLIENT_NOTES_PLACEHOLDER' | translate"
                  (keydown.control.enter)="add()" (keydown.meta.enter)="add()"></textarea>
        <div class="notes-new__bar" *ngIf="draft.trim()">
          <button type="button" class="notes-ghost" (click)="draft = ''">{{ 'CANCEL' | translate }}</button>
          <button type="submit" class="notes-btn" [disabled]="saving">{{ 'CLIENT_NOTES_ADD' | translate }}</button>
        </div>
      </form>

      <p class="notes-state" *ngIf="loading">{{ 'LOADING' | translate }}</p>
      <p class="notes-state notes-state--error" *ngIf="error">
        {{ 'CLIENT_NOTES_LOAD_ERROR' | translate }}
        <button type="button" class="ov-link" (click)="load()">{{ 'RETRY' | translate }}</button>
      </p>
      <p class="notes-state" *ngIf="!loading && !error && !notes.length">{{ 'CLIENT_NOTES_EMPTY' | translate }}</p>

      <ul class="notes-list" *ngIf="notes.length">
        <li *ngFor="let note of visibleNotes; trackBy: trackById" class="note">
          <ng-container *ngIf="editingId !== note.id; else editNote">
            <p class="note__text">{{ note.text }}</p>
            <div class="note__meta">
              <time>{{ note.createdAt | date: 'd MMM y':undefined:locale }}</time>
              <button type="button" class="note__icon" (click)="edit(note)"
                      [attr.aria-label]="'EDIT' | translate" [title]="'EDIT' | translate"><i class="fas fa-pen"></i></button>
              <button type="button" class="note__icon note__icon--danger" (click)="remove(note)"
                      [attr.aria-label]="'DELETE' | translate" [title]="'DELETE' | translate"><i class="fas fa-trash-can"></i></button>
            </div>
          </ng-container>
          <ng-template #editNote>
            <form class="notes-new" (ngSubmit)="saveEdit(note)">
              <textarea name="editNote" rows="3" [(ngModel)]="editText" [maxlength]="maxLength"
                        [attr.aria-label]="'CLIENT_NOTES_TITLE' | translate"></textarea>
              <div class="notes-new__bar">
                <button type="button" class="notes-ghost" (click)="editingId = null">{{ 'CANCEL' | translate }}</button>
                <button type="submit" class="notes-btn" [disabled]="!editText.trim() || saving">{{ 'SAVE' | translate }}</button>
              </div>
            </form>
          </ng-template>
        </li>
      </ul>
      <button type="button" class="ov-link notes-more" *ngIf="notes.length > shown" (click)="shown = notes.length">
        {{ 'CLIENT_NOTES_SHOW_ALL' | translate: { count: notes.length } }}
      </button>
    </article>
  `,
})
export class ClientNotesComponent implements OnChanges {
  @Input({ required: true }) clientId = '';

  readonly maxLength = 2000;
  notes: ClientNote[] = [];
  loading = false;
  error = false;
  saving = false;
  draft = '';
  editingId: string | null = null;
  editText = '';
  /** The last 3 notes, then « Voir les N notes ». */
  shown = 3;

  constructor(
    private service: ClientNotesService,
    private confirm: ConfirmDialogService,
    private toast: ToastService,
    private translate: TranslateService,
  ) {}

  /** Dates in the language of the interface (« 19 nov. 2026 »). */
  get locale(): string {
    return (this.translate.currentLang || this.translate.defaultLang || '').startsWith('fr') ? 'fr' : 'en';
  }

  get visibleNotes(): ClientNote[] {
    return this.notes.slice(0, this.shown);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['clientId'] && this.clientId) this.load();
  }

  load(): void {
    this.loading = true;
    this.error = false;
    this.service.notes(this.clientId).subscribe({
      next: (notes) => {
        this.notes = notes || [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = true;
      },
    });
  }

  add(): void {
    const text = this.draft.trim();
    if (!text || this.saving) return;
    this.saving = true;
    this.service.addNote(this.clientId, text).subscribe({
      next: (note) => {
        this.notes = [note, ...this.notes];
        this.draft = '';
        this.saving = false;
      },
      error: () => this.failed(),
    });
  }

  edit(note: ClientNote): void {
    this.editingId = note.id;
    this.editText = note.text;
  }

  saveEdit(note: ClientNote): void {
    const text = this.editText.trim();
    if (!text || this.saving) return;
    this.saving = true;
    this.service.updateNote(note.id, text).subscribe({
      next: (saved) => {
        this.notes = this.notes.map((item) => (item.id === saved.id ? saved : item));
        this.editingId = null;
        this.saving = false;
      },
      error: () => this.failed(),
    });
  }

  async remove(note: ClientNote): Promise<void> {
    const ok = await this.confirm.ask({ title: 'CLIENT_NOTES_DELETE_TITLE', text: 'CLIENT_NOTES_DELETE_TEXT', confirm: 'DELETE', icon: 'trash-2' });
    if (!ok) return;
    // Removed at once, put back if the server refuses.
    const before = this.notes;
    this.notes = this.notes.filter((item) => item.id !== note.id);
    this.service.deleteNote(note.id).subscribe({
      error: () => {
        this.notes = before;
        this.toast.error(this.translate.instant('CLIENT_NOTES_SAVE_ERROR'));
      },
    });
  }

  trackById(_index: number, note: ClientNote): string {
    return note.id;
  }

  private failed(): void {
    this.saving = false;
    this.toast.error(this.translate.instant('CLIENT_NOTES_SAVE_ERROR'));
  }
}
