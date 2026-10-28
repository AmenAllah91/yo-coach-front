import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { ProgramOverview } from '@shared/models/program-schedule';
import { clientObjectiveLabel } from '../../../models/client-objective';

export type ClientHeaderStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED';

interface ProfileRow {
  icon: string;
  label: string;
  value: string;
  hint?: string;
  copy?: boolean;
  href?: string;
}

/**
 * Everything the coach should know about the client, out of the header: contact, personal details, goals and
 * follow-up. A panel on the right on a computer, a full-height sheet on a phone (the mobile app shows the same).
 */
@Component({
  selector: 'app-client-profile-panel',
  standalone: true,
  imports: [CommonModule, FeatherModule],
  template: `
    <div class="cpp-backdrop" (click)="closed.emit()">
      <aside class="cpp" role="dialog" aria-modal="true" [attr.aria-label]="t('Profil du client', 'Client profile')" (click)="$event.stopPropagation()">
        <header class="cpp__bar">
          <span>{{ t('Profil du client', 'Client profile') }}</span>
          <button type="button" class="cpp__close" [attr.aria-label]="t('Fermer', 'Close')" (click)="closed.emit()">
            <i-feather name="x"></i-feather>
          </button>
        </header>

        <div class="cpp__body">
          <section class="cpp__hero">
            <span class="cpp__avatar" [attr.data-status]="status">
              <img *ngIf="photo && !photoFailed; else initialsTpl" [src]="photo" [alt]="name" (error)="photoFailed = true" />
              <ng-template #initialsTpl>{{ initials }}</ng-template>
            </span>
            <h2>{{ name }}</h2>
            <p class="cpp__meta">
              <span class="cpp-status" [attr.data-status]="status"><i></i>{{ statusLabel }}</span>
              <span *ngIf="clientSince">{{ t('Client depuis', 'Client since') }} {{ clientSince }}</span>
            </p>
            <div class="cpp__actions">
              <button type="button" class="cpp-btn cpp-btn--dark" (click)="message.emit()">
                <i-feather name="message-circle"></i-feather>{{ t('Message', 'Message') }}
              </button>
              <a *ngIf="email" class="cpp-btn" [href]="'mailto:' + email">
                <i-feather name="mail"></i-feather>{{ t('E-mail', 'Email') }}
              </a>
              <a *ngIf="phone" class="cpp-btn" [href]="'tel:' + phone">
                <i-feather name="phone"></i-feather>{{ t('Appeler', 'Call') }}
              </a>
            </div>
          </section>

          <section class="cpp__weights" *ngIf="startWeight !== '--' || currentWeight !== '--' || goalWeight !== '--'">
            <div><small>{{ t('Départ', 'Start') }}</small><strong>{{ startWeight }}</strong></div>
            <div class="is-now"><small>{{ t('Actuel', 'Current') }}</small><strong>{{ currentWeight }}</strong></div>
            <div><small>{{ t('Cible', 'Goal') }}</small><strong>{{ goalWeight }}</strong></div>
          </section>

          <section *ngFor="let group of groups" class="cpp-group">
            <h3>{{ group.title }}</h3>
            <div class="cpp-card">
              <div *ngFor="let row of group.rows" class="cpp-row" [class.is-empty]="!row.value">
                <span class="cpp-row__icon"><i-feather [name]="row.icon"></i-feather></span>
                <span class="cpp-row__label">{{ row.label }}</span>
                <span class="cpp-row__value">
                  <ng-container *ngIf="row.value; else emptyTpl">
                    <a *ngIf="row.href; else plainTpl" [href]="row.href">{{ row.value }}</a>
                    <ng-template #plainTpl>{{ row.value }}</ng-template>
                    <small *ngIf="row.hint">{{ row.hint }}</small>
                  </ng-container>
                  <ng-template #emptyTpl>{{ t('Non renseigné', 'Not provided') }}</ng-template>
                </span>
                <button
                  *ngIf="row.copy && row.value"
                  type="button"
                  class="cpp-row__copy"
                  [class.is-done]="copied === row.label"
                  [attr.aria-label]="t('Copier', 'Copy') + ' ' + row.label"
                  [title]="copied === row.label ? t('Copié', 'Copied') : t('Copier', 'Copy')"
                  (click)="copy(row)"
                >
                  <i-feather [name]="copied === row.label ? 'check' : 'copy'"></i-feather>
                </button>
              </div>
            </div>
          </section>

          <section *ngIf="bio" class="cpp-group">
            <h3>{{ t('À propos', 'About') }}</h3>
            <p class="cpp-card cpp-bio">{{ bio }}</p>
          </section>
        </div>
      </aside>
    </div>
  `,
  styles: [`
    :host { --ink: light-dark(#07152f, #e8edf7); --muted: light-dark(#66768d, #a4a9b2); --line: light-dark(#e6edf4, #32383d); --brand: #0c86c8; }
    .cpp-backdrop { position: fixed; inset: 0; z-index: 2300; display: flex; justify-content: flex-end; background: rgba(7, 21, 47, .38); backdrop-filter: blur(2px); animation: cpp-fade .18s ease; }
    .cpp { width: min(440px, 100vw); height: 100%; display: flex; flex-direction: column; background: light-dark(#f7f9fc, #171a1e); box-shadow: -24px 0 60px rgba(7, 21, 47, .18); animation: cpp-in .24s cubic-bezier(.2, .8, .2, 1); font-family: inherit; color: var(--ink); }
    .cpp__bar { height: 56px; flex: 0 0 56px; padding: 0 12px 0 22px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--line); background: light-dark(#fff, #1d2125); font-size: 14px; font-weight: 700; }
    .cpp__close { width: 36px; height: 36px; display: grid; place-items: center; border: 0; border-radius: 10px; background: transparent; color: var(--muted); cursor: pointer; }
    .cpp__close:hover { background: light-dark(#f1f5f9, #15181d); color: var(--ink); }
    .cpp__close i-feather, .cpp-btn i-feather { width: 17px; height: 17px; }
    .cpp__body { flex: 1; overflow-y: auto; padding: 0 0 28px; }

    .cpp__hero { padding: 26px 22px 20px; display: flex; flex-direction: column; align-items: center; text-align: center; background: linear-gradient(180deg, light-dark(#fff, #1d2125) 0%, light-dark(#f7f9fc, #171a1e) 100%); border-bottom: 1px solid var(--line); }
    .cpp__avatar { position: relative; width: 76px; height: 76px; display: grid; place-items: center; border-radius: 50%; background: linear-gradient(135deg, light-dark(#e0f2fe, #143446), light-dark(#bae6fd, #0a3a4e)); color: light-dark(#075985, #81c6f8); font-size: 24px; font-weight: 700; letter-spacing: .5px; box-shadow: 0 0 0 4px #fff, 0 6px 18px rgba(12, 134, 200, .18); }
    .cpp__avatar img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
    .cpp__hero h2 { margin: 14px 0 6px; font-size: 20px; line-height: 26px; font-weight: 700; letter-spacing: -.2px; }
    .cpp__meta { margin: 0; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; color: var(--muted); font-size: 12.5px; }
    .cpp__actions { margin-top: 18px; display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
    .cpp-btn { height: 38px; padding: 0 14px; display: inline-flex; align-items: center; gap: 7px; border: 1px solid var(--line); border-radius: 10px; background: light-dark(#fff, #1d2125); color: var(--ink); font-size: 13px; font-weight: 600; text-decoration: none; cursor: pointer; transition: border-color .15s, background .15s; }
    .cpp-btn:hover { border-color: light-dark(#b9dcf0, #2d4c5d); background: light-dark(#f5fbff, #171b1e); }
    .cpp-btn--dark { border-color: #07142b; background: #07142b; color: #fff; }
    .cpp-btn--dark:hover { border-color: #0c86c8; background: #0c86c8; }

    .cpp-status { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px 3px 8px; border-radius: 99px; font-size: 12px; font-weight: 700; background: light-dark(#e8f8f1, #1a352b); color: light-dark(#0b8a5f, #5cc596); }
    .cpp-status i { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
    .cpp-status[data-status='PAUSED'] { background: light-dark(#fff4e0, #3c2b05); color: light-dark(#b45d09, #ef934f); }
    .cpp-status[data-status='ARCHIVED'] { background: light-dark(#eef2f6, #14171b); color: light-dark(#5b6b80, #acb3bb); }

    .cpp__weights { margin: 16px 18px 0; display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid var(--line); border-radius: 14px; background: light-dark(#fff, #1d2125); }
    .cpp__weights div { padding: 12px 10px; display: flex; flex-direction: column; align-items: center; gap: 2px; }
    .cpp__weights div + div { border-left: 1px solid var(--line); }
    .cpp__weights small { color: var(--muted); font-size: 11.5px; }
    .cpp__weights strong { font-size: 15px; font-weight: 700; }
    .cpp__weights .is-now strong { color: var(--brand); }

    .cpp-group { margin: 20px 18px 0; }
    .cpp-group h3 { margin: 0 0 8px 4px; color: light-dark(#8a99ad, #8f959e); font-size: 11px; font-weight: 700; letter-spacing: .6px; text-transform: uppercase; }
    .cpp-card { margin: 0; border: 1px solid var(--line); border-radius: 14px; background: light-dark(#fff, #1d2125); overflow: hidden; }
    .cpp-row { min-height: 52px; padding: 9px 10px 9px 12px; display: grid; grid-template-columns: 30px 128px minmax(0, 1fr) 30px; align-items: center; gap: 10px; }
    .cpp-row + .cpp-row { border-top: 1px solid light-dark(#eef2f6, #32363c); }
    .cpp-row__icon { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 9px; background: light-dark(#eef7fd, #1f313b); color: var(--brand); }
    .cpp-row__icon i-feather { width: 15px; height: 15px; }
    .cpp-row__label { color: var(--muted); font-size: 12.5px; }
    .cpp-row__value { min-width: 0; display: flex; flex-direction: column; font-size: 13.5px; font-weight: 600; overflow-wrap: anywhere; }
    .cpp-row__value a { color: var(--ink); text-decoration: none; }
    .cpp-row__value a:hover { color: var(--brand); text-decoration: underline; }
    .cpp-row__value small { color: var(--muted); font-size: 12px; font-weight: 400; }
    .cpp-row.is-empty .cpp-row__value { color: light-dark(#a3b0c0, #868d94); font-weight: 400; font-style: italic; }
    .cpp-row.is-empty .cpp-row__icon { background: light-dark(#f3f6f9, #15191d); color: light-dark(#a3b0c0, #868d94); }
    .cpp-row__copy { width: 30px; height: 30px; display: grid; place-items: center; border: 0; border-radius: 8px; background: transparent; color: light-dark(#9aa8ba, #899098); cursor: pointer; opacity: 0; transition: opacity .15s, background .15s; }
    .cpp-row:hover .cpp-row__copy, .cpp-row__copy:focus-visible, .cpp-row__copy.is-done { opacity: 1; }
    .cpp-row__copy:hover { background: light-dark(#f1f5f9, #15181d); color: var(--ink); }
    .cpp-row__copy.is-done { color: light-dark(#0b8a5f, #5cc596); }
    .cpp-row__copy i-feather { width: 15px; height: 15px; }
    .cpp-bio { padding: 14px 16px; color: light-dark(#33445c, #ced4dd); font-size: 13.5px; line-height: 1.55; white-space: pre-line; }

    @keyframes cpp-in { from { transform: translateX(32px); opacity: 0; } to { transform: none; opacity: 1; } }
    @keyframes cpp-fade { from { opacity: 0; } to { opacity: 1; } }

    @media (max-width: 620px) {
      .cpp-backdrop { align-items: flex-end; }
      .cpp { width: 100vw; height: 94dvh; border-radius: 20px 20px 0 0; overflow: hidden; animation-name: cpp-up; }
      .cpp-row { grid-template-columns: 30px minmax(0, 1fr) 30px; row-gap: 0; }
      .cpp-row__label { grid-column: 2; grid-row: 1; font-size: 12px; }
      .cpp-row__value { grid-column: 2; grid-row: 2; }
      .cpp-row__icon { grid-row: 1 / 3; }
      .cpp-row__copy { grid-column: 3; grid-row: 1 / 3; opacity: 1; }
      @keyframes cpp-up { from { transform: translateY(40px); opacity: 0; } to { transform: none; opacity: 1; } }
    }
  `],
})
export class ClientProfilePanelComponent {
  @Input() client: any = null;
  @Input() status: ClientHeaderStatus = 'ACTIVE';
  @Input() photo = '';
  @Input() workout: ProgramOverview | null = null;
  @Input() nutrition: ProgramOverview | null = null;
  @Input() startWeight = '--';
  @Input() currentWeight = '--';
  @Input() goalWeight = '--';
  @Input() fr = true;
  @Output() closed = new EventEmitter<void>();
  @Output() message = new EventEmitter<void>();

