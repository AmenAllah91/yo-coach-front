import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { TranslateService } from '@ngx-translate/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CoachSettingsService } from 'app/service/coach-settings.service';
import { ExerciseHistoryService } from 'app/service/exercise-history.service';
import {
  ExerciseHistory, HistorySession, HistoryWords, historyBest, historyChartPoints, historyDelta,
  metricText, sessionBelowPlan, sessionDoneLine, sessionPlannedLine,
} from '@shared/models/exercise-history';

const CHART_W = 560;
const CHART_H = 150;

/**
 * Tout l'historique d'un exercice pour un client : chiffres clés, courbe datée, et chaque séance (fait, prévu,
 * ressenti, note). Chargé seulement à l'ouverture (page Progression du profil, « Dernière fois » de l'éditeur).
 */
@Component({
  selector: 'app-exercise-progress-detail',
  standalone: true,
  imports: [CommonModule, FeatherModule],
  templateUrl: './exercise-progress-detail.component.html',
  styleUrl: './exercise-progress-detail.component.scss',
})
export class ExerciseProgressDetailComponent implements OnChanges {
  @Input() clientId: string | null = null;
  /** Nom ou clé de l'exercice. */
  @Input() exercise: string | null = null;

  loading = false;
  failed = false;
  notDone = false;
  history: ExerciseHistory | null = null;
  readonly chartW = CHART_W;
  readonly chartH = CHART_H;

  constructor(
    private histories: ExerciseHistoryService,
    private coachSettings: CoachSettingsService,
    private translate: TranslateService,
  ) {}

  get fr(): boolean { return this.translate.currentLang !== 'en'; }
  t(en: string, fr: string): string { return this.fr ? fr : en; }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['clientId'] || changes['exercise']) this.load();
  }

  private load(): void {
    this.history = null;
    this.failed = false;
    this.notDone = false;
    if (!this.clientId || !this.exercise) return;
    this.loading = true;
    const wanted = this.exercise;
    this.histories.one(this.clientId, wanted).subscribe({
      next: history => {
        if (wanted !== this.exercise) return;
        this.history = history;
        this.loading = false;
      },
      error: (error: HttpErrorResponse) => {
        if (wanted !== this.exercise) return;
        this.loading = false;
        if (error?.status === 404) this.notDone = true;
        else this.failed = true;
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Textes
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

  last(history: ExerciseHistory): HistorySession { return history.sessions[history.sessions.length - 1]; }
  value(history: ExerciseHistory, value: number | null): string { return metricText(value, history.metric, this.words); }
  best(history: ExerciseHistory): string { return this.value(history, historyBest(history)); }
  isBest(history: ExerciseHistory, session: HistorySession): boolean {
    return history.sessions.length > 1 && session.value != null && session.value === historyBest(history);
  }

  metricLabel(history: ExerciseHistory): string {
    switch (history.metric) {
      case 'WEIGHT': return this.t('Heaviest set', 'Série la plus lourde');
      case 'SEC': return this.t('Longest hold', 'Temps le plus long');
      case 'MIN': return this.t('Minutes', 'Minutes');
      default: return this.t('Best set', 'Meilleure série');
    }
  }

  /** « +10 kg », « −2 rép. » depuis la première séance ; null s'il n'y a rien à comparer. */
  delta(history: ExerciseHistory): { text: string; up: boolean; flat: boolean } | null {
    const delta = historyDelta(history);
    if (delta == null) return null;
    const text = metricText(Math.abs(delta), history.metric, this.words);
    return { text: `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${text}`, up: delta > 0, flat: delta === 0 };
  }

  date(session: HistorySession, long = false): string {
    const date = new Date(`${session.date}T00:00:00`);
    return date.toLocaleDateString(this.fr ? 'fr-FR' : 'en-US', long
      ? { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }
      : { day: 'numeric', month: 'short' });
  }

  doneLine(history: ExerciseHistory, session: HistorySession): string { return sessionDoneLine(session, history.metric, this.words); }
  plannedLine(history: ExerciseHistory, session: HistorySession): string | null { return sessionPlannedLine(session, history.metric, this.words); }
  below(history: ExerciseHistory, session: HistorySession): boolean { return sessionBelowPlan(session, history.metric); }

  difficulty(session: HistorySession): string | null {
    switch (session.difficulty) {
      case 'EASY': return this.t('Easy', 'Facile');
      case 'GOOD': return this.t('Just right', 'Bien');
      case 'HARD': return this.t('Hard', 'Dur');
      default: return null;
    }
  }

  /** Les séances, la plus récente en premier. */
  recent(history: ExerciseHistory): HistorySession[] { return [...history.sessions].reverse(); }

  // ---------------------------------------------------------------------------
  // Courbe
  // ---------------------------------------------------------------------------
  points(history: ExerciseHistory) {
    return historyChartPoints(history.sessions.map(session => session.value), CHART_W, CHART_H, 16);
  }

  polyline(history: ExerciseHistory): string {
    return this.points(history).map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  }

  /** La première et la dernière date sous la courbe. */
  chartDates(history: ExerciseHistory): { first: string; last: string } | null {
    const points = this.points(history);
    if (points.length < 2) return null;
    return { first: this.date(history.sessions[points[0].index]), last: this.date(history.sessions[points[points.length - 1].index]) };
  }

  pointTitle(history: ExerciseHistory, index: number, value: number): string {
    return `${this.date(history.sessions[index])} : ${this.value(history, value)}`;
  }
}
