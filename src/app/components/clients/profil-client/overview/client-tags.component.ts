import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ClientNotesService } from 'app/service/client-notes.service';
import { ToastService } from 'app/service/toast.service';

/**
 * Client header: the coach's labels on this client (« Perte de poids », « En présentiel »), 2026-11-18. Added and
 * removed in place (saved at once); the labels the coach already uses are suggested. The client list filters on them.
 */
@Component({
  selector: 'app-client-tags',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  template: `
    <div class="tags" role="group" [attr.aria-label]="'CLIENT_TAGS' | translate">
      <span class="tag" *ngFor="let tag of tags">
        {{ tag }}
        <button type="button" [attr.aria-label]="'CLIENT_TAGS_REMOVE' | translate: { tag: tag }" (click)="removeTag(tag)">×</button>
      </span>
      <form *ngIf="adding; else addButton" class="tag-form" (ngSubmit)="addTag()">
        <input #tagInput name="tag" [(ngModel)]="draft" [attr.list]="listId" maxlength="30" autocomplete="off"
               [placeholder]="'CLIENT_TAGS_PLACEHOLDER' | translate" [attr.aria-label]="'CLIENT_TAGS_PLACEHOLDER' | translate"
               (keydown.escape)="cancel()" (blur)="draft.trim() ? addTag() : cancel()" />
        <datalist [id]="listId"><option *ngFor="let tag of suggestions" [value]="tag"></option></datalist>
      </form>
      <ng-template #addButton>
        <button type="button" class="tag-add" *ngIf="tags.length < maxTags" (click)="startAdding()">
          + {{ (tags.length ? 'CLIENT_TAGS_ADD_SHORT' : 'CLIENT_TAGS_ADD') | translate }}
        </button>
      </ng-template>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .tags { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .tag {
      display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 4px 0 9px; border-radius: 999px;
      background: light-dark(#e8f5fb, #1d323c); color: light-dark(#1f6f93, #9fd6ee); font-size: 12px; font-weight: 600;
    }
    .tag button {
      width: 18px; height: 18px; border: 0; border-radius: 50%; background: transparent; color: inherit;
      font-size: 14px; line-height: 1; cursor: pointer;
    }
    .tag button:hover { background: light-dark(rgba(31,111,147,.12), rgba(159,214,238,.16)); }
    .tag-add {
      height: 24px; padding: 0 9px; border: 1px dashed light-dark(#cbd5e1, #4a525b); border-radius: 999px;
      background: transparent; color: light-dark(#64748b, #a5abb4); font-size: 12px; font-weight: 600; cursor: pointer;
    }
    .tag-add:hover { border-color: #44b4df; color: #1f8fbd; }
    .tag-form input {
      height: 26px; width: 170px; padding: 0 9px; border: 1px solid #44b4df; border-radius: 999px;
      background: light-dark(#fff, #1d2125); color: light-dark(#0f172a, #e8ecf6); font-size: 12px;
    }
    .tag-form input:focus { outline: none; }
  `],
})
export class ClientTagsComponent implements OnChanges {
  @Input({ required: true }) clientId = '';

  readonly maxTags = 10;
  readonly listId = 'client-tag-suggestions-' + Math.random().toString(36).slice(2, 8);
  tags: string[] = [];
  suggestions: string[] = [];
  adding = false;
  draft = '';
  private saving = false;

  constructor(private service: ClientNotesService, private toast: ToastService, private translate: TranslateService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['clientId'] || !this.clientId) return;
    this.service.allTags().subscribe({
      next: () => (this.tags = [...this.service.tagsOf(this.clientId)]),
      error: () => (this.tags = []),
    });
  }

  startAdding(): void {
    this.suggestions = this.service.knownTags().filter((tag) => !this.has(tag));
    this.adding = true;
    setTimeout(() => (document.querySelector(`input[list="${this.listId}"]`) as HTMLInputElement | null)?.focus());
  }

  cancel(): void {
    this.adding = false;
    this.draft = '';
  }

  addTag(): void {
    const tag = this.draft.trim().replace(/\s+/g, ' ');
    this.cancel();
    if (!tag || this.has(tag) || this.tags.length >= this.maxTags) return;
    this.save([...this.tags, tag]);
  }

  removeTag(tag: string): void {
    this.save(this.tags.filter((item) => item !== tag));
  }

  private has(tag: string): boolean {
    return this.tags.some((item) => item.toLowerCase() === tag.toLowerCase());
  }

  /** Shown at once, put back if the server refuses. */
  private save(next: string[]): void {
    if (this.saving) return;
    const before = this.tags;
    this.tags = next;
    this.saving = true;
    this.service.setTags(this.clientId, next).subscribe({
      next: (saved) => {
        this.tags = saved;
        this.saving = false;
      },
      error: () => {
        this.tags = before;
        this.saving = false;
        this.toast.error(this.translate.instant('CLIENT_TAGS_SAVE_ERROR'));
      },
    });
  }
}
