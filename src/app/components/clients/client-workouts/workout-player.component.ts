import { Component, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { CoachSettingsService } from 'app/service/coach-settings.service';
import { PlayerGroup, PlayerStep, buildPlayerSteps, nextPendingStep, pendingWarmupSteps, playerRestAfter } from 'app/shared/models/workout-player';
import { isWarmupSetType } from 'app/shared/models/exercise-groups';
import { NumberOnlyDirective } from 'app/shared/number-only.directive';
import { capitalizeFirst, exerciseCardImage } from '../shared/client-plan-utils';

type SetStatus = 'PENDING' | 'COMPLETED' | 'MISSED';

/** Une série de la séance : le même objet que dans la page (une valeur saisie ici se voit dans la liste). */
export interface PlayerRunSet {
  setNumber: number; reps: number | null; duration: number | null; durationSec?: number | null; weight: number | null;
  restMin: number | null; restSec: number | null; type: string | null; status: SetStatus;
}

export interface PlayerPlanned { reps: number | null; duration: number | null; durationSec?: number | null; weight: number | null; }

export interface PlayerRun {
  key: string;
  displayLabel: string;
  exercise: any;
  sets: PlayerRunSet[];
  /** Ce que le coach a prévu, série par série. */
  planned: PlayerPlanned[];
  cardio: boolean;
  timed: boolean;
  hasVideo: boolean;
}

export interface PlayerRunGroup extends PlayerGroup { exercises: PlayerRun[]; }

type Phase = 'ready' | 'work' | 'rest' | 'done';
type Count = 'none' | 'start' | 'ready' | 'timed' | 'rest';

const READY_SECONDS = 5;
/** Compte à rebours « Préparez-vous ! » avant la première série de la séance. */
const GET_READY_SECONDS = 10;
/** Durée du « GO » avant la première série. */
const GO_MS = 750;
const RING = 2 * Math.PI * 45;

/**
 * Mode guidé de la séance (même parcours que l'appli mobile) : une série à la fois. Le client règle ce qu'il a fait,
 * glisse pour valider, puis le repos se lance tout seul. Les exercices au temps ont un compte à rebours.
 */
@Component({
  selector: 'app-workout-player',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, NumberOnlyDirective],
  templateUrl: './workout-player.component.html',
  styleUrl: './workout-player.component.scss',
})
export class WorkoutPlayerComponent implements OnInit, OnDestroy {
  @Input() groups: PlayerRunGroup[] = [];
  /** Commencer par ce groupe (bouton du circuit), sinon par la première série pas encore faite. */
  @Input() startGroup: number | null = null;
  @Input() showWeight = true;
  /** Durée de la séance, déjà mise en forme (le chrono reste celui de la page). */
  @Input() time = '';
  @Input() fr = false;
  /** Note de la séance pour le coach (la même que dans la page), écrite sur l'écran de fin. */
  @Input() note = '';
  /** Premier démarrage de la séance : compte à rebours « Préparez-vous ! » avant la première série. */
  @Input() getReady = false;

  @Output() noteChange = new EventEmitter<string>();
  @Output() statusChange = new EventEmitter<{ run: PlayerRun; index: number; status: SetStatus }>();
  @Output() valueChange = new EventEmitter<void>();
  @Output() pausedChange = new EventEmitter<boolean>();
  /** true : le client demande à terminer la séance. */
  @Output() closed = new EventEmitter<boolean>();
  @Output() exercise = new EventEmitter<PlayerRun>();

  steps: PlayerStep[] = [];
  cursor = 0;
  phase: Phase = 'work';
  count: Count = 'none';
  left = 0;
  total = 1;
  restFrom = 0;
  restNext = 0;
  chronoOn = false;
  chrono = 0;
  paused = false;
  /** Fin du compte à rebours de départ : « C'est parti ! » un court instant. */
  go = false;
  private goTimer: ReturnType<typeof setTimeout> | null = null;

  /** Ce que le client voit dans les champs de la série en cours. */
  weightText = '';
  valueText = '';

  /** Bouton à glisser : 0 à gauche, 1 au bout. */
  slide = 0;
  sliding = false;
  slideHint = false;
  private slideStartX = 0;
  private slideTravel = 1;

