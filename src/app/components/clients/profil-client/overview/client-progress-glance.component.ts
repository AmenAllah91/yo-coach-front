import { CommonModule, registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { AfterViewInit, Component, ElementRef, EventEmitter, Input, NgZone, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { BodyMeasurement } from 'app/service/body-measurements.service';
import { CoachSettingsService } from 'app/service/coach-settings.service';
import { DocumentService } from 'app/service/document.service';
import { ProgressPicture, ProgressPicturesService } from 'app/service/progress-pictures.service';
import { cachedClientPictures, loadClientPictures } from 'app/components/progress-pictures-module/progress-pictures/client-pictures-loader';

registerLocaleData(localeFr);

interface ChartPoint { x: number; y: number }
interface WeightChart {
  /** Dashed line of the goal weight, when it fits in the chart. */
  goalY: number | null;
  line: string;
  area: string;
  last: ChartPoint;
  grid: { y: number; label: string }[];
  dates: { x: number; label: string; anchor: 'start' | 'middle' | 'end' }[];
}

/** Chart box (SVG units): the labels sit in the left and bottom margins. */
/** Drawn at the card's real width (pixels), always 120px high: the text keeps its size on any screen. */
const W = 320;
const H = 120;
const LEFT = 30;
const RIGHT = 8;
const TOP = 10;
const BOTTOM = 22;

/**
 * Profile dashboard, right column: the weight (last value, change and curve) and the last progress pictures.
 * The weights come from the profile (already loaded); the pictures are read here, with the Pictures tab's cache.
 */
@Component({
  selector: 'app-client-progress-glance',
  standalone: true,
  imports: [CommonModule],
  styleUrls: ['./overview.scss', './client-progress-glance.component.scss'],
  template: `
    <div class="pg">
      <!-- Weight: last value and change, the curve, then the way to the goal. -->
      <article class="ov-card pg-card" #weightCard>
        <header class="ov-head ov-head--main">
          <span class="ov-tile ov-tile--violet"><i class="fas fa-weight-scale"></i></span>
          <span class="ov-head__titles">
            <h3>{{ t('Weight', 'Poids') }}</h3>
            <small *ngIf="lastDate">{{ t('Last weigh-in', 'Dernière pesée') }} {{ lastDate | date:'d MMM':undefined:locale }}</small>
          </span>
          <button type="button" class="ov-link" (click)="openMeasurements.emit()">{{ t('Details', 'Détails') }} <i class="fas fa-chevron-right"></i></button>
        </header>

        <ng-container *ngIf="current !== null; else noWeight">
          <div class="pg-value">
            <strong>{{ value(current) }}<span>{{ unit }}</span></strong>
            <span *ngIf="change !== null" class="ov-chip" [attr.data-tone]="changeTone">
              <i class="fas" [class.fa-arrow-up]="change > 0" [class.fa-arrow-down]="change < 0" [class.fa-minus]="change === 0"></i>
              {{ changeLabel }}
            </span>
            <small *ngIf="change !== null">{{ t('since', 'depuis le') }} {{ points[0].date | date:'d MMM':undefined:locale }}</small>
          </div>

          <svg *ngIf="chart as c; else fewWeights" class="pg-chart" [attr.viewBox]="'0 0 ' + width + ' ' + height"
               [attr.width]="width" [attr.height]="height" role="img"
               [attr.aria-label]="t('Weight curve', 'Courbe du poids')">
            <defs>
              <linearGradient [attr.id]="gradientId" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#6d4fc9" stop-opacity=".18" />
                <stop offset="100%" stop-color="#6d4fc9" stop-opacity="0" />
              </linearGradient>
            </defs>
            <g class="pg-chart__grid">
              <ng-container *ngFor="let line of c.grid">
                <line [attr.x1]="left" [attr.x2]="width - right" [attr.y1]="line.y" [attr.y2]="line.y" />
                <text [attr.x]="left - 6" [attr.y]="line.y + 3.5" text-anchor="end">{{ line.label }}</text>
              </ng-container>
            </g>
            <line *ngIf="c.goalY !== null" class="pg-chart__goal" [attr.x1]="left" [attr.x2]="width - right" [attr.y1]="c.goalY" [attr.y2]="c.goalY" />
            <path class="pg-chart__area" [attr.d]="c.area" [attr.fill]="'url(#' + gradientId + ')'" />
            <path class="pg-chart__line" [attr.d]="c.line" />
            <circle class="pg-chart__dot" [attr.cx]="c.last.x" [attr.cy]="c.last.y" r="4" />
            <text *ngFor="let date of c.dates" class="pg-chart__date" [attr.x]="date.x" [attr.y]="height - 5" [attr.text-anchor]="date.anchor">{{ date.label }}</text>
          </svg>
          <ng-template #fewWeights>
            <p class="pg-hint">{{ t('The curve appears from the 2nd weigh-in', 'La courbe s’affiche dès la 2e pesée') }}</p>
          </ng-template>

          <!-- Way to the goal: « Objectif 75 kg · encore 12 kg », a bar from the start weight to the goal. -->
          <div class="pg-goal" *ngIf="targetWeight !== null && start !== null; else startOnly">
            <div class="pg-goal__top">
              <span>{{ t('Goal', 'Objectif') }} <strong>{{ value(targetWeight) }} {{ unit }}</strong></span>
              <span class="pg-goal__left" [class.is-done]="goalReached">
                <ng-container *ngIf="goalReached; else leftToGo"><i class="fas fa-check"></i> {{ t('Goal reached', 'Objectif atteint') }}</ng-container>
                <ng-template #leftToGo>{{ t('still', 'encore') }} <strong>{{ value(remaining) }} {{ unit }}</strong></ng-template>
              </span>
            </div>
            <div class="pg-goal__bar" role="progressbar" [attr.aria-valuenow]="goalProgress" aria-valuemin="0" aria-valuemax="100"
                 [attr.aria-label]="t('Progress toward the goal', 'Progression vers l’objectif')">
              <span [style.width.%]="goalProgress"></span>
            </div>
            <div class="pg-goal__ends">
              <span>{{ t('Start', 'Départ') }} {{ value(start) }} {{ unit }}</span>
              <span>{{ goalProgress }} %</span>
            </div>
          </div>
          <ng-template #startOnly>
            <p class="pg-foot" *ngIf="start !== null">
              {{ t('Start', 'Départ') }} <strong>{{ value(start) }} {{ unit }}</strong>
              <span class="pg-foot__hint">· {{ t('no goal set', 'pas d’objectif') }}</span>
            </p>
          </ng-template>
        </ng-container>
        <ng-template #noWeight>
          <div class="pg-empty">
            <i class="fas fa-weight-scale"></i>
            <span>{{ t('No weigh-in yet', 'Aucune pesée pour l’instant') }}</span>
          </div>
        </ng-template>
      </article>

      <!-- Progress pictures: the 4 last photo sessions, then « Compare » (opens the comparison right here). -->
      <article class="ov-card pg-card">
        <header class="ov-head ov-head--main">
          <span class="ov-tile ov-tile--amber"><i class="fas fa-images"></i></span>
          <span class="ov-head__titles">
            <h3>{{ t('Progress pictures', 'Photos de progression') }}</h3>
            <small>{{ photoSummary }}</small>
          </span>
          <button type="button" class="ov-link" (click)="openPictures.emit()">{{ t('View all', 'Tout voir') }} <i class="fas fa-chevron-right"></i></button>
        </header>

        <div class="pg-thumbs" *ngIf="sessions.length; else noPhotos">
          <button *ngFor="let picture of sessions" type="button" class="pg-thumb" (click)="openPictures.emit()"
                  [attr.aria-label]="t('Picture of', 'Photo du') + ' ' + (picture.date | date:'d MMM y':undefined:locale)">
            <img *ngIf="!failed.has(picture.id); else missing" [src]="picture.imageUrl" alt="" loading="lazy" (error)="failed.add(picture.id)" />
            <ng-template #missing><span class="pg-thumb__missing"><i class="far fa-image"></i></span></ng-template>
            <span class="pg-thumb__date">{{ picture.date | date:'d MMM':undefined:locale }}</span>
          </button>
        </div>
        <ng-template #noPhotos>
          <div class="pg-empty">
            <i class="fas fa-images"></i>
            <span>{{ loadingPictures ? t('Loading…', 'Chargement…') : t('No picture yet', 'Aucune photo pour l’instant') }}</span>
          </div>
        </ng-template>

        <button *ngIf="sessionCount > 1" type="button" class="pg-compare" (click)="comparePictures.emit()">
          <i class="fas fa-columns"></i>{{ t('Compare before / after', 'Comparer avant / après') }}
        </button>
      </article>
    </div>
  `,
})
export class ClientProgressGlanceComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() clientId = '';
  @Input() fr = false;
  /** Body weights (kg), oldest first. */
  @Input() weights: BodyMeasurement[] = [];
  /** Goal weight (kg). */
  @Input() targetWeight: number | null = null;

  @Output() openMeasurements = new EventEmitter<void>();
  @Output() openPictures = new EventEmitter<void>();
  @Output() comparePictures = new EventEmitter<void>();

  width = W;
  readonly height = H;
  readonly left = LEFT;
  readonly right = RIGHT;
  readonly gradientId = `pg-grad-${Math.random().toString(36).slice(2, 8)}`;
  readonly failed = new Set<string>();

  points: { date: Date; kg: number }[] = [];
  chart: WeightChart | null = null;
  current: number | null = null;
  start: number | null = null;
  change: number | null = null;
  changeTone: 'good' | 'up' | 'planned' = 'planned';
  changeLabel = '';
  lastDate: Date | null = null;
  /** From the start weight to the goal, 0 to 100. */
  goalProgress = 0;
  goalReached = false;
  /** Kilos left to reach the goal. */
  remaining: number | null = null;

  sessions: ProgressPicture[] = [];
  sessionCount = 0;
  pictureCount = 0;
  loadingPictures = false;
  private picturesSub?: Subscription;
  @ViewChild('weightCard') private weightCard?: ElementRef<HTMLElement>;
  private resize?: ResizeObserver;

  constructor(
    private settings: CoachSettingsService,
    private picturesService: ProgressPicturesService,
    private documents: DocumentService,
    private zone: NgZone,
  ) {}

  /** The curve follows the card's width (the column changes with the screen). */
  ngAfterViewInit(): void {
    // Measured once right away (some browsers deliver the first resize late), then on every resize.
    setTimeout(() => this.fitChart());
    const card = this.weightCard?.nativeElement;
    if (!card || typeof ResizeObserver === 'undefined') return;
    this.resize = new ResizeObserver(() => this.fitChart());
    this.resize.observe(card);
  }

  private fitChart(): void {
    const card = this.weightCard?.nativeElement;
    if (!card) return;
    const inner = Math.round(card.clientWidth - 32);
    if (inner < 180 || Math.abs(inner - this.width) < 4) return;
    this.zone.run(() => {
      this.width = inner;
      this.chart = this.points.length >= 2 ? this.buildChart(this.points) : null;
    });
  }

  get locale(): string {
    return this.fr ? 'fr' : 'en';
  }

  get unit(): string {
    return this.settings.getWeightUnit();
  }

  /** « 4 séances · dernière le 22 oct. » */
  get photoSummary(): string {
    if (!this.sessionCount) return this.loadingPictures ? '…' : this.t('Before / after of the client', 'Avant / après du client');
    const last = this.sessions[0]?.date;
    const count = this.sessionCount === 1
      ? this.t('1 session', '1 séance')
      : `${this.sessionCount} ${this.t('sessions', 'séances')}`;
    if (!last) return count;
    const date = new Intl.DateTimeFormat(this.locale, { day: 'numeric', month: 'short' }).format(new Date(last));
    return `${count} · ${this.t('last on', 'dernière le')} ${date}`;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['weights'] || changes['targetWeight'] || changes['fr']) this.buildWeight();
    if (changes['clientId']) this.loadPictures();
  }

  ngOnDestroy(): void {
    this.picturesSub?.unsubscribe();
    this.resize?.disconnect();
  }

  t(en: string, fr: string): string {
    return this.fr ? fr : en;
  }

  /** A weight in the coach's unit, without the unit (« 65,3 »). */
  value(kg: number | null): string {
    const converted = this.settings.convertWeightFromKg(kg);
    if (converted === null) return '--';
    return new Intl.NumberFormat(this.locale, { maximumFractionDigits: 1 }).format(converted);
  }

  private buildWeight(): void {
    const all = (this.weights || [])
      .map((item) => ({ date: new Date(item.date), kg: Number(item.value) }))
      .filter((item) => Number.isFinite(item.kg) && item.kg > 0 && !Number.isNaN(item.date.getTime()))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    this.start = all.length ? all[0].kg : null;
    this.current = all.length ? all[all.length - 1].kg : null;

    // The last 90 days, or the last 12 weigh-ins when the client weighs rarely.
    const since = Date.now() - 90 * 86_400_000;
    let points = all.filter((item) => item.date.getTime() >= since);
    if (points.length < 2) points = all.slice(-12);
    this.points = points;

    this.lastDate = all.length ? all[all.length - 1].date : null;
    this.buildGoal();

    if (points.length >= 2) {
      const first = points[0].kg;
      const last = points[points.length - 1].kg;
      // In the coach's unit, « +2,4 kg » (easier to read than a percentage).
      const diff = (this.settings.convertWeightFromKg(last) ?? last) - (this.settings.convertWeightFromKg(first) ?? first);
      this.change = Math.round(diff * 10) / 10;
      const sign = this.change > 0 ? '+' : this.change < 0 ? '−' : '';
      this.changeLabel = `${sign}${new Intl.NumberFormat(this.locale, { maximumFractionDigits: 1 }).format(Math.abs(this.change))} ${this.unit}`;
      // Green when the weight moves toward the goal, amber when it moves away; neutral without a goal.
      const goal = this.targetWeight;
      if (goal === null || this.change === 0) this.changeTone = 'planned';
      else this.changeTone = Math.abs(last - goal) < Math.abs(first - goal) ? 'good' : 'up';
    } else {
      this.change = null;
    }

    this.chart = points.length >= 2 ? this.buildChart(points) : null;
  }

  /** Start → goal: « encore 12 kg », the bar filled at 40 %. Moving away from the goal keeps the bar at 0. */
  private buildGoal(): void {
    const start = this.start;
    const current = this.current;
    const goal = this.targetWeight;
    if (start === null || current === null || goal === null) {
      this.goalProgress = 0;
      this.goalReached = false;
      this.remaining = null;
      return;
    }
    this.remaining = Math.abs(current - goal);
    this.goalReached = this.remaining < 0.1 || (start > goal ? current <= goal : start < goal ? current >= goal : true);
    const total = start - goal;
    const done = total === 0 ? 1 : (start - current) / total;
    this.goalProgress = this.goalReached ? 100 : Math.round(Math.min(1, Math.max(0, done)) * 100);
  }

  private buildChart(points: { date: Date; kg: number }[]): WeightChart {
    const values = points.map((point) => this.settings.convertWeightFromKg(point.kg) ?? point.kg);
    let min = Math.min(...values);
    let max = Math.max(...values);
    // At least 2 units of range, rounded to whole numbers, so a flat curve does not look like a big change.
    const pad = Math.max(0.5, (max - min) * 0.15);
    min = Math.max(0, Math.floor(min - pad));
    max = Math.ceil(max + pad);
    if (max - min < 2) max = min + 2;

    const t0 = points[0].date.getTime();
    const t1 = points[points.length - 1].date.getTime();
    const plotW = this.width - LEFT - RIGHT;
    const plotH = H - TOP - BOTTOM;
    const x = (time: number) => LEFT + (t1 === t0 ? plotW / 2 : ((time - t0) / (t1 - t0)) * plotW);
    const y = (value: number) => TOP + (1 - (value - min) / (max - min)) * plotH;

    const coords = points.map((point, index) => ({ x: x(point.date.getTime()), y: y(values[index]) }));
    const line = coords.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
    const bottom = TOP + plotH;
    const area = `${line} L${coords[coords.length - 1].x.toFixed(1)},${bottom} L${coords[0].x.toFixed(1)},${bottom} Z`;

    const format = new Intl.NumberFormat(this.locale, { maximumFractionDigits: 0 });
    const mid = (min + max) / 2;
    const grid = [max, mid, min].map((value) => ({
      y: y(value),
      label: Number.isInteger(value) ? format.format(value) : new Intl.NumberFormat(this.locale, { maximumFractionDigits: 1 }).format(value),
    }));

    const dateFormat = new Intl.DateTimeFormat(this.locale, { day: 'numeric', month: 'short' });
    const middle = new Date((t0 + t1) / 2);
    const dates: WeightChart['dates'] = [
      { x: LEFT, label: dateFormat.format(points[0].date), anchor: 'start' },
      { x: LEFT + plotW / 2, label: dateFormat.format(middle), anchor: 'middle' },
      { x: this.width - RIGHT, label: dateFormat.format(points[points.length - 1].date), anchor: 'end' },
    ];
    if (t1 - t0 < 3 * 86_400_000) dates.splice(1, 1);

    const goal = this.targetWeight === null ? null : this.settings.convertWeightFromKg(this.targetWeight);
    const goalY = goal !== null && goal >= min && goal <= max ? y(goal) : null;

    return { goalY, line, area, last: coords[coords.length - 1], grid, dates };
  }

  private loadPictures(): void {
    this.picturesSub?.unsubscribe();
    this.applyPictures(this.clientId ? cachedClientPictures(this.clientId) || [] : []);
    if (!this.clientId) return;
    const clientId = this.clientId;
    this.loadingPictures = !this.pictureCount;
    this.picturesSub = loadClientPictures(this.picturesService, this.documents, clientId).subscribe({
      next: (pictures) => {
        if (clientId !== this.clientId) return;
        this.applyPictures(pictures);
        this.loadingPictures = false;
      },
      error: (err) => {
        console.error('Dashboard pictures failed:', err);
        this.loadingPictures = false;
      },
    });
  }

  /** One picture per photo session (front pose first), the 4 latest. */
  private applyPictures(pictures: ProgressPicture[]): void {
    this.pictureCount = pictures.length;
    const sessions = new Map<string, ProgressPicture>();
    for (const picture of pictures) {
      const key = picture.groupId || String(picture.date).slice(0, 10);
      const known = sessions.get(key);
      if (!known || (picture.pose === 'FRONT' && known.pose !== 'FRONT')) sessions.set(key, picture);
    }
    this.sessionCount = sessions.size;
    this.sessions = [...sessions.values()]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 4);
  }
}
