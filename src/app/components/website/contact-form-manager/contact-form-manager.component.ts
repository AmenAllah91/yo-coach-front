import { firstValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { FeatherModule } from 'angular-feather';
import {
  CoachContactForm,
  CoachContactFormPayload,
  ContactFormService,
} from 'app/service/contact-form.service';
import { CoachWebsiteLeadSummary, WebsiteService } from 'app/service/website.service';
import { DocumentService } from 'app/service/document.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PublicContactFormComponent } from '../public-contact-form/public-contact-form.component';

export const CONTACT_MESSAGE_MAX = 500;

/**
 * The coach's contact form: its public link, its look and the leads it brought.
 * The live preview is the public page component itself, fed with the draft.
 */
@Component({
  selector: 'app-contact-form-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, RouterModule, TranslateModule, PublicContactFormComponent],
  templateUrl: './contact-form-manager.component.html',
  styleUrls: ['./contact-form-manager.component.scss'],
})
export class ContactFormManagerComponent implements OnInit, OnDestroy {
  @ViewChild('coverInput') coverInput?: ElementRef<HTMLInputElement>;

  readonly messageMax = CONTACT_MESSAGE_MAX;

  form: CoachContactForm | null = null;
  draft: CoachContactFormPayload = this.emptyDraft();
  summary: CoachWebsiteLeadSummary | null = null;
  loading = true;
  saving = false;
  copied = false;
  saved = false;
  error = '';
  uploadError = '';
  processingCover = false;
  publishing = false;
  previewOpen = false;
  previewDevice: 'desktop' | 'mobile' = 'desktop';

  private previewCache: { key: string; value: CoachContactForm } | null = null;

  constructor(
    private contactFormService: ContactFormService,
    private websiteService: WebsiteService,
    private documentService: DocumentService,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.load();
    this.websiteService.getMyLeadsSummary().subscribe({
      next: (summary) => (this.summary = summary),
      error: () => (this.summary = null),
    });
  }

  goBack(): void { window.history.back(); }

  get publicUrl(): string {
    return this.form?.slug ? `${window.location.origin}/contact/${this.form.slug}` : '';
  }

  get whatsappShareUrl(): string {
    const text = `${this.translate.instant('CONTACT_SHARE_TEXT')} ${this.publicUrl}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  get emailShareUrl(): string {
    const subject = this.translate.instant('CONTACT_SHARE_SUBJECT');
    const body = `${this.translate.instant('CONTACT_SHARE_TEXT')}\n${this.publicUrl}`;
    return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  /** The saved form with the draft's look; same object while nothing changed, so the preview is not re-fed each tick. */
  get previewForm(): CoachContactForm | null {
    if (!this.form) return null;
    const key = `${this.form.coachName}\u0000${this.draft.coverImage || ''}\u0000${this.draft.message}`;
    if (!this.previewCache || this.previewCache.key !== key) {
      this.previewCache = {
        key,
        value: { ...this.form, coverImage: this.draft.coverImage || '', message: this.draft.message.trim() },
      };
    }
    return this.previewCache.value;
  }

  openPreview(): void {
    this.previewOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closePreview(): void {
    this.previewOpen = false;
    document.body.style.overflow = '';
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.previewOpen) this.closePreview();
  }

  ngOnDestroy(): void {
    if (this.previewOpen) document.body.style.overflow = '';
  }

  get dirty(): boolean {
    if (!this.form) return false;
    return this.draft.message.trim() !== (this.form.message || '').trim()
      || (this.draft.coverImage || '') !== (this.form.coverImage || '');
  }

  get messageError(): string {
    return this.draft.message.trim().length > this.messageMax
      ? this.translate.instant('CONTACT_MESSAGE_LENGTH_ERROR') : '';
  }

  get canSave(): boolean {
    return this.dirty && !this.saving && !this.processingCover && !this.messageError;
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.contactFormService.getMine().subscribe({
      next: (form) => {
        this.form = form;
        this.resetDraft();
        this.loading = false;
      },
      error: () => {
        this.error = this.translate.instant('LOAD_CONTACT_FORM_ERROR');
        this.loading = false;
      },
    });
  }

  resetDraft(): void {
    if (!this.form) return;
    this.draft = {
      slug: this.form.slug,
      coverImage: this.form.coverImage || '',
      message: this.form.message || '',
      published: this.form.published !== false,
    };
    this.uploadError = '';
    if (this.coverInput) this.coverInput.nativeElement.value = '';
  }

  triggerUpload(): void {
    this.coverInput?.nativeElement.click();
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
    this.saved = false;
    this.error = '';
    this.contactFormService.saveMine({
      ...this.draft,
      message: this.draft.message.trim(),
      published: this.form?.published !== false,
    }).subscribe({
      next: (saved) => {
        this.form = saved;
        this.resetDraft();
        this.saving = false;
        this.saved = true;
        setTimeout(() => (this.saved = false), 2500);
      },
      error: (err) => {
        this.error = err?.error?.error || err?.error?.message
          || (typeof err?.error === 'string' ? err.error : '')
          || this.translate.instant('SAVE_CONTACT_FORM_ERROR');
        this.saving = false;
      },
    });
  }

  /** Online/offline applies at once (it is not part of the look being edited). */
  togglePublished(): void {
    if (!this.form || this.publishing) return;
    const published = this.form.published === false;
    this.publishing = true;
    this.error = '';
    this.contactFormService.saveMine({
      slug: this.form.slug,
      coverImage: this.form.coverImage || '',
      message: this.form.message || '',
      published,
    }).subscribe({
      next: (saved) => {
        this.form = { ...saved };
        this.draft.published = saved.published !== false;
        this.publishing = false;
      },
      error: () => {
        this.error = this.translate.instant('SAVE_CONTACT_FORM_ERROR');
        this.publishing = false;
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

  openPublicForm(): void {
    if (this.publicUrl) window.open(this.publicUrl, '_blank', 'noopener');
  }

  /** CSS background for an image URL; quotes keep a URL with parentheses from breaking the rule. */
  cssImage(url?: string): string {
    return url ? `url("${url.replace(/"/g, '%22')}")` : '';
  }

  private emptyDraft(): CoachContactFormPayload {
    return { slug: '', coverImage: '', message: '', published: true };
  }
}
