import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { FeatherModule } from 'angular-feather';
import { CoachContactForm, ContactFormService } from 'app/service/contact-form.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LanguageService } from 'app/service/language.service';

@Component({
  selector: 'app-public-contact-form',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, TranslateModule],
  templateUrl: './public-contact-form.component.html',
  styleUrls: ['./public-contact-form.component.scss'],
})
export class PublicContactFormComponent implements OnInit {
  form: CoachContactForm | null = null;
  loading = true;
  submitting = false;
  submitted = false;
  error = '';
  isPreview = false;

  lead = { fullName: '', email: '', message: '', termsAccepted: false, website: '' };
  touched = { fullName: false, email: false, message: false, terms: false };

  constructor(
    private route: ActivatedRoute,
    private contactFormService: ContactFormService,
    private translate: TranslateService,
    private languageService: LanguageService,
  ) {
    this.translate.use(this.languageService.getCurrentLanguage());
  }

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug') || '';
    this.isPreview = this.route.snapshot.queryParamMap.get('preview') === '1';
    if (this.isPreview) {
      try {
        const preview = sessionStorage.getItem('contact-form-preview');
        if (preview) {
          this.form = JSON.parse(preview);
          this.loading = false;
          return;
        }
      } catch {}
    }

    this.contactFormService.getPublic(slug).subscribe({
      next: (form) => {
        this.form = form;
        this.loading = false;
      },
      error: () => {
        this.error = this.translate.instant('CONTACT_FORM_NOT_AVAILABLE');
        this.loading = false;
      },
    });
  }

  private get trimmedName(): string { return this.lead.fullName.trim(); }
  private get trimmedEmail(): string { return this.lead.email.trim(); }
  private get trimmedMessage(): string { return this.lead.message.trim(); }

  get fullNameError(): string {
    if (!this.trimmedName) return 'Full name is required.';
    if (this.trimmedName.length > 100) return 'Full name must not exceed 100 characters.';
    return '';
  }

  get emailError(): string {
    if (!this.trimmedEmail) return 'Email is required.';
    if (this.trimmedEmail.length > 254) return 'Email must not exceed 254 characters.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.trimmedEmail)) return 'Enter a valid email address.';
    return '';
  }

  get messageError(): string {
    if (!this.trimmedMessage) return 'Message is required.';
    if (this.trimmedMessage.length > 2000) return 'Message must not exceed 2,000 characters.';
    return '';
  }

  get termsError(): string {
    return this.lead.termsAccepted ? '' : 'You must accept the Terms & Conditions.';
  }

  get canSubmit(): boolean {
    return !this.fullNameError && !this.emailError && !this.messageError && !this.termsError && !this.submitting && !this.submitted;
  }

  submit(): void {
    if (!this.form || !this.canSubmit || this.isPreview) return;
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
      error: () => {
        this.error = 'Unable to send your message. Please try again.';
        this.submitting = false;
      },
    });
  }
}
