import { CommonModule, Location } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';

import {
  AdminAnnouncement,
  AnnouncementLevel,
  AnnouncementRequest,
  CoachAnnouncement,
  PlatformAnnouncementService,
} from 'app/service/platform-announcement.service';
import { AnnouncementBannerComponent } from 'app/components/announcement-banner/announcement-banner.component';
import { ConfirmDialogService } from '@shared/components/confirm-dialog/confirm-dialog.service';
import { ToastService } from 'app/service/toast.service';

export type AnnouncementStatus = 'PLANNED' | 'RUNNING' | 'ENDED';

export interface AnnouncementForm {
  level: AnnouncementLevel;
  messageFr: string;
  messageEn: string;
  messageAr: string;
  linkUrl: string;
  /** datetime-local values (admin's local time), '' = now / no end. */
  startAt: string;
  endAt: string;
  target: 'ALL' | 'ONE';
  coachEmail: string;
}

export const MESSAGE_MAX = 300;

/** Admin screen: write, plan, change and remove the banners shown to the coaches. */
@Component({
  selector: 'app-admin-announcements',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, FeatherModule, AnnouncementBannerComponent],
  templateUrl: './admin-announcements.component.html',
  styleUrl: './admin-announcements.component.scss',
})
export class AdminAnnouncementsComponent implements OnInit {
  readonly levels: AnnouncementLevel[] = ['INFO', 'WARNING', 'URGENT'];
  readonly max = MESSAGE_MAX;

  items: AdminAnnouncement[] = [];
  loading = true;
  error = false;
  saving = false;
  formError = '';
  /** null = form closed; '' = new announcement; otherwise the id being changed. */
  editingId: string | null = null;
  form: AnnouncementForm = AdminAnnouncementsComponent.emptyForm();

  constructor(
    private api: PlatformAnnouncementService,
    private confirm: ConfirmDialogService,
    private toast: ToastService,
    private translate: TranslateService,
    private location: Location,
  ) {}

  ngOnInit(): void {
    this.refresh();
  }

  static emptyForm(): AnnouncementForm {
    return { level: 'INFO', messageFr: '', messageEn: '', messageAr: '', linkUrl: '', startAt: '', endAt: '', target: 'ALL', coachEmail: '' };
  }

  refresh(): void {
    this.loading = true;
    this.error = false;
    this.api.adminList().subscribe({
      next: (list) => {
        this.items = list;
        this.loading = false;
      },
      error: () => {
        this.error = true;
        this.loading = false;
      },
    });
  }

  back(): void {
    this.location.back();
  }

  openNew(): void {
    this.editingId = '';
    this.form = AdminAnnouncementsComponent.emptyForm();
    this.formError = '';
  }

  edit(a: AdminAnnouncement): void {
    this.editingId = a.id;
    this.formError = '';
    this.form = {
      level: a.level,
      messageFr: a.messageFr ?? '',
      messageEn: a.messageEn ?? '',
      messageAr: a.messageAr ?? '',
      linkUrl: a.linkUrl ?? '',
      startAt: AdminAnnouncementsComponent.toLocalInput(a.startAt),
      endAt: AdminAnnouncementsComponent.toLocalInput(a.endAt),
      target: a.coachId ? 'ONE' : 'ALL',
      coachEmail: a.coachEmail ?? '',
    };
  }

  cancel(): void {
    this.editingId = null;
    this.formError = '';
  }

  /** What the coach will see, live while typing. */
  get preview(): CoachAnnouncement {
    return {
      id: 'preview',
      level: this.form.level,
      messageFr: this.form.messageFr.trim() || this.translate.instant('ANNOUNCEMENT_PREVIEW_EMPTY'),
      messageEn: this.form.messageEn.trim() || null,
      messageAr: this.form.messageAr.trim() || null,
      linkUrl: this.form.linkUrl.trim() || null,
      dismissible: this.form.level !== 'URGENT',
    };
  }

  /** Checks done here too, so the admin sees the problem before sending. Returns an i18n key or ''. */
  static validate(form: AnnouncementForm): string {
    if (!form.messageFr.trim()) return 'ANNOUNCEMENT_ERR_FR';
    if ([form.messageFr, form.messageEn, form.messageAr].some((m) => m.trim().length > MESSAGE_MAX)) return 'ANNOUNCEMENT_ERR_TOO_LONG';
    const link = form.linkUrl.trim();
    if (link && !(/^\/(?!\/)\S*$/.test(link) || /^https:\/\/\S+$/i.test(link))) return 'ANNOUNCEMENT_ERR_LINK';
    if (form.endAt) {
      const start = form.startAt ? new Date(form.startAt).getTime() : Date.now();
      if (new Date(form.endAt).getTime() <= start) return 'ANNOUNCEMENT_ERR_DATES';
    }
    if (form.target === 'ONE' && !form.coachEmail.trim()) return 'ANNOUNCEMENT_ERR_EMAIL';
    return '';
  }

