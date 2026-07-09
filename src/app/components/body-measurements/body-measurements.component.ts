import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  BodyMeasurement,
  BodyMeasurementsService
} from 'app/service/body-measurements.service';
import { CoachSettingsService } from 'app/service/coach-settings.service';

interface MeasurementTypeItem {
  key: string;
  label: string;
  unit: string;
  icon: string;
}

@Component({
  selector: 'app-body-measurements',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './body-measurements.component.html',
  styleUrls: ['./body-measurements.component.scss'],
})
export class BodyMeasurementsComponent implements OnInit, OnChanges {
  private readonly historyPageSize = 5;

  @Input() clientId = '';
  @Input() allowAdd = true;

  /**
   * Goal body weight from the client profile.
   * Coach profile passes it from selected client.
   * Client sidebar page fetches it from /api/users/{clientId}.
   */
  @Input() targetWeight: number | null | undefined = null;

  loading = false;
  saving = false;
  error: string | null = null;

  search = '';
  selectedType = 'BODYWEIGHT';
  historyLimit = this.historyPageSize;

  showAddModal = false;

  addForm = {
    value: null as number | null,
    date: new Date().toISOString().split('T')[0],
    note: '',
  };

  measurements: BodyMeasurement[] = [];

  measurementTypes: MeasurementTypeItem[] = [
    { key: 'BODYWEIGHT', label: 'Bodyweight', unit: 'kg', icon: 'fa-weight-scale' },
    { key: 'BMI', label: 'BMI', unit: '%', icon: 'fa-person' },
    { key: 'BODY_FAT_INDEX', label: 'Body Fat Index', unit: '%', icon: 'fa-person' },
    { key: 'WAIST', label: 'Waist', unit: 'cm', icon: 'fa-ruler-horizontal' },
    { key: 'CHEST', label: 'Chest', unit: 'cm', icon: 'fa-ruler-horizontal' },
    { key: 'SHOULDERS', label: 'Shoulders', unit: 'cm', icon: 'fa-ruler-horizontal' },
    { key: 'BICEPS_RIGHT', label: 'Biceps (Right)', unit: 'cm', icon: 'fa-ruler-horizontal' },
    { key: 'BICEPS_LEFT', label: 'Biceps (Left)', unit: 'cm', icon: 'fa-ruler-horizontal' },
    { key: 'QUADRICEPS_RIGHT', label: 'Quadriceps (Right)', unit: 'cm', icon: 'fa-ruler-horizontal' },
    { key: 'QUADRICEPS_LEFT', label: 'Quadriceps (Left)', unit: 'cm', icon: 'fa-ruler-horizontal' },
    { key: 'NECK', label: 'Neck', unit: 'cm', icon: 'fa-ruler-horizontal' },
  ];

  constructor(
    private bodyMeasurementsService: BodyMeasurementsService,
    private route: ActivatedRoute,
    private coachSettingsService: CoachSettingsService
  ) {}

  ngOnInit(): void {
    if (!this.clientId) {
      this.clientId =
        this.route.snapshot.queryParamMap.get('clientId') ||
        sessionStorage.getItem('userId') ||
        '';
    }

    this.loadTargetWeightIfNeeded();
    this.loadMeasurements();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['clientId'] && !changes['clientId'].firstChange) {
      this.loadTargetWeightIfNeeded();
      this.loadMeasurements();
    }