  private lastWhole = 0;
  private lastTick = Date.now();
  private ticker: ReturnType<typeof setInterval> | null = null;

  constructor(private coachSettings: CoachSettingsService) {}

  t(en: string, fr: string): string { return this.fr ? fr : en; }

  ngOnInit(): void {
    this.steps = buildPlayerSteps(this.groups);
    const inGroup = this.startGroup == null ? -1
      : this.steps.findIndex(step => step.group === this.startGroup && this.setOf(step).status === 'PENDING');
    const start = inGroup >= 0 ? inGroup : this.steps.findIndex(step => this.setOf(step).status === 'PENDING');
    if (start < 0) this.phase = 'done';
    else if (this.getReady) { this.cursor = start; this.phase = 'ready'; this.startCount('start', GET_READY_SECONDS); }
    else this.enterStep(start);
    this.lastTick = Date.now();
    this.ticker = setInterval(() => this.tick(), 200);
  }

  ngOnDestroy(): void {
    if (this.ticker) clearInterval(this.ticker);
    if (this.goTimer) clearTimeout(this.goTimer);
  }

  @HostListener('document:keydown.escape')
  close(): void { this.closed.emit(false); }

  // ---------------------------------------------------------------------------
  // Série en cours
  // ---------------------------------------------------------------------------
  get step(): PlayerStep { return this.steps[this.cursor]; }
  groupOf(step: PlayerStep): PlayerRunGroup { return this.groups[step.group]; }
  runOf(step: PlayerStep): PlayerRun { return this.groups[step.group].exercises[step.exercise]; }
  setOf(step: PlayerStep): PlayerRunSet { return this.runOf(step).sets[step.set]; }
  plannedOf(step: PlayerStep): PlayerPlanned { return this.runOf(step).planned[step.set] || { reps: null, duration: null, weight: null }; }

  get run(): PlayerRun { return this.runOf(this.step); }
  get set(): PlayerRunSet { return this.setOf(this.step); }
  get counting(): boolean { return this.count === 'ready' || this.count === 'timed'; }
  get withWeight(): boolean { return this.showWeight && !this.run.cardio; }
  get weightUnit(): string { return this.coachSettings.getWeightUnit(); }

  /** [placed] : le client sort du compte à rebours de départ, un exercice au temps démarre tout de suite. */
  private enterStep(index: number, placed = false): void {
    this.cursor = index;
    this.phase = 'work';
    this.chronoOn = false;
    this.chrono = 0;
    this.slide = 0;
    const run = this.run;
    const set = this.set;
    const seconds = this.plannedOf(this.step).durationSec ?? 0;
    if (run.timed && seconds > 0 && set.status === 'PENDING') this.startCount(placed ? 'timed' : 'ready', placed ? seconds : READY_SECONDS);
    else this.count = 'none';
    this.weightText = this.displayWeight(set.weight);
    const value = this.amount(run, set);
    this.valueText = value == null ? '' : String(value);
  }

  private startCount(count: Count, seconds: number): void {
    this.count = count;
    this.left = seconds;
    this.total = Math.max(1, seconds);
    this.lastWhole = seconds;
  }

  startNow(): void { this.startCount('timed', this.plannedOf(this.step).durationSec ?? 0); }

  /** Le temps vient de l'horloge : le compte reste juste si l'onglet a été mis de côté. */
  private tick(): void {
    const now = Date.now();
    const delta = (now - this.lastTick) / 1000;
    this.lastTick = now;
    if (this.paused) return;
    if (this.chronoOn) {
      this.chrono += delta;
      const minutes = Math.floor(this.chrono / 60);
      if (minutes >= 1 && this.set.duration !== minutes) {
        this.set.duration = minutes;
        this.valueText = String(minutes);
        this.valueChange.emit();
      }
    }
    if (this.count === 'none') return;
    this.left -= delta;
    this.lastWhole = Math.ceil(this.left);
    if (this.left > 0) return;
    if (this.count === 'start') this.finishGetReady();
    else if (this.count === 'ready') this.startNow();
    else if (this.count === 'timed') { this.set.durationSec = this.plannedOf(this.step).durationSec ?? null; this.complete(); }
    else if (this.count === 'rest') this.enterStep(this.restNext);
  }

