import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { CoachPublicProfile } from 'app/service/coach-settings.service';
import { capitalizeFirst, capitalizeSentences, initials } from './client-plan-utils';

/**
 * Public profile of the client's coach (mobile ClientCoachProfileScreen), as filled in by the coach in
 * Settings › Public profile. A bottom sheet at phone width, a dialog on a computer.
 */
@Component({
  selector: 'app-coach-profile-sheet',
  standalone: true,
  imports: [CommonModule, FeatherModule],
  template: `
    <div class="yc-sheet-backdrop" (click)="closed.emit()">
      <section class="yc-sheet" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
        <header class="yc-sheet-header">
          <div class="yc-sheet-header__row">
            <div class="yc-sheet-header__copy"><h2 class="yc-sheet-header__title">{{ fr ? 'Votre coach' : 'Your coach' }}</h2></div>
            <button type="button" class="yc-sheet-header__close" [attr.aria-label]="fr ? 'Fermer' : 'Close'" (click)="closed.emit()">
              <i-feather name="x"></i-feather>
            </button>
          </div>
        </header>
        <div class="yc-sheet__body">
          <div *ngIf="loading" class="yc-loading"><span class="yc-spinner"></span></div>
          <ng-container *ngIf="!loading">
            <div class="profile-head">
              <span class="profile-avatar">
                <span class="yc-avatar" style="--avatar-size: 92px">
                  <img *ngIf="photo; else noPhoto" [src]="photo" [alt]="name" (error)="photoFailed = true" />
                  <ng-template #noPhoto>{{ avatarInitials }}</ng-template>
                </span>
              </span>
              <h3>{{ name }}</h3>
              <p *ngIf="title" class="yc-subtitle">{{ title }}</p>
              <p *ngIf="place" class="profile-place"><i-feather name="map-pin"></i-feather>{{ place }}</p>
            </div>
            <button type="button" class="yc-btn yc-btn--brand message-btn" (click)="message.emit()">
              <i-feather name="message-circle"></i-feather>Message
            </button>

            <div *ngIf="stats.length" class="yc-card stats">
              <div *ngFor="let stat of stats" class="stat">
                <strong>{{ stat[0] }}</strong><span>{{ stat[1] }}</span>
              </div>
            </div>

            <ng-container *ngIf="bio">
              <h4 class="section-title">{{ fr ? 'À propos' : 'About' }}</h4>
              <p class="bio">{{ bio }}</p>
            </ng-container>

            <ng-container *ngIf="specialties.length">
              <h4 class="section-title">{{ fr ? 'Spécialités' : 'Specialties' }}</h4>
              <div class="pills"><span *ngFor="let item of specialties">{{ item }}</span></div>
            </ng-container>

            <ng-container *ngIf="certifications.length">
              <h4 class="section-title">Certifications</h4>
              <div class="yc-card yc-card--flush">
                <ng-container *ngFor="let item of certifications; let i = index">
                  <hr *ngIf="i > 0" class="yc-divider" />
                  <div class="cert"><i-feather name="check-circle"></i-feather><span>{{ item }}</span></div>
                </ng-container>
              </div>
            </ng-container>

            <ng-container *ngIf="languages.length">
              <h4 class="section-title">{{ fr ? 'Langues parlées' : 'Speaks' }}</h4>
              <p class="languages">{{ languages.join(', ') }}</p>
            </ng-container>

            <div *ngIf="socials.length" class="socials">
              <a *ngFor="let social of socials" class="yc-btn yc-btn--secondary" [href]="social.url" target="_blank" rel="noopener">
                <i-feather [name]="social.icon"></i-feather>{{ social.label }}
              </a>
            </div>

            <p *ngIf="!profile" class="yc-subtitle missing">
              {{ fr ? "Votre coach n'a pas encore complété son profil." : 'Your coach has not completed their profile yet.' }}
            </p>
          </ng-container>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .profile-head { display: flex; flex-direction: column; align-items: center; text-align: center; padding-top: 4px; }
    .profile-avatar { padding: 3px; border-radius: 50%; background: var(--yc-surface); box-shadow: var(--yc-shadow-card); }
    .profile-head h3 { margin-top: 12px; font-size: 21px; font-weight: 700; letter-spacing: -0.45px; color: var(--yc-text-primary); }
    .profile-head .yc-subtitle { margin-top: 2px; }
    .profile-place { margin-top: 4px; display: inline-flex; align-items: center; gap: 4px; font-size: 12.5px; font-weight: 500; color: var(--yc-text-secondary); }
    .profile-place i-feather { width: 13px; height: 13px; color: var(--yc-text-hint); }
    .message-btn { margin-top: 16px; height: 50px; }
    .stats { margin-top: 16px; display: flex; padding: 14px 0; }
    .stat { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 0 6px; }
    .stat + .stat { border-left: 1px solid light-dark(#eff1f4, #32363c); }
    .stat strong { font-size: 17px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
    .stat span { font-size: 12px; font-weight: 500; color: var(--yc-text-secondary); }
    .section-title { margin: 22px 0 10px 2px !important; font-size: 16px; font-weight: 600; letter-spacing: -0.2px; }
    .bio { font-size: 14.5px; line-height: 1.45; white-space: pre-line; }
    .pills { display: flex; flex-wrap: wrap; gap: 8px; }
    .pills span {
      padding: 6px 11px; border-radius: 8px; font-size: 12.5px; font-weight: 600; color: var(--yc-primary);
      background: color-mix(in srgb, var(--yc-primary) 8%, transparent);
      border: 1px solid color-mix(in srgb, var(--yc-primary) 25%, transparent);
    }
    .cert { display: flex; align-items: center; gap: 12px; padding: 13px 14px; font-size: 14.5px; }
    .cert i-feather { width: 18px; height: 18px; color: var(--yc-primary); flex: none; }
    .languages { font-size: 14px; color: var(--yc-text-secondary); }
    .socials { margin-top: 20px; display: flex; gap: 10px; }
    .socials .yc-btn { flex: 1; height: 46px; text-decoration: none; }
    .missing { margin-top: 20px !important; text-align: center; }
  `],
})
export class CoachProfileSheetComponent {
  @Input() fr = false;
  @Input() name = '';
  @Input() profile: CoachPublicProfile | null = null;
  @Input() loading = false;
  @Output() closed = new EventEmitter<void>();
  @Output() message = new EventEmitter<void>();
  photoFailed = false;

