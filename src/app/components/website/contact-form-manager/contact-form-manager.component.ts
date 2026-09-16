import { firstValueFrom } from 'rxjs';
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
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-contact-form-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, WebsiteLeadsComponent, TranslateModule],
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
  processingCover = false;

  constructor(
    private contactFormService: ContactFormService,
    private documentService: DocumentService,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  goBack(): void { window.history.back(); }

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
        this.error = this.translate.instant('LOAD_CONTACT_FORM_ERROR');
        this.loading = false;
      },
    });
  }

  openCustomize(): void {
    if (!this.form || this.saving || this.processingCover) return;
    this.draft = {
      slug: this.form.slug,
      coverImage: this.form.coverImage || '',
      message: this.form.message,
      published: this.form.published !== false,
    };
    this.uploadError = '';
    this.error = '';
    this.modalOpen = true;
  }

  closeCustomize(): void {
    if (this.saving || this.processingCover) return;
    this.modalOpen = false;
  }

  triggerUpload(): void {
    this.coverInput?.nativeElement.click();
  }

  get messageError(): string {
    return this.draft.message.trim().length > 500
      ? this.translate.instant('CONTACT_MESSAGE_LENGTH_ERROR') : '';
  }

  get canSave(): boolean {
    return !this.saving && !this.processingCover && !this.uploadError && !this.messageError;
  }

  removeCover(): void {
    if (this.saving || this.processingCover) return;
    this.draft.coverImage = '';
    this.uploadError = '';
    if (this.coverInput) this.coverInput.nativeElement.value = '';
  }

  async onCoverSelected(event: Event): Promise<void> {
    if (this.saving || this.processingCover) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploadError = '';
    if (!/\.(jpe?g|png|webp)$/i.test(file.name) ||
        !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.uploadError = this.translate.instant('CONTACT_IMAGE_TYPE_ERROR');
      input.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.uploadError = this.translate.instant('CONTACT_IMAGE_SIZE_ERROR');
      input.value = '';
      return;
    }
    this.processingCover = true;
    const objectUrl = URL.createObjectURL(file);
    try {
      await new Promise<void>((resolve, reject) => {
        const image = new Image();
        image.onload = () => image.naturalWidth > 0 && image.naturalHeight > 0
          ? resolve() : reject(new Error('dimensions'));
        image.onerror = () => reject(new Error('dimensions'));
        image.src = objectUrl;
      });
      const extension = file.name.split('.').pop()!.toLowerCase();
      const storedFile = new File([file], `contact-cover-${Date.now()}.${extension}`, {
        type: file.type, lastModified: file.lastModified,
      });
      const ownerId = sessionStorage.getItem('userId') || 'coach';
      this.draft.coverImage = await firstValueFrom(
        this.documentService.uploadFileInPath(storedFile, `contact-form-images/${ownerId}`));
    } catch (error) {
      this.uploadError = this.translate.instant(error instanceof Error && error.message === 'dimensions'
        ? 'CONTACT_IMAGE_DIMENSIONS_ERROR' : 'CONTACT_IMAGE_UPLOAD_ERROR');
    } finally {
      URL.revokeObjectURL(objectUrl);
      input.value = '';
      this.processingCover = false;
    }
  }

  save(): void {
    if (!this.canSave) return;
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
        this.error = err?.error?.message || err?.error || this.translate.instant('SAVE_CONTACT_FORM_ERROR');
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
