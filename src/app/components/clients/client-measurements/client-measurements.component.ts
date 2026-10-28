import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { FeatherModule } from 'angular-feather';
import { TranslateService } from '@ngx-translate/core';
import { Subscription, catchError, of } from 'rxjs';
import { BodyMeasurement, BodyMeasurementsService } from 'app/service/body-measurements.service';
import { CoachSettingsService } from 'app/service/coach-settings.service';
import { ClientThemeService } from 'app/core/service/client-theme.service';
import { MANUAL_MEASUREMENT_TYPES, MEASUREMENT_TYPES, MeasurementTypeItem } from 'app/models/measurement-type.model';
import { dateKey, planDate } from '../shared/client-plan-utils';

const KG_TO_LBS = 2.2046226218;
const HISTORY_PAGE = 5;

/** Names of the mobile app (localizedMeasurementType). */
const TYPE_NAMES: Record<string, [string, string]> = {
  BODYWEIGHT: ['Body Weight', 'Poids corporel'], BMI: ['BMI', 'IMC'], BODY_FAT_INDEX: ['Body Fat %', 'Masse grasse %'],
  WAIST: ['Waist', 'Tour de taille'], CHEST: ['Chest', 'Tour de poitrine'], SHOULDERS: ['Shoulders', 'Épaules'],
  BICEPS_RIGHT: ['Biceps (R)', 'Biceps (D)'], BICEPS_LEFT: ['Biceps (L)', 'Biceps (G)'],
  QUADRICEPS_RIGHT: ['Quadriceps (R)', 'Quadriceps (D)'], QUADRICEPS_LEFT: ['Quadriceps (L)', 'Quadriceps (G)'], NECK: ['Neck', 'Cou'],
};

interface Point { left: number; top: number; last: boolean; }

/**
 * Client body measurements, same content and logic as the mobile BodyMeasurementsScreen and its add sheet:
 * measurement picker, "requested by your coach" banner (from a task), latest value with its change and the
 * chart, history with the change between records, and the add sheet.
 */
@Component({
  selector: 'app-client-measurements',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule],
  templateUrl: './client-measurements.component.html',
  styleUrl: './client-measurements.component.scss',
})
export class ClientMeasurementsComponent implements OnInit, OnDestroy {
  measurements: BodyMeasurement[] = [];
  loading = true;
  error = '';
  selectedType = 'BODYWEIGHT';
  historyLimit = HISTORY_PAGE;
  targetWeight: number | null = null;
  requested: string[] = [];
  taskDate: string | null = null;
  showPicker = false;
  toast = '';

  // Add sheet
  showAdd = false;
  addAllowed: MeasurementTypeItem[] = [];
  addType = 'BODYWEIGHT';
  addValue = '';
  addDate = dateKey(new Date());
  addNote = '';
  lockDate = false;
  saving = false;