  /** Fin du compte à rebours de départ (ou « Passer ») : « GO », puis la première série. */
  finishGetReady(): void {
    if (this.go || this.phase !== 'ready') return;
    this.count = 'none';
    this.left = 0;
    this.go = true;
    this.goTimer = setTimeout(() => { this.goTimer = null; this.enterStep(this.cursor, true); }, GO_MS);
  }

  /** Le chiffre du départ (jamais 0 : à la fin, « GO »). Dans un tableau : un nouveau chiffre relance l'animation. */
  get readyNumber(): number[] { return [Math.max(1, Math.ceil(this.left))]; }
  get readySummary(): string {
    const exercises = this.groups.reduce((sum, group) => sum + group.exercises.length, 0);
    const sets = this.steps.filter(step => this.setOf(step).status === 'PENDING').length;
    return this.fr
      ? `${exercises} exercice${exercises > 1 ? 's' : ''} · ${sets} série${sets > 1 ? 's' : ''}`
      : `${exercises} exercise${exercises > 1 ? 's' : ''} · ${sets} set${sets > 1 ? 's' : ''}`;
  }

  /** Série validée : elle est marquée faite, puis le repos (s'il y en a un) et la série suivante. */
  complete(): void {
    if (this.phase !== 'work') return;
    const step = this.step;
    const run = this.run;
    const set = this.set;
    // Arrêt avant la fin : on garde le temps vraiment tenu.
    if (this.count === 'timed' && this.left > 0) set.durationSec = Math.max(1, Math.round(this.total - this.left));
    this.carryWeight(step, set);
    set.status = 'COMPLETED';
    this.statusChange.emit({ run, index: step.set, status: 'COMPLETED' });
    this.advance(true);
  }

  skip(): void {
    const step = this.step;
    this.set.status = 'MISSED';
    this.statusChange.emit({ run: this.run, index: step.set, status: 'MISSED' });
    this.advance(false);
  }

  /** La série en cours fait partie de l'échauffement du haut de la séance. */
  get inWarmup(): boolean { return this.phase === 'work' && !!this.groupOf(this.step).warmup; }

  /** « Passer l'échauffement » : toutes ses séries pas encore faites sont passées, on va à la première série de la séance. */
  skipWarmup(): void {
    pendingWarmupSteps(this.groups, this.steps).forEach(step => {
      this.setOf(step).status = 'MISSED';
      this.statusChange.emit({ run: this.runOf(step), index: step.set, status: 'MISSED' });
    });
    this.advance(false);
  }

  previous(): void { if (this.cursor > 0) this.enterStep(this.cursor - 1); }
  skipRest(): void { this.enterStep(this.restNext); }
  addRest(seconds: number): void {
    this.left = Math.max(1, this.left + seconds);
    this.total = Math.max(this.total, this.left);
  }

  /** Le client a changé le poids : la série suivante du même exercice part du même poids (si le coach avait prévu
   *  le même et que le client n'y a pas encore touché). */
  private carryWeight(step: PlayerStep, set: PlayerRunSet): void {
    const run = this.runOf(step);
    const planned = run.planned[step.set]?.weight ?? null;
    const next = run.sets[step.set + 1];
    const nextPlanned = run.planned[step.set + 1]?.weight ?? null;
    if (!next || set.weight == null || set.weight === planned) return;
    if (next.status !== 'PENDING' || next.weight !== nextPlanned || nextPlanned !== planned) return;
    next.weight = set.weight;
  }

  private advance(withRest: boolean): void {
    const from = this.cursor;
    const next = nextPendingStep(this.groups, this.steps, from);
    this.chronoOn = false;
    this.slide = 0;
    if (next == null) { this.phase = 'done'; this.count = 'none'; return; }
    const rest = withRest ? playerRestAfter(this.groups, this.steps[from], this.steps[next]) : 0;
    if (rest > 0) {
      this.phase = 'rest';
      this.restFrom = from;
      this.restNext = next;
      this.startCount('rest', rest);
    } else {
      this.enterStep(next);
    }
  }

  togglePause(): void {
    this.paused = !this.paused;
    this.pausedChange.emit(this.paused);
  }

