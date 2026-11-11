import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { Subscription } from 'rxjs';
import { WebsiteAiDraft, WebsiteAiDraftRequest, WebsiteService } from 'app/service/website.service';
import { AiQuotaStatus, aiErrorKey, quotaExhausted } from 'app/service/ai-quota.service';
import { AiQuotaComponent } from 'app/components/ai-quota/ai-quota.component';

type Step = 'form' | 'confirm' | 'loading';

/**
 * IA-21: the questions of the AI website (mostly choices to click), then the wait. Emits the draft; the builder puts it
 * in place. When the coach already wrote texts, they are asked before anything is replaced.
 */
@Component({
  selector: 'app-website-ai-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslateModule, FeatherModule, AiQuotaComponent],
  templateUrl: './website-ai-dialog.component.html',
  styleUrls: ['./website-ai-dialog.component.scss'],
})
export class WebsiteAiDialogComponent implements OnDestroy {
  @ViewChild('dialog') dialog?: ElementRef<HTMLDialogElement>;
  /** The coach already has texts the AI would replace. */
  @Input() hasTexts = false;
  /** ai.website counter (null = not read yet: the server still checks). */
  @Input() quota: AiQuotaStatus | null = null;
  @Input() language: 'fr' | 'en' | 'ar' = 'fr';
  @Output() drafted = new EventEmitter<WebsiteAiDraft>();

  readonly specialties = ['WEIGHT_LOSS', 'MUSCLE', 'FITNESS', 'SPORT', 'NUTRITION', 'YOGA_PILATES', 'OTHER'] as const;
  readonly audiences = ['WOMEN', 'MEN', 'EVERYONE', 'BEGINNERS', 'ATHLETES'] as const;
  readonly locations = ['ONLINE', 'GYM', 'BOTH'] as const;
  readonly styles = ['SERIOUS', 'FRIENDLY', 'MOTIVATING', 'PREMIUM'] as const;
  readonly languages = ['fr', 'en', 'ar'] as const;

  step: Step = 'form';
  error = '';
  answers: WebsiteAiDraftRequest = this.emptyAnswers();
  private request?: Subscription;
  private opened = false;

  constructor(private websites: WebsiteService) {}

  ngOnDestroy(): void { this.request?.unsubscribe(); }

  open(): void {
    this.step = 'form';
    this.error = '';
    // The answers stay as the coach left them (they often generate twice); the language follows the page at first.
    if (!this.opened) this.answers.language = this.language;
    this.opened = true;
    this.dialog?.nativeElement.showModal();
  }

  close(): void {
    if (this.step === 'loading') return;
    this.dialog?.nativeElement.close();
  }

  cancel(event: Event): void { if (this.step === 'loading') event.preventDefault(); }

  get exhausted(): boolean { return quotaExhausted(this.quota); }

  get valid(): boolean {
    const a = this.answers;
    return !!a.specialty && (a.specialty !== 'OTHER' || !!a.specialtyOther?.trim()) && a.audience.length > 0
      && !!a.location && !!a.style && !!a.language;
  }

  toggleAudience(value: WebsiteAiDraftRequest['audience'][number]): void {
    const list = this.answers.audience;
    this.answers.audience = list.includes(value) ? list.filter(v => v !== value) : [...list, value];
  }

  submit(): void {
    if (!this.valid || this.exhausted || this.step === 'loading') return;
    if (this.hasTexts && this.step === 'form') {
      this.step = 'confirm';
      return;
    }
    this.generate();
  }

  private generate(): void {
    this.step = 'loading';
    this.error = '';
    this.request = this.websites.draftWithAi(this.cleaned()).subscribe({
      next: (draft) => {
        this.step = 'form';
        this.dialog?.nativeElement.close();
        this.drafted.emit(draft);
      },
      error: (e) => {
        this.step = 'form';
        this.error = aiErrorKey(e);
      },
    });
  }

  private cleaned(): WebsiteAiDraftRequest {
    const a = this.answers;
    const text = (value?: string | null) => value?.trim() || null;
    return {
      ...a,
      specialtyOther: a.specialty === 'OTHER' ? text(a.specialtyOther) : null,
      city: a.location === 'ONLINE' ? null : text(a.city),
      prices: text(a.prices),
      yearsExperience: a.yearsExperience ?? null,
      clientsCoached: a.clientsCoached ?? null,
    };
  }

  private emptyAnswers(): WebsiteAiDraftRequest {
    return { specialty: 'FITNESS', audience: [], location: 'ONLINE', style: 'MOTIVATING', language: this.language };
  }
}