  photoFailed = false;
  copied = '';

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closed.emit();
  }

  t(fr: string, en: string): string {
    return this.fr ? fr : en;
  }

  get name(): string {
    return `${this.client?.firstName || ''} ${this.client?.lastName || ''}`.trim() || this.email;
  }

  get initials(): string {
    return `${this.client?.firstName?.[0] || ''}${this.client?.lastName?.[0] || ''}`.toUpperCase() || '?';
  }

  get email(): string { return String(this.client?.email || '').trim(); }
  get phone(): string { return String(this.client?.phoneNumber || '').trim(); }
  get bio(): string { return String(this.client?.bio || '').trim(); }

  get statusLabel(): string {
    switch (this.status) {
      case 'PAUSED': return this.t('En pause', 'Paused');
      case 'ARCHIVED': return this.t('Archivé', 'Archived');
      default: return this.t('Actif', 'Active');
    }
  }

  get clientSince(): string {
    const date = this.date(this.client?.createdDate);
    return date ? this.format(date, { month: 'long', year: 'numeric' }) : '';
  }

  get groups(): { title: string; rows: ProfileRow[] }[] {
    const birth = this.date(this.client?.birthDate);
    const age = birth ? this.age(birth) : null;
    return [
      {
        title: this.t('Coordonnées', 'Contact'),
        rows: [
          { icon: 'mail', label: this.t('E-mail', 'Email'), value: this.email, copy: true, href: this.email ? `mailto:${this.email}` : undefined },
          { icon: 'phone', label: this.t('Téléphone', 'Phone'), value: this.phone, copy: true, href: this.phone ? `tel:${this.phone}` : undefined },
        ],
      },
      {
        title: this.t('Informations personnelles', 'Personal details'),
        rows: [
          {
            icon: 'gift',
            label: this.t('Date de naissance', 'Date of birth'),
            value: birth ? this.format(birth, { day: 'numeric', month: 'long', year: 'numeric' }) : '',
            hint: age !== null ? this.t(`${age} ans`, `${age} years old`) : undefined,
          },
          { icon: 'user', label: this.t('Genre', 'Gender'), value: this.gender },
        ],
      },
      {
        title: this.t('Objectifs', 'Goals'),
        rows: [
          { icon: 'target', label: this.t('Objectif principal', 'Main goal'), value: clientObjectiveLabel(this.client?.mainObjective, this.fr) },
        ],
      },
      {
        title: this.t('Suivi', 'Follow-up'),
        rows: [
          { icon: 'activity', label: this.t('Entraînement', 'Training'), value: this.programValue(this.workout), hint: this.programDates(this.workout) },
          { icon: 'coffee', label: this.t('Nutrition', 'Nutrition'), value: this.programValue(this.nutrition), hint: this.programDates(this.nutrition) },
          { icon: 'clock', label: this.t('Dernière activité', 'Last activity'), value: this.lastActivity },
        ],
      },
    ];
  }

  copy(row: ProfileRow): void {
    navigator.clipboard?.writeText(row.value).then(() => {
      this.copied = row.label;
      setTimeout(() => { if (this.copied === row.label) this.copied = ''; }, 1600);
    }).catch(() => {});
  }

  private get gender(): string {
    const gender = String(this.client?.gender || '').toUpperCase();
    if (gender.startsWith('M') || gender === 'HOMME') return this.t('Homme', 'Male');
    if (gender.startsWith('F')) return this.t('Femme', 'Female');
    return '';
  }

  private get lastActivity(): string {
    const value = this.workout?.lastActivity || this.nutrition?.lastActivity;
    const today = this.workout?.today || this.nutrition?.today;
    if (!value || !today) return '';
    const days = Math.round((Date.parse(today) - Date.parse(value)) / 86_400_000);
    if (days <= 0) return this.t("Aujourd'hui", 'Today');
    if (days === 1) return this.t('Hier', 'Yesterday');
    return this.t(`Il y a ${days} jours`, `${days} days ago`);
  }

  private programValue(overview: ProgramOverview | null): string {
    const current = overview?.current;
    if (!current) return '';
    const week = current.weeks > 0 ? this.t(` · Semaine ${current.week} / ${current.weeks}`, ` · Week ${current.week} / ${current.weeks}`) : '';
    return `${current.program.name}${week}`;
  }

  private programDates(overview: ProgramOverview | null): string | undefined {
    const program = overview?.current?.program;
    const start = this.date(program?.startDate);
    if (!program || !start) return undefined;
    const end = this.date(program.endDate);
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    return end ? `${this.format(start, options)} → ${this.format(end, options)}` : this.format(start, options);
  }

  private date(value: unknown): Date | null {
    if (!value) return null;
    const text = String(value);
    // A plain day (yyyy-MM-dd) stays that day whatever the time zone.
    const date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T12:00:00`) : new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private age(birth: Date): number | null {
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
    return age > 0 && age < 120 ? age : null;
  }

  private format(date: Date, options: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat(this.fr ? 'fr-FR' : 'en-US', options).format(date);
  }
}