  private get p(): Partial<CoachPublicProfile> { return this.profile || {}; }
  get photo(): string { return !this.photoFailed && this.p.photoVisible ? (this.p.photoUrl || '').trim() : ''; }
  get avatarInitials(): string { return initials(this.name); }
  get title(): string { return this.p.introductionVisible ? capitalizeFirst(this.p.professionalTitle) : ''; }
  get bio(): string { return this.p.introductionVisible ? capitalizeSentences(this.p.bio) : ''; }
  get place(): string {
    return this.p.practicalDetailsVisible
      ? [capitalizeFirst(this.p.location), (this.p.coachingType || '').trim()].filter(Boolean).join(' · ') : '';
  }
  get specialties(): string[] { return this.p.expertiseVisible ? (this.p.specialties || []).map(capitalizeFirst) : []; }
  get certifications(): string[] { return this.p.expertiseVisible ? (this.p.certifications || []).map(capitalizeFirst) : []; }
  get languages(): string[] { return this.p.practicalDetailsVisible ? (this.p.languages || []).map(capitalizeFirst) : []; }
  get stats(): [string, string][] {
    const experience = this.p.expertiseVisible ? (this.p.experience || '').trim() : '';
    const stats: [string, string][] = [];
    if (experience) stats.push([experience, this.fr ? 'Expérience' : 'Experience']);
    if (this.specialties.length) stats.push([String(this.specialties.length), this.fr ? 'Spécialités' : 'Specialties']);
    if (this.languages.length) stats.push([String(this.languages.length), this.fr ? 'Langues' : 'Languages']);
    return stats;
  }
  get socials(): { label: string; icon: string; url: string }[] {
    if (!this.p.socialLinksVisible) return [];
    const links: { label: string; icon: string; url: string }[] = [];
    if ((this.p.instagramUrl || '').trim()) links.push({ label: 'Instagram', icon: 'camera', url: this.link(this.p.instagramUrl!) });
    if ((this.p.websiteUrl || '').trim()) links.push({ label: this.fr ? 'Site web' : 'Website', icon: 'globe', url: this.link(this.p.websiteUrl!) });
    return links;
  }

  private link(value: string): string {
    const url = value.trim();
    if (url.startsWith('@')) return `https://www.instagram.com/${url.slice(1)}/`;
    return url.startsWith('http') ? url : `https://${url}`;
  }
}
