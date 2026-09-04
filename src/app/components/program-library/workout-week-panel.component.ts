import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
@Component({
  selector: 'app-workout-week-panel', standalone: true, imports: [CommonModule, TranslateModule],
  template: `<section class="week-panel">
    <div class="week-heading"><h2>{{ 'WEEK_NUMBER' | translate:{number: week} }} <small>{{ range }}</small></h2>
      <div class="week-actions"><button type="button" [disabled]="saving" (click)="save.emit()">{{ 'SAVE_DRAFT' | translate }}</button>
      <button type="button" class="publish" [disabled]="saving || ready !== 7 || published" [title]="'WORKOUT_PUBLISH_HINT' | translate" (click)="publish.emit()">{{ 'WORKOUT_PUBLISH_WEEK' | translate:{number: week} }}</button></div></div>
    <div class="week-status"><span class="badge" [class.published]="published">{{ (published ? 'WORKOUT_PUBLISHED' : 'WORKOUT_DRAFT') | translate }}</span><span>{{ 'WORKOUT_READY_COUNT' | translate:{count: ready} }}</span></div>
    <div class="week-progress"><progress [value]="ready" max="7" [attr.aria-label]="'WORKOUT_READY_COUNT' | translate:{count: ready}"></progress><small>{{ 'WORKOUT_DRAFT_HINT' | translate }}</small></div>
    <small *ngIf="savedAt" role="status">{{ 'WORKOUT_SAVED' | translate }} {{ savedAt | date:'HH:mm' }}</small>
    <p *ngIf="error" role="alert" class="error">{{ error }}</p>
  </section>`,
  styles: [`.week-panel{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:20px;margin:0 0 18px;color:#17212f}.week-heading,.week-actions,.week-status,.week-progress{display:flex;align-items:center;gap:12px}.week-heading{justify-content:space-between;flex-wrap:wrap}h2{font-size:18px;margin:0}h2 small{font-size:12px;font-weight:400;color:#788391}.week-status{margin:12px 0;font-size:12px}.badge{background:#f2f4f7;color:#64748b;border-radius:5px;padding:4px 8px}.published{background:#dcfce7;color:#15803d}button{border:1px solid #dce1e7;background:white;border-radius:8px;padding:10px 14px;font:inherit;font-size:12px;cursor:pointer}.publish{background:#111827;color:white}button:disabled{background:#e9edf2;color:#99a1ad;cursor:not-allowed;border-color:#e9edf2}progress{width:160px;height:7px;accent-color:#249abd;flex-shrink:0}.week-progress small{color:#8b95a4;font-size:12px}.error{color:#b42318}.week-panel>small{display:block;margin-top:10px;color:#667085}@media(max-width:600px){.week-actions{width:100%}.week-progress{align-items:flex-start;flex-direction:column}}`]
})
export class WorkoutWeekPanelComponent {
  @Input() week = 1; @Input() ready = 0; @Input() published = false; @Input() range = '';
  @Input() saving = false; @Input() savedAt: Date | null = null; @Input() error = '';
  @Output() save = new EventEmitter<void>(); @Output() publish = new EventEmitter<void>();
}
