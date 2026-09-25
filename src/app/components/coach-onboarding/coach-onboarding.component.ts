import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { finalize } from 'rxjs/operators';
import {
  CoachDistanceUnit,
  CoachLanguage,
  CoachMeasurementUnit,
  CoachOnboardingState,
  CoachWeightUnit,
} from '../../models/coach-onboarding.model';
import { CoachOnboardingService } from '../../service/coach-onboarding.service';
import { LanguageService } from '../../service/language.service';
import { ONBOARDING_COUNTRIES, ONBOARDING_TIMEZONES } from './onboarding-reference-data';

@Component({
  selector: 'app-coach-onboarding',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './coach-onboarding.component.html',
  styleUrl: './coach-onboarding.component.scss',
})
export class CoachOnboardingComponent implements OnInit {
  readonly countries = ONBOARDING_COUNTRIES;
  readonly timezones = ONBOARDING_TIMEZONES;

  readonly businessTypes = [
    { value: 'ONLINE', label: 'COACH_ONBOARDING.BUSINESS_TYPES.ONLINE' },
    { value: 'IN_PERSON', label: 'COACH_ONBOARDING.BUSINESS_TYPES.IN_PERSON' },
    { value: 'HYBRID', label: 'COACH_ONBOARDING.BUSINESS_TYPES.HYBRID' },
    { value: 'OTHER', label: 'COACH_ONBOARDING.OTHER' },
  ];

  readonly goalOptions = [
    { value: 'GET_MORE_CLIENTS', label: 'COACH_ONBOARDING.GOALS.GET_MORE_CLIENTS' },
    { value: 'SAVE_TIME', label: 'COACH_ONBOARDING.GOALS.SAVE_TIME' },
    { value: 'IMPROVE_CLIENT_EXPERIENCE', label: 'COACH_ONBOARDING.GOALS.IMPROVE_CLIENT_EXPERIENCE' },
    { value: 'GROW_REVENUE', label: 'COACH_ONBOARDING.GOALS.GROW_REVENUE' },
    { value: 'ORGANIZE_BUSINESS', label: 'COACH_ONBOARDING.GOALS.ORGANIZE_BUSINESS' },
    { value: 'OTHER', label: 'COACH_ONBOARDING.OTHER' },
  ];

  readonly managementOptions = [
    { value: 'SPREADSHEETS', label: 'COACH_ONBOARDING.MANAGEMENT.SPREADSHEETS' },
    { value: 'COACHING_SOFTWARE', label: 'COACH_ONBOARDING.MANAGEMENT.COACHING_SOFTWARE' },
    { value: 'OTHER', label: 'COACH_ONBOARDING.OTHER' },
  ];

  readonly businessForm: FormGroup;
  readonly locationForm: FormGroup;
  readonly unitsForm: FormGroup;

  activeStepIndex = 0;
  loading = true;
  saving = false;
  loadError = false;
  submitError = '';

  constructor(
    private readonly fb: FormBuilder,
    private readonly onboarding: CoachOnboardingService,
    private readonly languageService: LanguageService,
    private readonly router: Router,
  ) {
    this.businessForm = this.fb.group(
      {
        businessName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
        businessType: ['', Validators.required],
        businessTypeOther: ['', Validators.maxLength(100)],
        businessGoals: [[], Validators.required],
        businessGoalOther: ['', Validators.maxLength(160)],
        clientManagementMethod: ['', Validators.required],
        clientManagementOther: ['', Validators.maxLength(120)],
        coachingSoftware: ['', Validators.maxLength(120)],
      },
      { validators: this.businessConditionalValidator },
    );

    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    this.locationForm = this.fb.group({
      country: ['', Validators.required],
      city: ['', [Validators.required, Validators.maxLength(100)]],
      timezone: [browserTimezone, Validators.required],
      language: [this.languageService.languageCodeToName(this.languageService.getCurrentLanguage()), Validators.required],
    });

    this.unitsForm = this.fb.group({
      weightUnit: ['kg', Validators.required],
      distanceUnit: ['km', Validators.required],
      measurementUnit: ['cm', Validators.required],
    });
  }

  ngOnInit(): void {
    this.loadState();
    this.locationForm.get('country')?.valueChanges.subscribe((country) => {
      if (this.unitsForm.pristine) {
        this.unitsForm.patchValue(this.defaultUnitsForCountry(country), { emitEvent: false });
      }
    });
  }

  get progressPercent(): number {
    return ((this.activeStepIndex + 1) / 3) * 100;
  }

  get selectedGoals(): string[] {
    return this.businessForm.get('businessGoals')?.value || [];
  }

  get currentForm(): FormGroup {
    return [this.businessForm, this.locationForm, this.unitsForm][this.activeStepIndex];
  }

  loadState(force = false): void {
    this.loading = true;
    this.loadError = false;
    this.onboarding.load(force).pipe(finalize(() => (this.loading = false))).subscribe({
      next: (state) => this.applyState(state),
      error: (error) => {
        console.error('Coach onboarding load failed', error);
        this.loadError = true;
      },
    });
  }

  toggleGoal(value: string): void {
    const control = this.businessForm.get('businessGoals');
    const values = new Set<string>(control?.value || []);
    values.has(value) ? values.delete(value) : values.add(value);
    control?.setValue([...values]);
    control?.markAsTouched();
  }

  goalSelected(value: string): boolean {
    return this.selectedGoals.includes(value);
  }

  selectBusinessType(value: string): void {
    this.businessForm.get('businessType')?.setValue(value);
    this.businessForm.get('businessType')?.markAsTouched();
    this.businessForm.updateValueAndValidity();
  }

