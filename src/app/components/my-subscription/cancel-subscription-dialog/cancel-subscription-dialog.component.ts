import { AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Input, OnDestroy, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';

/**
 * SUB-35: "Cancel your subscription?" confirmation. Emits true when the coach confirms the cancellation, false when
 * they keep the subscription (button, close, Escape or click outside). "Keep" has the focus: the safe answer.
 */
@Component({
  selector: 'app-cancel-subscription-dialog',
  standalone: true,
  imports: [CommonModule, TranslateModule, FeatherModule],
  templateUrl: './cancel-subscription-dialog.component.html',
  styleUrl: './cancel-subscription-dialog.component.scss',
})
export class CancelSubscriptionDialogComponent implements AfterViewInit, OnDestroy {
  /** Last day of access, dd/MM/yyyy (empty: the date line is not shown). */
  @Input() until = '';
  @Output() answer = new EventEmitter<boolean>();

  @ViewChild('keepButton') private keepButton?: ElementRef<HTMLButtonElement>;
  private previousOverflow = '';

  ngAfterViewInit(): void {
    this.previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    this.keepButton?.nativeElement.focus();
  }

  ngOnDestroy(): void {
    document.body.style.overflow = this.previousOverflow;
  }

  @HostListener('document:keydown.escape')
  keep(): void {
    this.answer.emit(false);
  }

  confirmCancellation(): void {
    this.answer.emit(true);
  }
}
