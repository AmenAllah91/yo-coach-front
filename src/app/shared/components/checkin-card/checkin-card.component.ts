import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type CheckinCardTone = 'warning' | 'success' | 'danger' | 'info' | 'neutral';

/**
 * One check-in as in the mobile app: a date tile (weekday / day / month, coloured by status), the form or client,
 * one line of details and a status chip. Extra actions can be projected on the right.
 */
@Component({
  selector: 'app-checkin-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ci-card" [attr.data-tone]="tone" [class.ci-card--link]="clickable">
      <div class="ci-tile" aria-hidden="true">
        <span class="ci-tile-small">{{ weekday }}</span>
        <span class="ci-tile-day">{{ day }}</span>
        <span class="ci-tile-small">{{ month }}</span>
      </div>
      <div class="ci-text">
        <span class="ci-title">{{ title }}</span>
        <span class="ci-subtitle" *ngIf="subtitle">{{ subtitle }}</span>
      </div>
      <span class="ci-chip" *ngIf="status">{{ status }}</span>
      <ng-content></ng-content>
      <svg *ngIf="clickable" class="ci-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .ci-card {
      --tone: light-dark(#64748b, #a5abb4); --tone-soft: rgba(100, 116, 139, .1);
      display: flex; align-items: center; gap: 12px; min-width: 0;
      padding: 10px 10px 10px 10px; background: light-dark(#fff, #1d2125); border: 1px solid light-dark(#e5e9f0, #35383d); border-radius: 12px;
      transition: border-color .15s, box-shadow .15s, background .15s;
    }
    .ci-card[data-tone='warning'] { --tone: #c47a12; --tone-soft: rgba(196, 122, 18, .1); }
    .ci-card[data-tone='success'] { --tone: #15803d; --tone-soft: rgba(21, 128, 61, .09); }
    .ci-card[data-tone='danger'] { --tone: #c2412d; --tone-soft: rgba(194, 65, 45, .09); }
    .ci-card[data-tone='info'] { --tone: #1f8fbd; --tone-soft: rgba(31, 143, 189, .1); }
    .ci-card--link { cursor: pointer; }
    .ci-card--link:hover { border-color: light-dark(#cbd5e1, #363e47); box-shadow: 0 3px 10px rgba(15, 23, 42, .05); }
    .ci-tile {
      flex: none; width: 50px; padding: 6px 0; border-radius: 10px; background: var(--tone-soft); color: var(--tone);
      display: flex; flex-direction: column; align-items: center; line-height: 1.15;
    }
    .ci-tile-small { font-size: 10px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; }
    .ci-tile-day { font-size: 19px; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; }
    .ci-text { flex: 1; min-width: 0; display: grid; gap: 2px; }
    .ci-title { font-size: 14px; font-weight: 600; color: light-dark(#0f172a, #e8ecf6); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ci-subtitle { font-size: 12px; color: light-dark(#7d889b, #979ca4); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ci-chip {
      flex: none; padding: 3px 9px; border-radius: 999px; background: var(--tone-soft); color: var(--tone);
      font-size: 11.5px; font-weight: 600; white-space: nowrap;
    }
    .ci-chevron { flex: none; width: 16px; height: 16px; fill: none; stroke: light-dark(#94a3b8, #8c919a); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    @media (max-width: 420px) { .ci-chip { display: none; } }
  `],
})
export class CheckinCardComponent {
  @Input() title = '';
  @Input() subtitle: string | null = null;
  @Input() status: string | null = null;
  @Input() tone: CheckinCardTone = 'neutral';
  @Input() clickable = true;
  /** yyyy-MM-dd or ISO instant. */
  @Input() set date(value: string | Date | null | undefined) {
    const date = value ? new Date(value) : null;
    this.parsed = date && !Number.isNaN(date.getTime()) ? date : null;
    this.format();
  }
  @Input() set lang(value: string | undefined) {
    this.locale = value === 'fr' ? 'fr-FR' : 'en-GB';
    this.format();
  }

  weekday = '--';
  day = '--';
  month = '';

  private parsed: Date | null = null;
  private locale = 'en-GB';

  private format(): void {
    const date = this.parsed;
    if (!date) {
      this.weekday = '--';
      this.day = '--';
      this.month = '';
      return;
    }
    this.weekday = date.toLocaleDateString(this.locale, { weekday: 'short' }).replace('.', '');
    this.day = String(date.getDate()).padStart(2, '0');
    this.month = date.toLocaleDateString(this.locale, { month: 'short' }).replace('.', '');
  }
}
