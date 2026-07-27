import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import {
  CoachContactForm,
  CoachContactFormPayload,
  ContactFormService,
} from 'app/service/contact-form.service';
import { WebsiteLeadsComponent } from '../website-leads/website-leads.component';
import { DocumentService } from 'app/service/document.service';

@Component({
  selector: 'app-contact-form-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, WebsiteLeadsComponent],
  templateUrl: './contact-form-manager.component.html',
  styleUrls: ['./contact-form-manager.component.scss'],
})
export class ContactFormManagerComponent implements OnInit {
  @ViewChild('coverInput') coverInput?: ElementRef<HTMLInputElement>;

  form: CoachContactForm | null = null;
  draft: CoachContactFormPayload = this.emptyDraft();
  loading = true;
  saving = false;
  copied = false;
  modalOpen = false;
  error = '';
  uploadError = '';

  constructor(
    private contactFormService: ContactFormService,
    private documentService: DocumentService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  get publicUrl(): string {
    return this.form?.slug ? `${window.location.origin}/contact/${this.form.slug}` : '';
  }

  load(): void {
    this.loading = true;
    this.contactFormService.getMine().subscribe({
      next: (form) => {
        this.form = form;
        this.loading = false;
      },
      error: () => {
        this.error = 'Unable to load your contact form.';
        this.loading = false;
      },
    });
  }

  openCustomize(): void {
    if (!this.form) return;
    this.draft = {
      slug: this.form.slug,
      coverImage: this.form.coverImage || '',
      message: this.form.message,
      published: this.form.published !== false,
    };
    this.uploadError = '';
    this.modalOpen = true;
  }

  closeCustomize(): void {
    if (this.saving) return;
    this.modalOpen = false;
  }

  triggerUpload(): void {
    this.coverInput?.nativeElement.click();
  }

  onCoverSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.uploadError = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      this.uploadError = 'Please select a JPG or PNG image.';
      input.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.uploadError = 'The image must be smaller than 5 MB.';
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const extension = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '';
      const storedFile = new File([file], `contact-cover-${Date.now()}${extension}`, {
        type: file.type,
        lastModified: file.lastModified
      });
      const ownerId = sessionStorage.getItem('userId') || 'coach';
      this.documentService.uploadFileInPath(storedFile, `contact-form-images/${ownerId}`).subscribe({
        next: url => this.draft.coverImage = url,
        error: () => this.uploadError = 'Unable to upload the image.'
      });
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  save(): void {
    if (!this.draft.message.trim() || this.saving) return;
    this.saving = true;
    this.error = '';
    this.contactFormService.saveMine({
      ...this.draft,
      message: this.draft.message.trim(),
    }).subscribe({
      next: (saved) => {
        this.form = saved;
        this.saving = false;
        this.modalOpen = false;
      },
      error: (err) => {
        this.error = err?.error?.message || err?.error || 'Unable to save the contact form.';
        this.saving = false;
      },
    });
  }

  copyLink(): void {
    if (!this.publicUrl) return;
    navigator.clipboard.writeText(this.publicUrl).then(() => {
      this.copied = true;
      setTimeout(() => (this.copied = false), 1800);
    });
  }

  previewSaved(): void {
    if (this.publicUrl) window.open(this.publicUrl, '_blank', 'noopener');
  }

  previewDraft(): void {
    if (!this.form) return;
    const preview: CoachContactForm = { ...this.form, ...this.draft };
    sessionStorage.setItem('contact-form-preview', JSON.stringify(preview));
    window.open(`/contact/${this.draft.slug}?preview=1`, '_blank', 'noopener');
  }

  private emptyDraft(): CoachContactFormPayload {
    return { slug: '', coverImage: '', message: '', published: true };
  }
}