  private clientId = sessionStorage.getItem('userId') || '';
  private subscriptions = new Subscription();
  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private api: BodyMeasurementsService,
    private settings: CoachSettingsService,
    private translate: TranslateService,
    private route: ActivatedRoute,
    private theme: ClientThemeService,
  ) {}

  get fr(): boolean { return this.translate.currentLang?.startsWith('fr') ?? false; }
  private get locale(): string { return this.fr ? 'fr-FR' : 'en-US'; }
  t(en: string, fr: string): string { return this.fr ? fr : en; }

  readonly types = MEASUREMENT_TYPES;

  ngOnInit(): void {
    this.theme.ensureLoaded();
    this.subscriptions.add(this.settings.loadConfig(true).subscribe({ error: () => undefined }));
    const params = this.route.snapshot.queryParamMap;
    this.clientId = params.get('clientId') || this.clientId;
    this.requested = (params.get('measurements') || '').split(',').map(value => value.trim()).filter(Boolean);
    this.taskDate = params.get('taskDate');
    if (this.requested.length) this.selectedType = this.requested[0];
    this.load(true);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  private load(openAddFlow = false): void {
    if (!this.clientId) { this.loading = false; this.error = this.t('Something went wrong', 'Une erreur est survenue'); return; }
    this.loading = !this.measurements.length;
    this.subscriptions.add(this.api.getByClient(this.clientId, true).subscribe({
      next: list => {
        this.measurements = list || [];
        this.loading = false;
        this.historyLimit = HISTORY_PAGE;
        if (openAddFlow && this.taskDate) this.openAdd();
      },
      error: err => { this.loading = false; this.error = err?.message || this.t('Something went wrong', 'Une erreur est survenue'); },
    }));
    this.subscriptions.add(this.api.getClientProfile(this.clientId, true).pipe(catchError(() => of(null))).subscribe(profile => {
      const target = Number((profile as any)?.targetWeight ?? (profile as any)?.goal_weight);
      this.targetWeight = Number.isFinite(target) && target > 0 ? target : null;
    }));
  }

  // -------------------------------------------------------------------------
  // Units (mobile measurement_units.dart)
  // -------------------------------------------------------------------------
  get weightUnit(): string { return this.settings.getWeightUnit(); }
  get lengthUnit(): string { return this.settings.getMeasurementUnit(); }

  typeName(key: string): string { const names = TYPE_NAMES[key]; return names ? this.t(names[0], names[1]) : key; }
  private typeItem(key: string): MeasurementTypeItem | undefined { return MEASUREMENT_TYPES.find(type => type.key === key); }
  private isLength(key: string): boolean { return this.typeItem(key)?.unit === 'cm'; }

  unitFor(key: string): string {
    if (key === 'BODYWEIGHT') return this.weightUnit;
    if (this.isLength(key)) return this.lengthUnit;
    return this.typeItem(key)?.unit || '';
  }

  displayValue(measurement: BodyMeasurement): number {
    let value = Number(measurement.value) || 0;
    const unit = String(measurement.unit || '').toLowerCase();
    if (measurement.measurementType === 'BODYWEIGHT') {
      if (unit !== 'lb' && unit !== 'lbs' && this.weightUnit === 'lbs') value *= KG_TO_LBS;
      if ((unit === 'lb' || unit === 'lbs') && this.weightUnit === 'kg') value /= KG_TO_LBS;
    } else if (unit === 'cm' || unit === 'in' || (!unit && this.isLength(measurement.measurementType))) {
      if (unit !== 'in' && this.lengthUnit === 'in') value /= 2.54;
      if (unit === 'in' && this.lengthUnit === 'cm') value *= 2.54;
    }
    return value;
  }

  private storageValue(key: string, value: number): number {
    if (key === 'BODYWEIGHT' && this.weightUnit === 'lbs') return value / KG_TO_LBS;
    if (this.isLength(key) && this.lengthUnit === 'in') return value * 2.54;
    return value;
  }

  format(value: number): string {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }

  private dateOf(measurement: BodyMeasurement): Date { return planDate(measurement.date) || new Date(0); }
  shortDate(measurement: BodyMeasurement): string {
    return new Intl.DateTimeFormat(this.locale, { weekday: 'short', month: 'short', day: 'numeric' }).format(this.dateOf(measurement));
  }
  private monthDay(date: Date): string { return new Intl.DateTimeFormat(this.locale, { month: 'short', day: 'numeric' }).format(date); }

  // -------------------------------------------------------------------------
  // Selected type
  // -------------------------------------------------------------------------
  /** Newest first. */
  get selected(): BodyMeasurement[] {
    return this.measurements.filter(item => item.measurementType === this.selectedType)
      .sort((a, b) => this.dateOf(b).getTime() - this.dateOf(a).getTime());
  }
  get selectedAsc(): BodyMeasurement[] { return [...this.selected].reverse(); }
  get visibleHistory(): BodyMeasurement[] { return this.selected.slice(0, this.historyLimit); }
  get hasMoreHistory(): boolean { return this.historyLimit < this.selected.length; }
  showAllHistory(): void { this.historyLimit = this.selected.length; }

  latestOf(key: string): BodyMeasurement | null {
    return this.measurements.filter(item => item.measurementType === key)
      .sort((a, b) => this.dateOf(b).getTime() - this.dateOf(a).getTime())[0] || null;
  }

  get latestRecordLine(): string {
    const latest = this.selected[0];
    if (!latest) return this.t('No record yet', 'Aucun enregistrement');
    return `${this.t('Latest record', 'Dernier relevé')} ${this.shortDate(latest)}`;
  }

  pick(key: string): void { this.selectedType = key; this.historyLimit = HISTORY_PAGE; this.showPicker = false; }
  isRequested(key: string): boolean { return this.requested.includes(key); }
  get requestedNames(): string { return this.requested.map(key => this.typeName(key)).join(' · '); }

  // Latest card + chart
  get unit(): string { return this.unitFor(this.selectedType); }
  get values(): number[] { return this.selectedAsc.map(item => this.displayValue(item)); }
  get latestValue(): number | null { const v = this.values; return v.length ? v[v.length - 1] : null; }

  get change(): number | null {
    const v = this.values;
    return v.length > 1 ? v[v.length - 1] - v[0] : null;
  }
  get changeLabel(): string {
    const change = this.change;
    if (change == null) return '';
    const first = this.selectedAsc[0];
    return `${change < 0 ? '−' : '+'}${this.format(Math.abs(change))} ${this.unit} ${this.t('since', 'depuis le')} ${this.monthDay(this.dateOf(first))}`;
  }

  get goal(): number | null {
    if (this.selectedType !== 'BODYWEIGHT' || this.targetWeight == null) return null;
    return this.weightUnit === 'lbs' ? this.targetWeight * KG_TO_LBS : this.targetWeight;
  }

  private get bounds(): [number, number] {
    const values = [...this.values];
    if (this.goal != null) values.push(this.goal);
    if (!values.length) return [0, 1];
    const min = Math.min(...values); const max = Math.max(...values);
    const pad = (max - min) * 0.12;
    return [min - pad, max + pad];
  }

  private y(value: number): number {
    const [min, max] = this.bounds;
    return max - min === 0 ? 50 : (1 - (value - min) / (max - min)) * 100;
  }

  private x(index: number, count: number): number { return count <= 1 ? 50 : (index / (count - 1)) * 100; }

  get points(): Point[] {
    const values = this.values;
    return values.map((value, i) => ({ left: this.x(i, values.length), top: this.y(value), last: i === values.length - 1 }));
  }
  get linePath(): string { return this.points.map((p, i) => `${i ? 'L' : 'M'}${p.left},${p.top}`).join(' '); }
  get areaPath(): string {
    const points = this.points;
    if (!points.length) return '';
    return `${this.linePath} L${points[points.length - 1].left},100 L${points[0].left},100 Z`;
  }
  get goalTop(): number | null { return this.goal == null ? null : this.y(this.goal); }
  get yLabels(): string[] {
    const [min, max] = this.bounds;
    const format = (v: number) => Number.isInteger(v) ? String(v) : v.toFixed(1);
    return max - min === 0 ? [format(max), format(min)] : [format(max), format(max - (max - min) / 2), format(min)];
  }
  get xLabels(): string[] {
    const asc = this.selectedAsc;
    if (!asc.length) return [];
    const first = this.monthDay(this.dateOf(asc[0]));
    return asc.length > 1 ? [first, this.monthDay(this.dateOf(asc[asc.length - 1]))] : [first];
  }

  /** Change from the previous (older) record, in the display unit. */
  delta(index: number): number | null {
    const all = this.selected;
    const previous = all[index + 1];
    return previous ? this.displayValue(all[index]) - this.displayValue(previous) : null;
  }
  deltaLabel(delta: number | null): string {
    if (delta == null) return '';
    if (delta === 0) return '0';
    return `${delta < 0 ? '−' : '+'}${this.format(Math.abs(delta))}`;
  }

  // -------------------------------------------------------------------------
  // Add sheet (mobile showAddMeasurementSheet)
  // -------------------------------------------------------------------------
  openAdd(): void {
    const fromTask = !!this.taskDate && this.requested.length > 0;
    const allowed = fromTask ? MANUAL_MEASUREMENT_TYPES.filter(type => this.requested.includes(type.key)) : MEASUREMENT_TYPES;
    if (!allowed.length) return;
    this.addAllowed = allowed;
    this.addType = allowed.some(type => type.key === this.selectedType) ? this.selectedType : allowed[0].key;
    this.addValue = '';
    this.addNote = '';
    this.lockDate = !!this.taskDate;
    this.addDate = this.taskDate && /^\d{4}-\d{2}-\d{2}$/.test(this.taskDate) ? this.taskDate : dateKey(new Date());
    this.showAdd = true;
  }

  get showTypeSelector(): boolean { return !!this.taskDate && this.requested.length > 0 && this.addAllowed.length > 1; }
  get addTitle(): string {
    if (this.showTypeSelector) return this.t('Add Measurement', 'Ajouter une mesure');
    const name = this.typeName(this.addType);
    return this.fr ? `Ajouter : ${name}` : `Add ${name.toLowerCase()}`;
  }
  get addSubtitle(): string {
    const last = this.latestOf(this.addType);
    if (!last) return this.t('No record yet', 'Aucun enregistrement pour le moment');
    const value = `${this.format(this.displayValue(last))} ${this.unitFor(this.addType)}`;
    const date = this.monthDay(this.dateOf(last));
    return this.fr ? `Dernier : ${value} le ${date}` : `Last record: ${value} on ${date}`;
  }
  get addPlaceholder(): string { const last = this.latestOf(this.addType); return last ? this.format(this.displayValue(last)) : '0'; }
  get today(): string { return dateKey(new Date()); }

  private get storedValue(): number | null {
    const parsed = parseFloat(this.addValue.trim().replace(',', '.'));
    return Number.isFinite(parsed) ? this.storageValue(this.addType, parsed) : null;
  }

  get valueError(): string {
    if (!this.addValue.trim()) return '';
    const stored = this.storedValue;
    if (stored == null) return this.t('Enter a valid number.', 'Saisissez un nombre valide.');
    const type = this.typeItem(this.addType);
    if (stored <= 0 || (type && (stored < type.min || stored > type.max))) return this.t('Value out of range.', 'Valeur hors limites.');
    return '';
  }
  get noteError(): string { return this.addNote.length > 500 ? this.t('Note must not exceed 500 characters.', 'La note ne doit pas dépasser 500 caractères.') : ''; }
  get canSave(): boolean { return !this.saving && this.storedValue != null && !this.valueError && !this.noteError && !!this.addDate; }

  save(): void {
    const value = this.storedValue;
    if (!this.canSave || value == null) return;
    this.saving = true;
    const type = this.typeItem(this.addType);
    this.subscriptions.add(this.api.create({
      clientId: this.clientId, measurementType: this.addType, value: Math.round(value * 100) / 100,
      unit: type?.unit || '', date: this.addDate, note: this.addNote.trim(),
    }).subscribe({
      next: created => {
        this.saving = false;
        this.showAdd = false;
        this.measurements = [...this.measurements, created || {
          clientId: this.clientId, measurementType: this.addType, value, unit: type?.unit || '', date: this.addDate,
        }];
        this.showToast(this.t('Measurement saved successfully', 'Mesure enregistrée avec succès'));
        this.load();
      },
      error: err => {
        this.saving = false;
        this.showToast(err?.error?.message || this.t('Unable to save measurement', "Impossible d'enregistrer la mesure"));
      },
    }));
  }

  private showToast(message: string): void {
    this.toast = message;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toast = ''), 3500);
  }
}
