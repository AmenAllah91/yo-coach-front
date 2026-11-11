import { Component, DestroyRef, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap, timer } from 'rxjs';

import { AuthService } from '@config/auth.service';
import {
  AnnouncementLevel,
  CoachAnnouncement,
  PlatformAnnouncementService,
  announcementText,
} from 'app/service/platform-announcement.service';

/** Read again every 5 minutes: a banner planned for 00h shows up without reloading the page. */
export const ANNOUNCEMENT_REFRESH_MS = 5 * 60 * 1000;

const ICONS: Record<AnnouncementLevel, string> = { INFO: 'info', WARNING: 'alert-triangle', URGENT: 'alert-octagon' };

/**
 * Banners written by the admin (planned update, payment incident...), between the header and the content of every
 * coach page. One at a time, the most important first; arrows when there are several. INFO / WARNING can be closed
 * (kept by CE, so the mobile app hides it too); URGENT cannot.
 *
 * With `preview`, shows that announcement only (admin form), without loading or closing anything.
 */
@Component({
  selector: 'app-announcement-banner',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule, FeatherModule],
  templateUrl: './announcement-banner.component.html',
  styleUrl: './announcement-banner.component.scss',
})
export class AnnouncementBannerComponent implements OnInit {
  @Input() preview: CoachAnnouncement | null = null;

  items: CoachAnnouncement[] = [];
  index = 0;
  closing = false;

  private destroyRef = inject(DestroyRef);

  constructor(
    private api: PlatformAnnouncementService,
    private auth: AuthService,
    private translate: TranslateService,
  ) {}

  async ngOnInit(): Promise<void> {
    if (this.preview !== null) return;
    let roles: string[] = [];
    try {
      roles = await this.auth.extractRoles();
    } catch {
      return;
    }
    // Admins and clients use the same layout: the banners are for coaches only.
    if (!roles.includes('ROLE_COACH')) return;
    timer(0, ANNOUNCEMENT_REFRESH_MS)
      .pipe(
        switchMap(() => this.api.active().pipe(catchError(() => of(null)))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((list) => {
        if (list === null) return; // CE unreachable: keep what is shown.
        const currentId = this.current?.id;
        this.items = list;
        const kept = list.findIndex((a) => a.id === currentId);
        this.index = kept >= 0 ? kept : 0;
      });
  }

  get current(): CoachAnnouncement | null {
    if (this.preview) return this.preview;
    return this.items[this.index] ?? null;
  }

  get count(): number {
    return this.preview ? 1 : this.items.length;
  }

  icon(level: AnnouncementLevel): string {
    return ICONS[level] ?? 'info';
  }

  text(a: CoachAnnouncement): string {
    return announcementText(a, this.translate.currentLang);
  }

  isAppPath(link: string): boolean {
    return link.startsWith('/') && !link.startsWith('//');
  }

  move(delta: number): void {
    if (!this.items.length) return;
    this.index = (this.index + delta + this.items.length) % this.items.length;
  }

  close(): void {
    const a = this.current;
    if (!a || !a.dismissible || this.closing || this.preview) return;
    this.closing = true;
    // Hidden at once; if CE refuses, it comes back at the next reading.
    this.items = this.items.filter((x) => x.id !== a.id);
    if (this.index >= this.items.length) this.index = 0;
    this.api.dismiss(a.id).subscribe({
      next: () => (this.closing = false),
      error: () => (this.closing = false),
    });
  }
}
