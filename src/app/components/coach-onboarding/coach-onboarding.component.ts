import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { finalize } from 'rxjs/operators';
import { CoachDistanceUnit, CoachLanguage, CoachMeasurementUnit, CoachOnboardingState, CoachWeightUnit } from '../../models/coach-onboarding.model';
import { CoachOnboardingService } from '../../service/coach-onboarding.service';
import { LanguageService } from '../../service/language.service';
import { ONBOARDING_COUNTRIES, ONBOARDING_TIMEZONES } from './onboarding-reference-data';

type Option = { value: string; label: string; icon?: string };

@Component({ selector: 'app-coach-onboarding', standalone: true, imports: [CommonModule, ReactiveFormsModule, TranslateModule], templateUrl: './coach-onboarding.component.html', styleUrl: './coach-onboarding.component.scss' })
export class CoachOnboardingComponent implements OnInit {
  readonly countries = ONBOARDING_COUNTRIES;
  readonly timezones = ONBOARDING_TIMEZONES;
  readonly coachRoles: Option[] = [
    { value: 'PERSONAL_TRAINER', label: 'COACH_ONBOARDING.ROLE.PERSONAL_TRAINER', icon: '🏋️' }, { value: 'ONLINE_COACH', label: 'COACH_ONBOARDING.ROLE.ONLINE_COACH', icon: '💻' },
    { value: 'NUTRITION_COACH', label: 'COACH_ONBOARDING.ROLE.NUTRITION_COACH', icon: '🥗' }, { value: 'STRENGTH_CONDITIONING_COACH', label: 'COACH_ONBOARDING.ROLE.STRENGTH', icon: '💪' },
    { value: 'GYM_OWNER', label: 'COACH_ONBOARDING.ROLE.GYM_OWNER', icon: '🏢' }, { value: 'OTHER', label: 'COACH_ONBOARDING.OTHER', icon: '✨' },
  ];
  readonly coachingModes: Option[] = [
    { value: 'IN_PERSON_ONLY', label: 'COACH_ONBOARDING.MODE.IN_PERSON', icon: '👥' }, { value: 'ONLINE_ONLY', label: 'COACH_ONBOARDING.MODE.ONLINE', icon: '🌐' },
    { value: 'BOTH', label: 'COACH_ONBOARDING.MODE.BOTH', icon: '🔄' }, { value: 'JUST_GETTING_STARTED', label: 'COACH_ONBOARDING.MODE.STARTING', icon: '🚀' },
  ];
  readonly activeClientRanges = this.options('CLIENT_RANGE', ['ZERO', 'ONE_TO_FIVE', 'SIX_TO_TEN', 'ELEVEN_TO_TWENTY', 'TWENTY_ONE_TO_FIFTY', 'FIFTY_ONE_TO_HUNDRED', 'HUNDRED_PLUS']);
  readonly managementTools: Option[] = [
    { value: 'WHATSAPP_MESSENGER', label: 'COACH_ONBOARDING.TOOLS.WHATSAPP', icon: '💬' }, { value: 'SPREADSHEETS', label: 'COACH_ONBOARDING.TOOLS.SPREADSHEETS', icon: '📊' },
    { value: 'PDF_DOCUMENTS', label: 'COACH_ONBOARDING.TOOLS.PDF', icon: '📄' }, { value: 'COACHING_SOFTWARE', label: 'COACH_ONBOARDING.TOOLS.SOFTWARE', icon: '⚙️' },
    { value: 'OWN_SYSTEM', label: 'COACH_ONBOARDING.TOOLS.OWN_SYSTEM', icon: '🧩' }, { value: 'NOTHING_YET', label: 'COACH_ONBOARDING.TOOLS.NOTHING', icon: '🌱' },
    { value: 'OTHER', label: 'COACH_ONBOARDING.OTHER', icon: '✨' },
  ];
  readonly challenges = this.options('CHALLENGE', ['TIME_MANAGEMENT', 'WORKOUT_PROGRAM_CREATION', 'NUTRITION_PLANS', 'PROGRESS_TRACKING', 'ACCOUNTABILITY', 'COMMUNICATION', 'GROWING_ONLINE_BUSINESS', 'PROFESSIONAL_IMAGE', 'TOOLS_FRAGMENTED', 'STARTING_BUSINESS']).concat([{ value: 'OTHER', label: 'COACH_ONBOARDING.OTHER' }]);
  readonly goalOptions = this.options('GOAL', ['SAVE_TIME', 'COACH_MORE_CLIENTS', 'INCREASE_REVENUE', 'START_ONLINE_COACHING', 'IMPROVE_RETENTION', 'PROFESSIONAL_CLIENT_EXPERIENCE', 'REPLACE_TOOLS', 'ORGANIZE_EVERYTHING']);
  readonly targetClientRanges = this.options('TARGET_RANGE', ['ONE_TO_TEN', 'ELEVEN_TO_TWENTY', 'TWENTY_ONE_TO_FIFTY', 'FIFTY_ONE_TO_HUNDRED', 'HUNDRED_PLUS']);

