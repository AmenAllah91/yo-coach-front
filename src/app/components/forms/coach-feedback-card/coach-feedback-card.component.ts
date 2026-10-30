import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { FeatherModule } from 'angular-feather';
import { FormAssignment } from 'app/components/forms/services/assignments-api.service';

/**
 * Client Home: « Votre coach a répondu à votre check-in », with a dot while the comment is not read (mobile
 * coach_feedback_card.dart). Opening it shows the comment, softly; closing marks it read.
 */
@Component({
  selector: 'app-coach-feedback-card',
  standalone: true,
  imports: [CommonModule, FeatherModule],
  template: `
    <button type="button" class="yc-card cf-card" (click)="open()">
      <span class="cf-avatar" aria-hidden="true">{{ initials(latest) }}<i class="cf-dot"></i></span>
      <span class="cf-card__copy">
        <strong>{{ fr ? 'Votre coach a répondu à votre check-in' : 'Your coach replied to your check-in' }}</strong>
        <small>{{ subtitle }}</small>
      </span>
      <span class="cf-new">{{ fr ? 'Nouveau' : 'New' }}</span>
    </button>

    <div *ngIf="opened" class="cf-backdrop" (click)="close()">
      <div class="cf-dialog" role="dialog" aria-modal="true" aria-labelledby="cf-title" (click)="$event.stopPropagation()">
        <div class="cf-head">
          <span class="cf-avatar cf-avatar--lg" aria-hidden="true">{{ initials(opened) }}</span>
          <span>
            <strong id="cf-title">{{ coachName(opened) }}</strong>
            <small>{{ meta(opened) }}</small>
          </span>
        </div>
        <blockquote class="cf-quote"><i-feather name="message-square"></i-feather><p>{{ feedback(opened) }}</p></blockquote>
        <button type="button" class="cf-close" (click)="close()">{{ fr ? 'Fermer' : 'Close' }}</button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .cf-card { width: 100%; display: flex; align-items: center; gap: 12px; padding: 12px 14px; text-align: left; cursor: pointer; border: 1px solid var(--yc-border, light-dark(#E6EAF0, #33373D)); font: inherit; color: inherit; }
    .cf-card:focus-visible { outline: 2px solid #7455D9; outline-offset: 2px; }
    .cf-card__copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .cf-card__copy strong { font-size: 14.5px; font-weight: 700; color: var(--yc-text-primary, inherit); }
    .cf-card__copy small { font-size: 12px; color: var(--yc-text-secondary, light-dark(#546175, #b5bac3)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cf-avatar { position: relative; flex: none; width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; font-size: 14px; font-weight: 700; color: light-dark(#5B3FC4, #B3A1FF); background: light-dark(#F0EBFD, #2A2442); }
    .cf-avatar--lg { width: 46px; height: 46px; }
    .cf-dot { position: absolute; top: -1px; right: -1px; width: 12px; height: 12px; border-radius: 50%; background: #7455D9; border: 2px solid var(--yc-surface, light-dark(#fff, #1c1f24)); }
    .cf-new { flex: none; padding: 4px 9px; border-radius: 999px; font-size: 12px; font-weight: 700; color: light-dark(#5B3FC4, #B3A1FF); background: light-dark(#F0EBFD, #2A2442); }
    .cf-backdrop { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: end center; padding: 16px; background: rgba(15, 18, 24, 0.45); animation: cf-fade 0.2s ease-out both; }
    @media (min-width: 640px) { .cf-backdrop { place-items: center; } }
    .cf-dialog { width: min(100%, 460px); padding: 20px; border-radius: 20px; background: var(--yc-surface, light-dark(#fff, #1c1f24)); box-shadow: 0 20px 50px rgba(15, 18, 24, 0.25); animation: cf-rise 0.42s cubic-bezier(0.22, 1, 0.36, 1) both; }
    .cf-head { display: flex; align-items: center; gap: 12px; }
    .cf-head strong { display: block; font-size: 15px; }
    .cf-head small { font-size: 12.5px; color: var(--yc-text-secondary, light-dark(#546175, #b5bac3)); }
    .cf-quote { margin: 16px 0 20px; padding: 16px; display: flex; gap: 10px; border-radius: 16px; border-left: 3px solid #7455D9; background: light-dark(#F4F1FD, #2A2442); }
    .cf-quote i-feather { flex: none; width: 18px; height: 18px; color: light-dark(#7455D9, #B3A1FF); }
    .cf-quote p { margin: 0; font-size: 16px; line-height: 1.45; font-weight: 500; white-space: pre-line; }
    .cf-close { width: 100%; height: 48px; border: 0; border-radius: 14px; font: inherit; font-weight: 700; color: #fff; background: var(--yc-primary, #44B4DF); cursor: pointer; }
    @keyframes cf-fade { from { opacity: 0; } }
    @keyframes cf-rise { from { opacity: 0; transform: translateY(12px); } }
    @media (prefers-reduced-motion: reduce) { .cf-backdrop, .cf-dialog { animation: none; } }
  `],
})
export class CoachFeedbackCardComponent {
  /** Unread comments, newest first: the card opens the first one. */
  @Input({ required: true }) unread: FormAssignment[] = [];
  @Input() fr = true;
  /** Closed: the comment is read. */
  @Output() seen = new EventEmitter<FormAssignment>();

  opened: FormAssignment | null = null;

  get latest(): FormAssignment { return this.unread[0]; }

  get subtitle(): string {
    const more = this.unread.length - 1;
    return [
      this.formName(this.latest),
      more > 0 ? (this.fr ? `+${more} autre${more > 1 ? 's' : ''}` : `+${more} more`) : '',
    ].filter(Boolean).join(' · ');
  }

  open(): void { this.opened = this.latest; }

  @HostListener('document:keydown.escape')
  close(): void {
    const item = this.opened;
    if (!item) return;
    this.opened = null;
    this.seen.emit(item);
  }

  coachName(item: FormAssignment): string {
    return String(item.coachName || '').trim() || (this.fr ? 'Votre coach' : 'Your coach');
  }

  initials(item: FormAssignment | undefined): string {
    const name = String(item?.coachName || '').trim();
    if (!name) return 'C';
    return name.split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('');
  }

  feedback(item: FormAssignment): string { return String(item.coachFeedback || '').trim(); }

  private formName(item: FormAssignment | undefined): string {
    const name = String(item?.formName || '').trim();
    return name ? name[0].toUpperCase() + name.slice(1) : '';
  }

  meta(item: FormAssignment): string {
    const raw = item.reviewedAt || item.submittedAt;
    const date = raw ? new Date(raw) : null;
    const when = date && !isNaN(date.getTime())
      ? new Intl.DateTimeFormat(this.fr ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short' }).format(date)
      : '';
    return [this.formName(item), when].filter(Boolean).join(' · ');
  }
}
