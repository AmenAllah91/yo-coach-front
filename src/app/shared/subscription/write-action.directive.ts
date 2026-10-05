import { Directive, ElementRef, OnDestroy, OnInit, Renderer2 } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

import { CoachSubscriptionStateService } from 'app/service/coach-subscription-state.service';

/**
 * SUB-30: put on a create / edit button. While the coach's account is read-only (subscription EXPIRED, CANCELLED,
 * PENDING), the button is disabled with an explanation. CE refuses these writes anyway (SUB-28), so a button without
 * this directive still ends on the read-only message, never on a technical error.
 */
@Directive({
  selector: '[appWriteAction]',
  standalone: true,
})
export class WriteActionDirective implements OnInit, OnDestroy {
  private subscription?: Subscription;
  /** Only what this directive disabled is enabled again (the button may have its own [disabled]). */
  private disabledByUs = false;

  constructor(
    private element: ElementRef<HTMLElement>,
    private renderer: Renderer2,
    private stateService: CoachSubscriptionStateService,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    // Unknown state (CE or YoSales unavailable) = not read-only (SUB-24 policy).
    this.subscription = this.stateService.states$.subscribe((state) => this.apply(!!state?.readOnly));
    this.stateService.getState().subscribe();
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  private apply(readOnly: boolean): void {
    const el = this.element.nativeElement;
    if (readOnly) {
      if (this.disabledByUs || (el as HTMLButtonElement).disabled) {
        // Already disabled (by us, or by the button's own rule): nothing to take back later.
        return;
      }
      this.renderer.setAttribute(el, 'disabled', '');
      this.renderer.setAttribute(el, 'aria-disabled', 'true');
      this.renderer.setAttribute(el, 'title', this.translate.instant('READ_ONLY_ACTION_HINT'));
      this.renderer.addClass(el, 'is-read-only');
      this.disabledByUs = true;
    } else if (this.disabledByUs) {
      this.disabledByUs = false;
      this.renderer.removeAttribute(el, 'disabled');
      this.renderer.removeAttribute(el, 'aria-disabled');
      this.renderer.removeClass(el, 'is-read-only');
    }
  }
}