  selectManagement(value: string): void {
    this.businessForm.get('clientManagementMethod')?.setValue(value);
    this.businessForm.get('clientManagementMethod')?.markAsTouched();
    this.businessForm.updateValueAndValidity();
  }

  selectUnit(field: 'weightUnit' | 'distanceUnit' | 'measurementUnit', value: string): void {
    this.unitsForm.get(field)?.setValue(value);
    this.unitsForm.markAsDirty();
  }

  continue(): void {
    this.submitError = '';
    this.currentForm.markAllAsTouched();
    this.currentForm.updateValueAndValidity();
    if (this.currentForm.invalid || this.saving) return;

    this.saving = true;
    const step = this.activeStepIndex === 0 ? 'business-goals' : this.activeStepIndex === 1 ? 'location-timezone' : 'units';
    const payload = this.currentForm.getRawValue();

    this.onboarding.saveStep(step, payload).pipe(finalize(() => (this.saving = false))).subscribe({
      next: (state) => {
        this.applyStateData(state);
        if (this.activeStepIndex === 1) {
          const language = this.locationForm.get('language')?.value as CoachLanguage;
          this.languageService.setLanguage(this.languageService.languageNameToCode(language));
        }
        if (state.completed) {
          this.router.navigate(['/coach-dashboard']);
          return;
        }
        this.activeStepIndex = Math.min(2, this.activeStepIndex + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: (error) => {
        console.error('Coach onboarding save failed', error);
        this.submitError = String(error?.error?.error || 'Unable to save this step. Please try again.');
      },
    });
  }

  back(): void {
    if (this.saving || this.activeStepIndex === 0) return;
    this.activeStepIndex--;
    this.submitError = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  showError(controlName: string): boolean {
    const control = this.currentForm.get(controlName);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  timezoneLabel(timezone: string): string {
    try {
      const parts = new Intl.DateTimeFormat('en', {
        timeZone: timezone,
        timeZoneName: 'shortOffset',
      }).formatToParts(new Date());
      const offset = parts.find((part) => part.type === 'timeZoneName')?.value || '';
      const city = timezone.split('/').pop()?.replace(/_/g, ' ') || timezone;
      return `${offset} — ${city}`;
    } catch {
      return timezone.replace(/_/g, ' ');
    }
  }

  private applyState(state: CoachOnboardingState): void {
    if (state.completed) {
      this.router.navigate(['/coach-dashboard']);
      return;
    }
    this.applyStateData(state);
    this.activeStepIndex = this.stepIndex(state.currentStep);
    this.businessForm.markAsPristine();
    this.locationForm.markAsPristine();
    this.unitsForm.markAsPristine();
  }

  private applyStateData(state: CoachOnboardingState): void {
    this.businessForm.patchValue(
      {
        businessName: state.businessName || '',
        businessType: state.businessType || '',
        businessTypeOther: state.businessTypeOther || '',
        businessGoals: state.businessGoals || [],
        businessGoalOther: state.businessGoalOther || '',
        clientManagementMethod: state.clientManagementMethod || '',
        clientManagementOther: state.clientManagementOther || '',
        coachingSoftware: state.coachingSoftware || '',
      },
      { emitEvent: false },
    );

    this.locationForm.patchValue(
      {
        country: state.country || '',
        city: state.city || '',
        timezone: state.timezone || this.locationForm.get('timezone')?.value,
        language: state.language || 'English',
      },
      { emitEvent: false },
    );

    const hasSavedUnits = state.completedSteps?.includes('units') || state.currentStep === 'completed';
    this.unitsForm.patchValue(
      hasSavedUnits
        ? {
            weightUnit: state.weightUnit || 'kg',
            distanceUnit: state.distanceUnit || 'km',
            measurementUnit: state.measurementUnit || 'cm',
          }
        : this.defaultUnitsForCountry(state.country),
      { emitEvent: false },
    );
  }

  private stepIndex(step: string): number {
    if (step === 'location-timezone') return 1;
    if (step === 'units') return 2;
    return 0;
  }

  private defaultUnitsForCountry(country: string | null | undefined): {
    weightUnit: CoachWeightUnit;
    distanceUnit: CoachDistanceUnit;
    measurementUnit: CoachMeasurementUnit;
  } {
    const normalized = String(country || '').toLowerCase();
    if (normalized === 'united states' || normalized.includes('united states')) {
      return { weightUnit: 'lbs', distanceUnit: 'miles', measurementUnit: 'in' };
    }
    if (normalized === 'united kingdom') {
      return { weightUnit: 'kg', distanceUnit: 'miles', measurementUnit: 'cm' };
    }
    return { weightUnit: 'kg', distanceUnit: 'km', measurementUnit: 'cm' };
  }

  private businessConditionalValidator(group: AbstractControl): ValidationErrors | null {
    const businessType = group.get('businessType')?.value;
    const businessTypeOther = String(group.get('businessTypeOther')?.value || '').trim();
    const goals: string[] = group.get('businessGoals')?.value || [];
    const goalOther = String(group.get('businessGoalOther')?.value || '').trim();
    const management = group.get('clientManagementMethod')?.value;
    const managementOther = String(group.get('clientManagementOther')?.value || '').trim();
    const software = String(group.get('coachingSoftware')?.value || '').trim();

    const errors: Record<string, boolean> = {};
    if (!goals.length) errors['goalsRequired'] = true;
    if (businessType === 'OTHER' && !businessTypeOther) errors['businessTypeOtherRequired'] = true;
    if (goals.includes('OTHER') && !goalOther) errors['businessGoalOtherRequired'] = true;
    if (management === 'OTHER' && !managementOther) errors['managementOtherRequired'] = true;
    if (management === 'COACHING_SOFTWARE' && !software) errors['coachingSoftwareRequired'] = true;
    return Object.keys(errors).length ? errors : null;
  }
}