  // ---------------------------------------------------------------------------
  // Valeurs
  // ---------------------------------------------------------------------------
  private amount(run: PlayerRun, set: PlayerRunSet): number | null {
    return (run.timed ? set.durationSec : run.cardio ? set.duration : set.reps) ?? null;
  }

  private writeAmount(value: number | null): void {
    if (this.run.timed) this.set.durationSec = value;
    else if (this.run.cardio) this.set.duration = value;
    else this.set.reps = value;
    this.valueChange.emit();
  }

  onValueInput(text: string): void {
    const n = parseInt(String(text), 10);
    this.writeAmount(Number.isFinite(n) && n >= 0 ? n : null);
  }

  bumpValue(direction: number): void {
    const plannedSet = this.plannedOf(this.step);
    const planned = this.run.timed ? plannedSet.durationSec : this.run.cardio ? plannedSet.duration : plannedSet.reps;
    const next = Math.max(0, (this.amount(this.run, this.set) ?? planned ?? 0) + direction * (this.run.timed ? 5 : 1));
    this.valueText = String(next);
    this.writeAmount(next);
  }

  onWeightInput(text: string): void {
    const entered = parseFloat(String(text).replace(',', '.'));
    this.set.weight = Number.isFinite(entered) && entered > 0 ? this.coachSettings.convertWeightToKg(entered) : null;
    this.valueChange.emit();
  }

  /** Pas d'une barre : 2,5 kg ou 5 lb. */
  bumpWeight(direction: number): void {
    const step = this.weightUnit === 'lbs' ? 5 : 2.5;
    const kg = this.set.weight ?? this.plannedOf(this.step).weight ?? 0;
    const shown = Math.round((this.coachSettings.convertWeightFromKg(kg) ?? 0) * 10) / 10;
    const next = Math.max(0, shown + direction * step);
    this.set.weight = next > 0 ? this.coachSettings.convertWeightToKg(next) : null;
    this.weightText = this.displayWeight(this.set.weight);
    this.valueChange.emit();
  }

  displayWeight(kg: number | null): string {
    if (kg == null) return '';
    const value = this.coachSettings.convertWeightFromKg(kg);
    if (value == null) return '';
    const rounded = Math.round(value * 10) / 10;
    const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    return this.fr ? text.replace('.', ',') : text;
  }

  get weightChanged(): boolean { return this.set.weight != null && this.set.weight !== this.plannedOf(this.step).weight; }
  get valueChanged(): boolean {
    const planned = this.plannedOf(this.step);
    const value = this.amount(this.run, this.set);
    return value != null && value !== (this.run.timed ? planned.durationSec : this.run.cardio ? planned.duration : planned.reps);
  }

  // ---------------------------------------------------------------------------
  // Textes
  // ---------------------------------------------------------------------------
  clock(seconds: number): string {
    const value = Math.max(0, Math.floor(seconds));
    const h = Math.floor(value / 3600);
    const m = Math.floor((value % 3600) / 60);
    const s = value % 60;
    return (h > 0 ? [h, m, s] : [m, s]).map((part, index) => (index === 0 && h > 0 ? String(part) : String(part).padStart(2, '0'))).join(':');
  }

  get leftWhole(): number { return Math.max(0, Math.ceil(this.left)); }
  get ringOffset(): number { return RING * (1 - Math.min(1, Math.max(0, this.left / this.total))); }
  readonly ringLength = RING;

  name(run: PlayerRun): string { return capitalizeFirst(run.exercise?.name || run.exercise?.exerciseRef?.name || this.t('Exercise', 'Exercice')); }
  image(run: PlayerRun): string | null { return exerciseCardImage(run.exercise); }

  private line(run: PlayerRun, value: PlayerPlanned): string {
    if (run.timed) return value.durationSec != null ? `${value.durationSec} s` : '— s';
    if (run.cardio) return value.duration != null ? `${value.duration} min` : '— min';
    const parts = [value.reps != null ? `${value.reps} ${this.t('reps', 'rép.')}` : `— ${this.t('reps', 'rép.')}`];
    if (this.showWeight && value.weight != null) parts.push(`${this.displayWeight(value.weight)} ${this.weightUnit}`);
    return parts.join(' · ');
  }

  plannedLine(step: PlayerStep): string { return this.line(this.runOf(step), this.plannedOf(step)); }
  doneLine(step: PlayerStep): string { return this.line(this.runOf(step), this.setOf(step)); }

