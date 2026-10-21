import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { WriteActionDirective } from 'app/shared/subscription/write-action.directive';

/** Client without any workout program / nutrition plan: what it means and the action to take, in one card. */
@Component({
  selector: 'app-client-plan-empty',
  standalone: true,
  imports: [CommonModule, TranslateModule, FeatherModule, WriteActionDirective],
  template: `
    <section class="cpe" role="status">
      <span class="cpe__icon" aria-hidden="true"><i-feather [name]="kind === 'workout' ? 'dumbbell' : 'apple'"></i-feather></span>
      <h3>{{ (kind === 'workout' ? 'CLIENT_NO_WORKOUT_TITLE' : 'CLIENT_NO_NUTRITION_TITLE') | translate }}</h3>
      <p>{{ (kind === 'workout' ? 'CLIENT_NO_WORKOUT_TEXT' : 'CLIENT_NO_NUTRITION_TEXT') | translate }}</p>
      <ul class="cpe__hints">
        <li><i-feather name="calendar"></i-feather>{{ 'CLIENT_EMPTY_HINT_DATES' | translate }}</li>
        <li><i-feather name="trending-up"></i-feather>{{ 'CLIENT_EMPTY_HINT_PROGRESS' | translate }}</li>
      </ul>
      <button type="button" class="cpe__action" appWriteAction (click)="assign.emit()">
        <i-feather name="plus"></i-feather>
        {{ (kind === 'workout' ? 'ASSIGN_WORKOUT_PROGRAM' : 'ASSIGN_NUTRITION_PLAN') | translate }}
      </button>
    </section>
  `,
  styles: [`
    .cpe {
      display: grid;
      justify-items: center;
      gap: 10px;
      margin: 8px 0 20px;
      padding: 36px 20px;
      border: 1.5px dashed #cbd5e1;
      border-radius: 16px;
      background: #fff;
      text-align: center;
    }
    .cpe__icon {
      display: grid;
      width: 56px;
      height: 56px;
      place-items: center;
      border-radius: 50%;
      color: #44b4df;
      background: #eef8fc;
    }
    .cpe__icon i-feather { width: 26px; height: 26px; }
    h3 { margin: 4px 0 0; color: #0f172a; font-size: 18px; font-weight: 800; }
    p { max-width: 520px; margin: 0; color: #64748b; font-size: 14px; line-height: 1.55; }
    .cpe__hints {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px 18px;
      margin: 4px 0 6px;
      padding: 0;
      list-style: none;
      color: #64748b;
      font-size: 12.5px;
    }
    .cpe__hints li { display: inline-flex; align-items: center; gap: 6px; }
    .cpe__hints i-feather { width: 14px; height: 14px; color: #44b4df; }
    .cpe__action {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 44px;
      padding: 0 20px;
      border: 0;
      border-radius: 999px;
      color: #fff;
      background: #0f172a;
      font: inherit;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
    }
    .cpe__action:hover { background: #1e293b; }
    .cpe__action i-feather { width: 17px; height: 17px; }
    @media (max-width: 640px) {
      .cpe { padding: 26px 16px; }
      h3 { font-size: 16px; }
      p { font-size: 13px; }
      .cpe__action { width: 100%; justify-content: center; }
    }
  `],
})
export class ClientPlanEmptyComponent {
  @Input() kind: 'workout' | 'nutrition' = 'workout';
  @Output() assign = new EventEmitter<void>();
}
