import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-workout-week-panel',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `<section class="week-panel">
    <div class="week-panel__identity">
      <div class="week-panel__title"><h2>{{ 'WEEK_NUMBER' | translate:{number: week} }}</h2><span [class.published]="published">{{ (published ? 'WORKOUT_PUBLISHED' : 'WORKOUT_DRAFT') | translate }}</span><strong>{{ ready }}/7 {{ 'WORKOUT_READY' | translate | lowercase }}</strong></div>
      <div class="progress"><i [style.width.%]="ready / 7 * 100"></i></div>
    </div>
    <p class="week-panel__hint">{{ published ? ('WORKOUT_PUBLISHED_HINT' | translate) : ('WORKOUT_DRAFT_HINT' | translate) }}</p>
    <small class="saved" *ngIf="savedAt">{{ 'WORKOUT_SAVED' | translate }} {{ savedAt | date:'HH:mm' }}</small>
    <div class="week-panel__buttons"><button type="button" (click)="save.emit()" [disabled]="saving">{{ saving ? ('LOADING' | translate) : ('SAVE_DRAFT' | translate) }}</button><button type="button" class="primary" (click)="publish.emit()" [disabled]="saving || ready !== 7 || published">{{ published ? ('WORKOUT_PUBLISHED' | translate) : ('WORKOUT_PUBLISH_WEEK' | translate:{number: week}) }}</button></div>
    <small class="week-panel__range" *ngIf="range">{{ range }}</small><p class="error" *ngIf="error">{{ error }}</p>
  </section>`,
  styles: [`
    .week-panel{display:grid;grid-template-columns:minmax(280px,auto) minmax(220px,1fr) auto auto;align-items:center;gap:12px;margin:16px;padding:16px;border:1px solid #dce3ea;border-radius:12px;background:#fff;box-shadow:0 2px 4px rgba(15,23,42,.07)}.week-panel__title{display:flex;align-items:center;gap:9px}.week-panel h2{margin:0;font-size:16px}.week-panel__title span{padding:3px 8px;border-radius:999px;background:#f1f5f9;color:#64748b;font-size:12px}.week-panel__title span.published{border:1px solid #82e3bd;background:#ecfdf5;color:#07875f}.week-panel__title strong{color:#079669;font-size:12px}.progress{width:72px;height:4px;margin-top:17px;border-radius:9px;background:#e5e7eb;overflow:hidden}.progress i{display:block;height:100%;background:#19b889}.week-panel__hint{margin:0;color:#8a99b5;font-size:12px;line-height:1.35}.saved{white-space:nowrap;color:#8a99b5}.week-panel__buttons{display:flex;gap:8px}.week-panel button{white-space:nowrap;padding:10px 14px;border:1px solid #d7dee8;border-radius:8px;background:#fff}.week-panel button.primary{background:#0d1b33;color:#fff}.week-panel button:disabled{border-color:#e2e8f0;background:#e8edf5;color:#94a3b8}.week-panel__range{grid-column:1;color:#718096}.error{grid-column:1/-1;margin:0;color:#c62828!important}@media(max-width:900px){.week-panel{grid-template-columns:1fr}.week-panel__range,.error{grid-column:1}.week-panel__buttons{justify-content:flex-start}}
  `],
})
export class WorkoutWeekPanelComponent {
  @Input() week = 1; @Input() ready = 0; @Input() published = false; @Input() saving = false;
  @Input() savedAt: Date | null = null; @Input() error = ''; @Input() range = '';
  @Output() save = new EventEmitter<void>(); @Output() publish = new EventEmitter<void>();
}