  /** La série d'avant du même exercice, si elle est faite. */
  get previousLine(): string | null {
    const step = this.step;
    if (step.set === 0 || this.run.sets[step.set - 1].status !== 'COMPLETED') return null;
    return this.doneLine({ ...step, set: step.set - 1 });
  }

  /** « Série 2 sur 4 », ou « Tour 2 sur 3 » dans un superset ou un circuit. */
  setTitle(step: PlayerStep, short = false): string {
    const total = this.runOf(step).sets.length;
    const word = this.groupOf(step).grouped ? this.t('Round', 'Tour') : this.t('Set', 'Série');
    return short ? `${word} ${step.set + 1}/${total}` : `${word} ${step.set + 1} ${this.t('of', 'sur')} ${total}`;
  }

  groupChip(step: PlayerStep): string {
    const group = this.groupOf(step);
    if (group.warmup) return this.t('WARM-UP', 'ÉCHAUFFEMENT');
    if (group.grouped) return `${group.circuit ? 'CIRCUIT' : 'SUPERSET'} · ${this.runOf(step).displayLabel}`;
    return `${this.t('EXERCISE', 'EXERCICE')} ${step.group + 1}/${this.groups.length}`;
  }

  // Superset ou circuit : la liste de tous les exercices du tour, pour savoir quoi faire après.
  roundSet(exercise: number): PlayerRunSet | null { return this.groupOf(this.step).exercises[exercise].sets[this.step.set] ?? null; }
  roundPlanned(exercise: number): string {
    return this.roundSet(exercise) ? this.plannedLine({ group: this.step.group, exercise, set: this.step.set }) : this.t('Not in this round', 'Pas dans ce tour');
  }

  get roundTitle(): string {
    return `${this.groupOf(this.step).circuit ? 'CIRCUIT' : 'SUPERSET'} · ${this.setTitle(this.step).toUpperCase()}`;
  }

  /** Repos à la fin du tour (0 = aucun). */
  get roundRest(): number {
    const group = this.groupOf(this.step);
    const set = group.exercises[group.exercises.length - 1].sets[this.step.set] ?? this.set;
    const own = (Number(set.restMin) || 0) * 60 + (Number(set.restSec) || 0);
    return group.restSec ?? (own > 0 ? own : group.circuit ? 60 : 0);
  }

  get roundRestLine(): string {
    const rest = this.roundRest;
    const chain = this.t('No rest between exercises', 'Pas de repos entre les exercices');
    return rest > 0 ? `${chain} · ${this.t(`${rest} s rest after the round`, `repos ${rest} s à la fin du tour`)}` : chain;
  }

  typeLabel(set: PlayerRunSet): string | null {
    switch (String(set.type || '').toUpperCase()) {
      case 'WARM_UP': return this.t('Warm-up', 'Échauffement');
      case 'DROP_SET': return 'Drop set';
      case 'FAILURE': return this.t('To failure', 'Jusqu’à l’échec');
      default: return null;
    }
  }

  dotLetter(set: PlayerRunSet, index: number): string {
    return ({ WARM_UP: 'W', DROP_SET: 'D', FAILURE: 'F' } as Record<string, string>)[String(set.type || '').toUpperCase()] ?? String(index + 1);
  }

  get valueLabel(): string {
    return this.run.timed ? this.t('SECONDS', 'SECONDES') : this.run.cardio ? 'MINUTES' : this.t('REPS', 'RÉPÉTITIONS');
  }

  get slideLabel(): string {
    return this.count === 'timed' ? this.t('Slide to stop', 'Glisser pour arrêter')
      : this.set.status === 'COMPLETED' ? this.t('Slide to update', 'Glisser pour corriger')
      : this.t('Slide to log', 'Glisser pour valider');
  }

  get nextHint(): string {
    const next = nextPendingStep(this.groups, this.steps, this.cursor);
    if (next == null) return this.t('Last set of the workout', 'Dernière série de la séance');
    const rest = playerRestAfter(this.groups, this.step, this.steps[next]);
    const name = this.name(this.runOf(this.steps[next]));
    const same = this.steps[next].group === this.step.group && this.steps[next].exercise === this.step.exercise;
    if (rest === 0) return this.t(`Next, no rest: ${name}`, `Ensuite, sans repos : ${name}`);
    return same ? this.t(`Next: ${rest} s rest`, `Ensuite : repos ${rest} s`)
      : this.t(`Next: ${rest} s rest, then ${name}`, `Ensuite : repos ${rest} s, puis ${name}`);
  }