  readonly businessForm: FormGroup;
  readonly locationForm: FormGroup;
  readonly unitsForm: FormGroup;
  activeStepIndex = 0;
  loading = true;
  saving = false;
  loadError = false;
  submitError = '';

  constructor(private readonly fb: FormBuilder, private readonly onboarding: CoachOnboardingService, private readonly languageService: LanguageService, private readonly router: Router) {
    this.businessForm = this.fb.group({
      coachRole: ['', Validators.required], coachRoleOther: ['', Validators.maxLength(120)], coachingMode: ['', Validators.required], activeClientsRange: ['', Validators.required],
      managementTools: [[], Validators.required], managementOther: ['', Validators.maxLength(120)], coachingSoftware: ['', Validators.maxLength(120)],
      biggestChallenge: ['', Validators.required], biggestChallengeOther: ['', Validators.maxLength(180)], businessGoals: [[], Validators.required], targetClientsRange: ['', Validators.required],
    }, { validators: this.businessConditionalValidator });
    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    this.locationForm = this.fb.group({ country: ['', Validators.required], city: ['', [Validators.required, Validators.maxLength(100)]], timezone: [browserTimezone, Validators.required], language: [this.languageService.languageCodeToName(this.languageService.getCurrentLanguage()), Validators.required] });
    this.unitsForm = this.fb.group({ weightUnit: ['kg', Validators.required], distanceUnit: ['km', Validators.required], measurementUnit: ['cm', Validators.required] });
  }