    if (changes['targetWeight'] && !changes['targetWeight'].firstChange) {
      this.targetWeight = this.toNullableNumber(changes['targetWeight'].currentValue);
    }
  }

  loadMeasurements(): void {
    if (!this.clientId) {
      this.error = 'Client id is missing';
      return;
    }

    this.loading = true;
    this.error = null;

    this.bodyMeasurementsService.getByClient(this.clientId).subscribe({
      next: (items) => {
        this.measurements = items || [];
        this.loading = false;
      },
      error: (err) => {
        console.error('loadMeasurements failed:', err);
        this.error = 'Failed to load measurements';
        this.loading = false;
      },
    });
  }

  loadTargetWeightIfNeeded(): void {
    this.targetWeight = this.toNullableNumber(this.targetWeight);

    if (this.targetWeight !== null && this.targetWeight !== undefined) {
      return;
    }

    if (!this.clientId) {
      return;
    }

    this.bodyMeasurementsService.getClientProfile(this.clientId).subscribe({
      next: (profile) => {
        this.targetWeight = this.toNullableNumber(profile?.targetWeight);
      },
      error: (err) => {
        console.warn('Could not load target weight:', err);
      },
    });
  }

  selectType(type: string): void {
    this.selectedType = type;
    this.historyLimit = this.historyPageSize;
  }

  openAddModal(): void {
    if (!this.allowAdd) return;

    this.addForm = {
      value: null,
      date: new Date().toISOString().split('T')[0],
      note: '',
    };

    this.showAddModal = true;
  }

  closeAddModal(): void {
    if (this.saving) return;
    this.showAddModal = false;
  }

  saveMeasurement(): void {
    if (!this.clientId || this.addForm.value === null || this.addForm.value === undefined) {
      return;
    }

    const type = this.currentType;

    const payload: BodyMeasurement = {
      clientId: this.clientId,
      measurementType: this.selectedType,
      value: this.toStoredValue(Number(this.addForm.value), type),
      unit: type.unit,
      date: this.addForm.date,
      note: this.addForm.note || '',
    };

    this.saving = true;

    this.bodyMeasurementsService.create(payload).subscribe({
      next: () => {
        this.saving = false;
        this.showAddModal = false;
        this.loadMeasurements();
      },
      error: (err) => {
        console.error('saveMeasurement failed:', err);
        this.error = 'Failed to save measurement';
        this.saving = false;
      },
    });
  }

  get filteredTypes(): MeasurementTypeItem[] {
    const q = this.search.trim().toLowerCase();

    if (!q) {
      return this.measurementTypes;
    }

    return this.measurementTypes.filter((type) =>
      type.label.toLowerCase().includes(q)
    );
  }

  get currentType(): MeasurementTypeItem {
    return this.measurementTypes.find((type) => type.key === this.selectedType) || this.measurementTypes[0];
  }

  get selectedMeasurements(): BodyMeasurement[] {
    return this.measurements
      .filter((item) => item.measurementType === this.selectedType)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  get history(): BodyMeasurement[] {
    return [...this.selectedMeasurements].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  get visibleHistory(): BodyMeasurement[] {
    return this.history.slice(0, this.historyLimit);
  }

  get hasMoreHistory(): boolean {
    return this.historyLimit < this.history.length;
  }

  loadMoreHistory(): void {
    this.historyLimit += this.historyPageSize;
  }

  get latestMeasurement(): BodyMeasurement | null {
    const items = this.selectedMeasurements;
    return items.length ? items[items.length - 1] : null;
  }

  get latestValue(): string {
    if (!this.latestMeasurement) {
      return '--';
    }

    return `${this.formatValue(this.toDisplayValue(this.latestMeasurement.value, this.currentType))} ${this.getDisplayUnit(this.currentType)}`;
  }

  get normalizedTargetWeight(): number | null {
    return this.toNullableNumber(this.targetWeight);
  }

  get showGoalLine(): boolean {
    return this.selectedType === 'BODYWEIGHT' && this.normalizedTargetWeight !== null;
  }

  get goalLabel(): string {
    if (!this.showGoalLine || this.normalizedTargetWeight === null) {
      return '';
    }

    return `Goal ${this.formatValue(this.toDisplayWeight(this.normalizedTargetWeight))} ${this.coachSettingsService.getWeightUnit()}`;
  }

  get chartMin(): number {
    const values = this.selectedMeasurements.map((item) => this.toDisplayValue(item.value, this.currentType));

    if (this.showGoalLine && this.normalizedTargetWeight !== null) {
      values.push(this.toDisplayWeight(this.normalizedTargetWeight));
    }

    if (!values.length) {
      return 0;
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max((max - min) * 0.12, 1);

    return min - padding;
  }

  get chartMax(): number {
    const values = this.selectedMeasurements.map((item) => this.toDisplayValue(item.value, this.currentType));

    if (this.showGoalLine && this.normalizedTargetWeight !== null) {
      values.push(this.toDisplayWeight(this.normalizedTargetWeight));
    }

    if (!values.length) {
      return 1;
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max((max - min) * 0.12, 1);

    return max + padding;
  }

  get chartPoints(): string {
    const items = this.selectedMeasurements;

    if (items.length === 0) {
      return '';
    }

    if (items.length === 1) {
      const y = this.valueToY(this.toDisplayValue(items[0].value, this.currentType));
      return `30,${y.toFixed(1)} 650,${y.toFixed(1)}`;
    }

    const width = 620;
    const left = 30;

    return items
      .map((item, index) => {
        const x = left + (index / (items.length - 1)) * width;
        const y = this.valueToY(this.toDisplayValue(item.value, this.currentType));
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  get chartDots(): Array<{ x: number; y: number; value: number }> {
    const points = this.chartPoints;
    if (!points) return [];

    return points.split(' ').map((pair, index) => {
      const [x, y] = pair.split(',').map(Number);
      return {
        x,
        y,
        value: this.toDisplayValue(this.selectedMeasurements[index]?.value, this.currentType),
      };
    });
  }

  get goalLineY(): number {
    if (!this.showGoalLine || this.normalizedTargetWeight === null) {
      return 0;
    }

    return this.valueToY(this.toDisplayWeight(this.normalizedTargetWeight));
  }

  get goalLabelY(): number {
    return Math.max(18, this.goalLineY - 8);
  }

  get yAxisLabels(): number[] {
    if (!this.selectedMeasurements.length && !this.showGoalLine) {
      return [0, 1, 2, 3];
    }

    const min = this.chartMin;
    const max = this.chartMax;
    const range = max - min || 1;

    return [
      max,
      max - range / 3,
      max - (range * 2) / 3,
      min,
    ];
  }

  formatValue(value: number): string {
    return Number(value).toLocaleString('fr-FR', {
      maximumFractionDigits: 1,
    });
  }

  formatDate(value: string): string {
    return new Date(value).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
  }

  trackByMeasurementId(_: number, item: BodyMeasurement): string {
    return item.id || `${item.measurementType}-${item.date}-${item.value}`;
  }

  trackByType(_: number, item: MeasurementTypeItem): string {
    return item.key;
  }

  private valueToY(value: number): number {
    const height = 230;
    const top = 25;
    const range = this.chartMax - this.chartMin || 1;

    return top + height - ((value - this.chartMin) / range) * height;
  }

  getDisplayUnit(type: MeasurementTypeItem): string {
    if (type.key === 'BODYWEIGHT') return this.coachSettingsService.getWeightUnit();
    if (type.unit === 'cm') return this.coachSettingsService.getMeasurementUnit();
    return type.unit;
  }

  toDisplayValue(value: number | null | undefined, type: MeasurementTypeItem): number {
    if (type.key === 'BODYWEIGHT') return this.toDisplayWeight(value);
    if (type.unit === 'cm') return this.coachSettingsService.convertMeasurementFromCm(value) ?? 0;
    return Number(value || 0);
  }

  private toStoredValue(value: number, type: MeasurementTypeItem): number {
    if (type.key === 'BODYWEIGHT') return this.coachSettingsService.convertWeightToKg(value) ?? value;
    if (type.unit === 'cm') return this.coachSettingsService.convertMeasurementToCm(value) ?? value;
    return value;
  }

  private toDisplayWeight(value: number | null | undefined): number {
    return this.coachSettingsService.convertWeightFromKg(value) ?? 0;
  }

  private toNullableNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = Number(value);

    return Number.isNaN(parsed) ? null : parsed;
  }
}