  static toRequest(form: AnnouncementForm): AnnouncementRequest {
    const opt = (v: string) => v.trim() || null;
    return {
      level: form.level,
      messageFr: form.messageFr.trim(),
      messageEn: opt(form.messageEn),
      messageAr: opt(form.messageAr),
      linkUrl: opt(form.linkUrl),
      startAt: form.startAt ? new Date(form.startAt).toISOString() : null,
      endAt: form.endAt ? new Date(form.endAt).toISOString() : null,
      coachEmail: form.target === 'ONE' ? opt(form.coachEmail) : null,
    };
  }

  save(): void {
    if (this.saving || this.editingId === null) return;
    const problem = AdminAnnouncementsComponent.validate(this.form);
    if (problem) {
      this.formError = this.translate.instant(problem);
      return;
    }
    this.saving = true;
    this.formError = '';
    const request = AdminAnnouncementsComponent.toRequest(this.form);
    const call = this.editingId ? this.api.update(this.editingId, request) : this.api.create(request);
    call.subscribe({
      next: () => {
        this.saving = false;
        this.editingId = null;
        this.toast.show({ type: 'success', title: this.translate.instant('ANNOUNCEMENT_SAVED') });
        this.refresh();
      },
      error: (e: HttpErrorResponse) => {
        this.saving = false;
        this.formError = AdminAnnouncementsComponent.serverError(e, this.translate);
      },
    });
  }

  async remove(a: AdminAnnouncement): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'ANNOUNCEMENT_DELETE_TITLE',
      text: 'ANNOUNCEMENT_DELETE_TEXT',
      confirm: 'ANNOUNCEMENT_DELETE',
      icon: 'trash-2',
    });
    if (!ok) return;
    this.api.delete(a.id).subscribe({
      next: () => {
        if (this.editingId === a.id) this.editingId = null;
        this.items = this.items.filter((x) => x.id !== a.id);
        this.toast.show({ type: 'success', title: this.translate.instant('ANNOUNCEMENT_DELETED') });
      },
      error: () => this.toast.show({ type: 'error', title: this.translate.instant('ANNOUNCEMENT_ERR_SERVER') }),
    });
  }

  /** Stop now (keeps it in the list as "Ended"). */
  stop(a: AdminAnnouncement): void {
    const request: AnnouncementRequest = {
      level: a.level,
      messageFr: a.messageFr,
      messageEn: a.messageEn,
      messageAr: a.messageAr,
      linkUrl: a.linkUrl,
      startAt: a.startAt,
      endAt: new Date(Math.max(Date.now(), new Date(a.startAt).getTime() + 1000)).toISOString(),
      coachEmail: a.coachEmail,
    };
    this.api.update(a.id, request).subscribe({
      next: () => this.refresh(),
      error: (e: HttpErrorResponse) =>
        this.toast.show({ type: 'error', title: AdminAnnouncementsComponent.serverError(e, this.translate) }),
    });
  }

  status(a: AdminAnnouncement, now = Date.now()): AnnouncementStatus {
    if (new Date(a.startAt).getTime() > now) return 'PLANNED';
    if (a.endAt && new Date(a.endAt).getTime() <= now) return 'ENDED';
    return 'RUNNING';
  }

  static serverError(e: HttpErrorResponse, translate: TranslateService): string {
    const raw = typeof e?.error === 'string' ? e.error : e?.error?.message ?? e?.error?.error ?? '';
    if (/coach/i.test(raw) && /email/i.test(raw)) return translate.instant('ANNOUNCEMENT_ERR_NO_COACH');
    if (/link/i.test(raw)) return translate.instant('ANNOUNCEMENT_ERR_LINK');
    if (/end must be after/i.test(raw)) return translate.instant('ANNOUNCEMENT_ERR_DATES');
    return translate.instant('ANNOUNCEMENT_ERR_SERVER');
  }

  /** ISO instant → value of an <input type="datetime-local"> in the admin's local time. */
  static toLocalInput(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }
}