  ngOnInit(): void { this.loadState(); this.locationForm.get('country')?.valueChanges.subscribe((country) => { if (this.unitsForm.pristine) this.unitsForm.patchValue(this.defaultUnitsForCountry(country), { emitEvent: false }); }); }
  get progressPercent(): number { return ((this.activeStepIndex + 1) / 3) * 100; }
  get currentForm(): FormGroup { return [this.businessForm, this.locationForm, this.unitsForm][this.activeStepIndex]; }
  get answeredBusinessQuestions(): number { const v = this.businessForm.value; return [v.coachRole, v.coachingMode, v.activeClientsRange, v.managementTools?.length, v.biggestChallenge, v.businessGoals?.length, v.targetClientsRange].filter(Boolean).length; }
  loadState(force = false): void { this.loading = true; this.loadError = false; this.onboarding.load(force).pipe(finalize(() => (this.loading = false))).subscribe({ next: (state) => this.applyState(state), error: (error) => { console.error('Coach onboarding load failed', error); this.loadError = true; } }); }
  select(field: string, value: string): void { this.businessForm.get(field)?.setValue(value); this.businessForm.get(field)?.markAsTouched(); this.businessForm.updateValueAndValidity(); }
  toggleMulti(field: 'managementTools' | 'businessGoals', value: string): void { const control = this.businessForm.get(field); const values = new Set<string>(control?.value || []); values.has(value) ? values.delete(value) : values.add(value); control?.setValue([...values]); control?.markAsTouched(); this.businessForm.updateValueAndValidity(); }
  isSelected(field: string, value: string): boolean { const current = this.businessForm.get(field)?.value; return Array.isArray(current) ? current.includes(value) : current === value; }
  selectUnit(field: 'weightUnit' | 'distanceUnit' | 'measurementUnit', value: string): void { this.unitsForm.get(field)?.setValue(value); this.unitsForm.markAsDirty(); }
  continue(): void {
    this.submitError = ''; this.currentForm.markAllAsTouched(); this.currentForm.updateValueAndValidity(); if (this.currentForm.invalid || this.saving) return;
    this.saving = true; const step = this.activeStepIndex === 0 ? 'business-goals' : this.activeStepIndex === 1 ? 'location-timezone' : 'units';
    this.onboarding.saveStep(step, this.currentForm.getRawValue()).pipe(finalize(() => (this.saving = false))).subscribe({ next: (state) => { this.applyStateData(state); if (this.activeStepIndex === 1) this.languageService.setLanguage(this.languageService.languageNameToCode(this.locationForm.get('language')?.value as CoachLanguage)); if (state.completed) { this.router.navigate(['/coach-dashboard']); return; } this.activeStepIndex = Math.min(2, this.activeStepIndex + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }, error: (error) => { console.error('Coach onboarding save failed', error); this.submitError = String(error?.error?.error || 'Unable to save this step. Please try again.'); } });
  }
  back(): void { if (this.saving || this.activeStepIndex === 0) return; this.activeStepIndex--; this.submitError = ''; window.scrollTo({ top: 0, behavior: 'smooth' }); }
  showError(controlName: string): boolean { const control = this.currentForm.get(controlName); return !!control && control.invalid && (control.touched || control.dirty); }
  timezoneLabel(timezone: string): string { try { const parts = new Intl.DateTimeFormat('en', { timeZone: timezone, timeZoneName: 'shortOffset' }).formatToParts(new Date()); const offset = parts.find((part) => part.type === 'timeZoneName')?.value || ''; const city = timezone.split('/').pop()?.replace(/_/g, ' ') || timezone; return `${offset} — ${city}`; } catch { return timezone.replace(/_/g, ' '); } }

  private options(group: string, values: string[]): Option[] { return values.map((value) => ({ value, label: `COACH_ONBOARDING.${group}.${value}` })); }
  private applyState(state: CoachOnboardingState): void { if (state.completed) { this.router.navigate(['/coach-dashboard']); return; } this.applyStateData(state); this.activeStepIndex = state.currentStep === 'location-timezone' ? 1 : state.currentStep === 'units' ? 2 : 0; this.businessForm.markAsPristine(); this.locationForm.markAsPristine(); this.unitsForm.markAsPristine(); }
  private applyStateData(state: CoachOnboardingState): void {
    this.businessForm.patchValue({ coachRole: state.coachRole || '', coachRoleOther: state.coachRoleOther || '', coachingMode: state.coachingMode || '', activeClientsRange: state.activeClientsRange || '', managementTools: state.managementTools || [], managementOther: state.managementOther || '', coachingSoftware: state.coachingSoftware || '', biggestChallenge: state.biggestChallenge || '', biggestChallengeOther: state.biggestChallengeOther || '', businessGoals: state.businessGoals || [], targetClientsRange: state.targetClientsRange || '' }, { emitEvent: false });
    this.locationForm.patchValue({ country: state.country || '', city: state.city || '', timezone: state.timezone || this.locationForm.get('timezone')?.value, language: state.language || 'English' }, { emitEvent: false });
    const hasSavedUnits = state.completedSteps?.includes('units') || state.currentStep === 'completed'; this.unitsForm.patchValue(hasSavedUnits ? { weightUnit: state.weightUnit || 'kg', distanceUnit: state.distanceUnit || 'km', measurementUnit: state.measurementUnit || 'cm' } : this.defaultUnitsForCountry(state.country), { emitEvent: false });
  }
  private defaultUnitsForCountry(country: string | null | undefined): { weightUnit: CoachWeightUnit; distanceUnit: CoachDistanceUnit; measurementUnit: CoachMeasurementUnit } { const normalized = String(country || '').toLowerCase(); if (normalized.includes('united states')) return { weightUnit: 'lbs', distanceUnit: 'miles', measurementUnit: 'in' }; if (normalized === 'united kingdom') return { weightUnit: 'kg', distanceUnit: 'miles', measurementUnit: 'cm' }; return { weightUnit: 'kg', distanceUnit: 'km', measurementUnit: 'cm' }; }
  private businessConditionalValidator(group: AbstractControl): ValidationErrors | null {
    const tools: string[] = group.get('managementTools')?.value || []; const goals: string[] = group.get('businessGoals')?.value || []; const errors: Record<string, boolean> = {};
    if (!tools.length) errors['managementRequired'] = true; if (!goals.length) errors['goalsRequired'] = true;
    if (group.get('coachRole')?.value === 'OTHER' && !String(group.get('coachRoleOther')?.value || '').trim()) errors['coachRoleOtherRequired'] = true;
    if (tools.includes('OTHER') && !String(group.get('managementOther')?.value || '').trim()) errors['managementOtherRequired'] = true;
    if (tools.includes('COACHING_SOFTWARE') && !String(group.get('coachingSoftware')?.value || '').trim()) errors['coachingSoftwareRequired'] = true;
    if (group.get('biggestChallenge')?.value === 'OTHER' && !String(group.get('biggestChallengeOther')?.value || '').trim()) errors['challengeOtherRequired'] = true;
    return Object.keys(errors).length ? errors : null;
  }
}
