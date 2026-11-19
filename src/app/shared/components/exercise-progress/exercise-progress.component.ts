import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { TranslateService } from '@ngx-translate/core';
import { CoachSettingsService } from 'app/service/coach-settings.service';
import { ExerciseHistoryService } from 'app/service/exercise-history.service';
import { ExerciseProgressDetailComponent } from '@shared/components/exercise-progress-detail/exercise-progress-detail.component';
import {
  ExerciseFlag, ExerciseSummary, HistoryWords, exerciseHistoryKey, historyChartPoints, metricText,
} from '@shared/models/exercise-history';

type Period = 'ALL' | '4W' | '3M';
type Sort = 'RECENT' | 'PROGRESS' | 'DOWN' | 'COUNT';

/** Lignes montrées d'un coup dans « Tous les exercices » ; « Voir plus » en ajoute autant. */
const PAGE = 30;
/** « À regarder » reste court : le coach lit tout d'un coup d'œil. */
const MAX_WATCH = 8;
/** Ordre d'importance des alertes. */
const FLAG_ORDER: ExerciseFlag[] = ['DOWN', 'HARD', 'STALLED', 'RECORD'];
/** Un « autre » muscle : exercice écrit à la main, sans lien avec la bibliothèque. */
const NO_MUSCLE = 'NONE';

/**
 * La page Progression d'un client (sous-onglet de « Vue d'ensemble ») : faite pour des centaines d'exercices.
 * À gauche, la liste légère : « À regarder » (alertes), les exercices épinglés, puis tous les exercices avec
 * recherche, filtres, tri et pages. À droite, le détail de l'exercice choisi (chargé à l'ouverture).
 * Sur un petit écran, la liste puis le détail, avec un bouton retour.
 */
@Component({
  selector: 'app-exercise-progress',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, ExerciseProgressDetailComponent],
  templateUrl: './exercise-progress.component.html',
  styleUrl: './exercise-progress.component.scss',
})
export class ExerciseProgressComponent implements OnChanges {
  @Input() clientId: string | null = null;

  loading = false;
  failed = false;
  all: ExerciseSummary[] = [];
  pinnedKeys: string[] = [];
  pinBusy = false;

  search = '';
  muscle = '';
  period: Period = 'ALL';
  sort: Sort = 'RECENT';
  limit = PAGE;

  /** Ce qui est affiché, recalculé à chaque changement (pas à chaque rendu). */
  watch: ExerciseSummary[] = [];
  pinned: ExerciseSummary[] = [];
  list: ExerciseSummary[] = [];
  muscles: { value: string; label: string }[] = [];

  selectedKey: string | null = null;

  constructor(
    private histories: ExerciseHistoryService,
    private coachSettings: CoachSettingsService,
    private translate: TranslateService,
  ) {}

