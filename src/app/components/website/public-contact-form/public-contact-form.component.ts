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

  lead = { fullName: '', email: '', message: '', termsAccepted: false };

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

  get canSubmit(): boolean {
    return !!this.lead.fullName.trim() &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.lead.email.trim()) &&
      !!this.lead.message.trim() &&
      this.lead.termsAccepted &&
      !this.submitting;
  }

  submit(): void {
    if (!this.form || !this.canSubmit || this.isPreview) return;
    this.submitting = true;
    this.error = '';
    this.contactFormService.submitLead(this.form.slug, {
      fullName: this.lead.fullName.trim(),
      email: this.lead.email.trim(),
      message: this.lead.message.trim(),
      termsAccepted: this.lead.termsAccepted,
    }).subscribe({
      next: () => {
        this.submitting = false;
        this.submitted = true;
      },
      error: () => {
        this.error = this.translate.instant('REQUEST_SEND_ERROR');
        this.submitting = false;
      },
    });
  }
}