  get treated(): number { return this.steps.filter(step => this.setOf(step).status !== 'PENDING').length; }
  get doneCount(): number { return this.steps.filter(step => this.setOf(step).status === 'COMPLETED').length; }

  /** Barre du haut : une part par exercice (ou par groupe), remplie selon ses séries passées. */
  get segments(): { weight: number; fill: number }[] {
    return this.groups.map((_, g) => {
      const steps = this.steps.filter(step => step.group === g);
      return { weight: steps.length, fill: steps.length ? steps.filter(step => this.setOf(step).status !== 'PENDING').length / steps.length : 0 };
    }).filter(segment => segment.weight > 0);
  }

  get restHeadline(): string {
    const done = this.steps[this.restFrom];
    const next = this.steps[this.restNext];
    const group = this.groupOf(done);
    if (next.group !== done.group) {
      return group.circuit ? this.t('Circuit done', 'Circuit terminé') : group.grouped ? this.t('Superset done', 'Superset terminé')
        : this.t('Exercise done', 'Exercice terminé');
    }
    return group.grouped ? this.t(`Round ${done.set + 1} done`, `Tour ${done.set + 1} terminé`)
      : this.t(`Set ${done.set + 1} logged`, `Série ${done.set + 1} validée`);
  }

  get restMessage(): string {
    const remaining = this.steps.length - this.treated;
    const half = this.treated * 2 >= this.steps.length && (this.treated - 1) * 2 < this.steps.length;
    const message = half ? this.t('You are halfway through.', 'Vous avez fait la moitié de la séance.')
      : remaining === 1 ? this.t('Only one set left.', 'Plus qu’une série.')
      : this.t(`${remaining} sets to go. Breathe.`, `Encore ${remaining} séries. Respirez.`);
    const done = this.steps[this.restFrom];
    return this.setOf(done).status === 'COMPLETED' ? `${this.doneLine(done)}  ·  ${message}` : message;
  }

  /** Le résumé de fin ne compte pas les séries d'échauffement (sauf si la séance n'a que ça). */
  private get countedSteps(): PlayerStep[] {
    const regular = this.steps.filter(step => !isWarmupSetType(this.setOf(step).type));
    return regular.length ? regular : this.steps;
  }

  get doneSummary(): string {
    const counted = this.countedSteps;
    const done = counted.filter(step => this.setOf(step).status === 'COMPLETED').length;
    const skipped = counted.length - done;
    const parts = [this.t(`${done} of ${counted.length} sets done`, `${done} série${done > 1 ? 's' : ''} faite${done > 1 ? 's' : ''} sur ${counted.length}`)];
    if (skipped > 0) parts.push(this.t(`${skipped} skipped`, `${skipped} passée${skipped > 1 ? 's' : ''}`));
    if (this.time) parts.push(this.time);
    return parts.join('  ·  ');
  }

  // ---------------------------------------------------------------------------
  // Bouton à glisser (souris, doigt ou clavier)
  // ---------------------------------------------------------------------------
  slideStart(event: PointerEvent): void {
    const track = event.currentTarget as HTMLElement;
    this.slideTravel = Math.max(1, track.getBoundingClientRect().width - 60);
    this.slideStartX = event.clientX;
    this.sliding = true;
    this.slide = 0;
    track.setPointerCapture?.(event.pointerId);
  }

  slideMove(event: PointerEvent): void {
    if (!this.sliding) return;
    this.slide = Math.min(1, Math.max(0, (event.clientX - this.slideStartX) / this.slideTravel));
  }

  slideEnd(): void {
    if (!this.sliding) return;
    this.sliding = false;
    if (this.slide > 0.72) { this.complete(); return; }
    // Un simple appui : on montre le geste.
    if (this.slide < 0.03) {
      this.slideHint = true;
      setTimeout(() => (this.slideHint = false), 450);
    }
    this.slide = 0;
  }
}