  get fr(): boolean { return this.translate.currentLang !== 'en'; }
  t(en: string, fr: string): string { return this.fr ? fr : en; }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['clientId']) this.load();
  }

  private load(): void {
    this.all = [];
    this.pinnedKeys = [];
    this.selectedKey = null;
    this.failed = false;
    this.refresh();
    if (!this.clientId) return;
    this.loading = true;
    this.histories.summary(this.clientId).subscribe({
      next: data => {
        this.all = data.exercises;
        this.pinnedKeys = data.pinned;
        this.loading = false;
        this.muscles = this.muscleOptions();
        this.refresh();
        if (!this.narrow) this.selectedKey = (this.pinned[0] || this.watch[0] || this.list[0])?.key ?? null;
      },
      error: () => { this.failed = true; this.loading = false; },
    });
  }

  // ---------------------------------------------------------------------------
  // Liste : recherche, filtres, tri, pages
  // ---------------------------------------------------------------------------
  get filtering(): boolean { return !!this.search.trim() || !!this.muscle || this.period !== 'ALL'; }

  onFilter(): void {
    this.limit = PAGE;
    this.refresh();
  }

  refresh(): void {
    const pins = new Set(this.pinnedKeys);
    this.pinned = this.pinnedKeys.map(key => this.all.find(item => item.key === key)).filter((item): item is ExerciseSummary => !!item);
    this.watch = this.all
      .filter(item => item.flags?.length)
      .sort((a, b) => this.flagRank(a) - this.flagRank(b) || b.lastDate.localeCompare(a.lastDate))
      .slice(0, MAX_WATCH);

    const query = exerciseHistoryKey(this.search);
    const since = this.since();
    const found = this.all.filter(item =>
      (!query || item.key.includes(query))
      && (!this.muscle || (this.muscle === NO_MUSCLE ? !item.muscle : item.muscle === this.muscle))
      && (!since || item.lastDate >= since));
    this.list = this.sorted(found);
    // Sans filtre, les épinglés sont déjà en haut : ils ne sont pas répétés.
    if (!this.filtering) this.list = this.list.filter(item => !pins.has(item.key));
  }

  get visible(): ExerciseSummary[] { return this.list.slice(0, this.limit); }
  get remaining(): number { return Math.max(0, this.list.length - this.limit); }
  more(): void { this.limit += PAGE; }

  private since(): string | null {
    if (this.period === 'ALL') return null;
    const date = new Date();
    date.setDate(date.getDate() - (this.period === '4W' ? 28 : 91));
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private sorted(items: ExerciseSummary[]): ExerciseSummary[] {
    const byDate = (a: ExerciseSummary, b: ExerciseSummary) => b.lastDate.localeCompare(a.lastDate);
    switch (this.sort) {
      case 'PROGRESS': return [...items].sort((a, b) => (this.percent(b) ?? -Infinity) - (this.percent(a) ?? -Infinity) || byDate(a, b));
      case 'DOWN': return [...items].sort((a, b) => (this.lastChange(a) ?? Infinity) - (this.lastChange(b) ?? Infinity) || byDate(a, b));
      case 'COUNT': return [...items].sort((a, b) => b.count - a.count || byDate(a, b));
      default: return [...items].sort(byDate);
    }
  }

  /** Progression depuis la première séance, en % (null sans deux valeurs). */
  private percent(item: ExerciseSummary): number | null {
    if (item.firstValue == null || item.lastValue == null || !item.firstValue || item.recent.length < 2) return null;
    return (item.lastValue - item.firstValue) / item.firstValue;
  }

  /** Écart entre les deux dernières séances, en % : les baisses d'abord. */
  private lastChange(item: ExerciseSummary): number | null {
    const values = item.recent;
    if (values.length < 2 || !values[values.length - 2]) return null;
    return (values[values.length - 1] - values[values.length - 2]) / values[values.length - 2];
  }

  private flagRank(item: ExerciseSummary): number {
    return Math.min(...item.flags.map(flag => FLAG_ORDER.indexOf(flag)));
  }

  private muscleOptions(): { value: string; label: string }[] {
    const known = [...new Set(this.all.map(item => item.muscle).filter((muscle): muscle is string => !!muscle))]
      .map(muscle => ({ value: muscle, label: this.muscleLabel(muscle) }))
      .sort((a, b) => a.label.localeCompare(b.label));
    if (known.length && this.all.some(item => !item.muscle)) known.push({ value: NO_MUSCLE, label: this.t('Other (typed by hand)', 'Autre (écrit à la main)') });
    return known;
  }

  muscleLabel(muscle: string | null): string {
    if (!muscle) return '';
    const key = `EXERCISE_MUSCLE_${muscle}`;
    const text = this.translate.instant(key);
    return text && text !== key ? text : muscle;
  }

  // ---------------------------------------------------------------------------
  // Choix et épingles
  // ---------------------------------------------------------------------------
  get narrow(): boolean {
    return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(max-width: 899px)').matches;
  }

  get selected(): ExerciseSummary | null {
    return this.selectedKey ? this.all.find(item => item.key === this.selectedKey) ?? null : null;
  }

  select(item: ExerciseSummary): void {
    this.selectedKey = item.key;
    if (this.narrow && typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  back(): void { this.selectedKey = null; }

  isPinned(item: ExerciseSummary): boolean { return this.pinnedKeys.includes(item.key); }

  togglePin(item: ExerciseSummary): void {
    if (!this.clientId || this.pinBusy) return;
    const before = this.pinnedKeys;
    const next = this.isPinned(item) ? before.filter(key => key !== item.key) : [...before, item.key];
    if (next.length > 12) return;
    this.pinnedKeys = next;
    this.refresh();
    this.pinBusy = true;
    this.histories.pin(this.clientId, next).subscribe({
      next: kept => { this.pinnedKeys = kept; this.pinBusy = false; this.refresh(); },
      error: () => { this.pinnedKeys = before; this.pinBusy = false; this.refresh(); },
    });
  }

  get pinsFull(): boolean { return this.pinnedKeys.length >= 12; }

  // ---------------------------------------------------------------------------
  // Textes d'une ligne
  // ---------------------------------------------------------------------------
  private get words(): HistoryWords {
    return {
      fr: this.fr,
      weight: kg => {
        const value = Math.round((this.coachSettings.convertWeightFromKg(kg) ?? 0) * 10) / 10;
        const text = Number.isInteger(value) ? String(value) : value.toFixed(1);
        return `${this.fr ? text.replace('.', ',') : text} ${this.coachSettings.getWeightUnit()}`;
      },
    };
  }

  value(item: ExerciseSummary): string { return metricText(item.lastValue, item.metric, this.words); }

  /** « +10 kg » depuis la première séance ; null s'il n'y a rien à comparer. */
  delta(item: ExerciseSummary): { text: string; up: boolean; flat: boolean } | null {
    if (item.firstValue == null || item.lastValue == null || item.recent.length < 2) return null;
    const delta = item.lastValue - item.firstValue;
    const text = metricText(Math.abs(delta), item.metric, this.words);
    return { text: delta === 0 ? '=' : `${delta > 0 ? '+' : '−'}${text}`, up: delta > 0, flat: delta === 0 };
  }

  date(day: string): string {
    return new Date(`${day}T00:00:00`).toLocaleDateString(this.fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' });
  }

  meta(item: ExerciseSummary): string {
    const count = `${item.count} ${item.count > 1 ? this.t('workouts', 'séances') : this.t('workout', 'séance')}`;
    return `${count} · ${this.t('last', 'dernière')} ${this.date(item.lastDate)}`;
  }

  flagText(flag: ExerciseFlag): string {
    switch (flag) {
      case 'RECORD': return this.t('New record', 'Nouveau record');
      case 'DOWN': return this.t('Going down', 'En baisse');
      case 'STALLED': return this.t('Stuck for 3 workouts', 'Bloqué depuis 3 séances');
      case 'HARD': return this.t('Hard twice in a row', '« Dur » 2 fois de suite');
    }
  }

  spark(item: ExerciseSummary): string {
    return historyChartPoints(item.recent, 72, 28, 3).map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  }

  trackByKey = (_: number, item: ExerciseSummary) => item.key;
}
