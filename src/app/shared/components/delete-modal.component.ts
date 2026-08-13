import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { ModalUiStateService, DeleteModalConfig } from '../../service/modal-ui-state.service';
import { Subscription } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-delete-modal',
  standalone: true,
  imports: [CommonModule, FeatherModule, TranslateModule],
  template: `
    <div class="modal-overlay" [class.show]="show" (click)="onCancel()">
      <div class="modal-content delete-modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>{{ config?.title || ('DELETE_ITEM' | translate) }}</h2>
          <button class="close-btn" (click)="onCancel()">
            <i-feather name="x"></i-feather>
          </button>
        </div>

        <div class="modal-body">
          <div class="delete-icon">
            <i-feather name="trash-2" size="24"></i-feather>
          </div>
          <h3>{{ 'ARE_YOU_SURE' | translate }}</h3>
          <p>{{ config?.message || ('ACTION_CANNOT_BE_UNDONE_SHORT' | translate) }}</p>
          <p *ngIf="config?.itemName" class="item-name">
            <strong>{{ config.itemName }}</strong>
          </p>
        </div>

        <div class="modal-footer">
          <button class="cancel-btn" (click)="onCancel()">
            {{ config?.cancelText || ('CANCEL' | translate) }}
          </button>
          <button class="confirm-btn danger" (click)="onConfirm()">
            {{ config?.confirmText || ('DELETE' | translate) }}
          </button>
        </div>
      </div>
    </div>
  `
})
export class DeleteModalComponent implements OnInit, OnDestroy {
  show = false;
  config: DeleteModalConfig | null = null;
  private subscriptions = new Subscription();

  constructor(private modalService: ModalUiStateService) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.modalService.deleteModalShow$.subscribe(show => {
        console.log('Delete modal show changed:', show);
        this.show = show;
      })
    );

    this.subscriptions.add(
      this.modalService.deleteModalConfig$.subscribe(config => {
        console.log('Delete modal config changed:', config);
        this.config = config;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  onConfirm(): void {
    this.modalService.confirmDelete();
  }

  onCancel(): void {
    this.modalService.cancelDelete();
  }
}
