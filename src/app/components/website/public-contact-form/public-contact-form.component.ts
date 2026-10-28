import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { FeatherModule } from 'angular-feather';
import { CoachContactForm, ContactFormService } from 'app/service/contact-form.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LanguageService } from 'app/service/language.service';

export const CONTACT_LIMITS = { fullName: 100, email: 254, message: 2000 };

/**
 * Public page of a coach's contact form: a visitor leaves a name, an email and a message.
 * With `preview`, the same component renders a draft handed by the coach's editor instead of fetching by slug:
 * the editor's live preview is the real page, not a copy of it.
 */
@Component({
  selector: 'app-public-contact-form',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, TranslateModule],
  templateUrl: './public-contact-form.component.html',
  styleUrls: ['./public-contact-form.component.scss'],
})
export class PublicContactFormComponent implements OnInit, OnChanges {
  readonly limits = CONTACT_LIMITS;

  /** Preview mode: renders `previewForm` inert, inside the coach's editor. */
  @Input() preview = false;
  @Input() previewForm: CoachContactForm | null = null;

  form: CoachContactForm | null = null;
  loading = true;
  submitting = false;
  submitted = false;
  error = '';

  lead = { fullName: '', email: '', message: '', termsAccepted: false, website: '' };
  touched = { fullName: false, email: false, message: false, terms: false };

  constructor(
    private route: ActivatedRoute,
    private contactFormService: ContactFormService,
    private translate: TranslateService,
    private languageService: LanguageService,
    private title: Title,
  ) {
    this.translate.use(this.languageService.getCurrentLanguage());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.preview && changes['previewForm']) {
      this.form = this.previewForm;
      this.loading = false;
    }
  }

  ngOnInit(): void {
    if (this.preview) {
      this.form = this.previewForm;
      this.loading = false;
      return;
    }
    const slug = this.route.snapshot.paramMap.get('slug') || '';
    this.contactFormService.getPublic(slug).subscribe({
      next: (form) => {
        this.form = form;
        this.loading = false;
        this.title.setTitle(`${form.coachName} · Yo Coach`);
      },
      error: () => {
        this.error = this.translate.instant('CONTACT_FORM_NOT_AVAILABLE');
        this.loading = false;
      },
    });
  }

  /** Quoted so a URL containing parentheses keeps the CSS rule valid. */
  get coverStyle(): string {
    const url = this.form?.coverImage;
    return url ? `url("${url.replace(/"/g, '%22')}")` : '';
  }

  get coachInitials(): string {
    return (this.form?.coachName || '?').trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase();
  }

  private get trimmedName(): string { return this.lead.fullName.trim(); }
  private get trimmedEmail(): string { return this.lead.email.trim(); }
  private get trimmedMessage(): string { return this.lead.message.trim(); }

  get fullNameError(): string {
    if (!this.trimmedName) return 'CONTACT_ERROR_NAME_REQUIRED';
    if (this.trimmedName.length > this.limits.fullName) return 'CONTACT_ERROR_NAME_LENGTH';
    return '';
  }

  get emailError(): string {
    if (!this.trimmedEmail) return 'CONTACT_ERROR_EMAIL_REQUIRED';
    if (this.trimmedEmail.length > this.limits.email) return 'CONTACT_ERROR_EMAIL_LENGTH';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.trimmedEmail)) return 'CONTACT_ERROR_EMAIL_INVALID';
    return '';
  }

  get messageError(): string {
    if (!this.trimmedMessage) return 'CONTACT_ERROR_MESSAGE_REQUIRED';
    if (this.trimmedMessage.length > this.limits.message) return 'CONTACT_ERROR_MESSAGE_LENGTH';
    return '';
  }

  get termsError(): string {
    return this.lead.termsAccepted ? '' : 'CONTACT_ERROR_TERMS';
  }

  get canSubmit(): boolean {
    return !this.fullNameError && !this.emailError && !this.messageError && !this.termsError && !this.submitting && !this.submitted;
  }

  submit(): void {
    if (!this.form || this.submitting || this.submitted) return;
    if (!this.canSubmit) {
      // Show every problem at once instead of a disabled button that does not say why.
      this.touched = { fullName: true, email: true, message: true, terms: true };
      return;
    }
    this.submitting = true;
    this.error = '';
    this.contactFormService.submitLead(this.form.slug, {
      fullName: this.trimmedName,
      email: this.trimmedEmail,
      message: this.trimmedMessage,
      termsAccepted: this.lead.termsAccepted,
      website: this.lead.website,
    }).subscribe({
      next: () => {
        this.submitting = false;
        this.submitted = true;
      },
      error: (err) => {
        this.error = err?.status === 429 ? 'CONTACT_ERROR_TOO_MANY' : 'CONTACT_ERROR_SEND';
        this.submitting = false;
      },
    });
  }
}
