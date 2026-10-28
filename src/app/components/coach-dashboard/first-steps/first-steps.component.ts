import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { finalize } from 'rxjs';
import {
  CoachGuideDiscoverStep,
  CoachGuideService,
  CoachGuideStartStep,
  CoachGuideStatus,
  CoachGuideStep,
} from '../../../service/coach-guide.service';
import { AddClientModalComponent } from '../../clients/add-client-modal/add-client-modal.component';

/**
 * "First steps" checklist of the coach dashboard. Part 1 (while the example client exists): discover the app on him.
 * Part 2: start for real; those steps tick themselves from the coach's real data. The example client can be removed,
 * or brought back, from here at any time.
 */
@Component({
  selector: 'app-first-steps',
  standalone: true,
  imports: [CommonModule, TranslateModule, AddClientModalComponent],
  templateUrl: './first-steps.component.html',
  styleUrl: './first-steps.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FirstStepsComponent implements OnInit {
  /** The example client was removed or brought back: the dashboard reads its numbers again. */
  @Output() exampleChanged = new EventEmitter<void>();

  status: CoachGuideStatus | null = null;
  busy = false;
  confirmRemove = false;
  showAddClient = false;
  failed = false;

  constructor(private readonly guide: CoachGuideService, private readonly router: Router, private readonly cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.guide.load().subscribe({
      next: (status) => { this.status = status; this.cdr.markForCheck(); },
      error: () => undefined, // the dashboard works without the guide
    });
  }

  /** Coaches who never went through the welcome screen (accounts older than the guide) do not get the checklist. */
  get visible(): boolean {
    return !!this.status?.started && !this.status.hidden;
  }

  get exampleName(): string {
    return (this.status?.example.clientName || '').split(' ')[0] || '';
  }

  get steps(): CoachGuideStep<string>[] {
    return [...(this.status?.discover ?? []), ...(this.status?.start ?? []).filter((step) => !step.optional)];
  }

  get doneCount(): number {
    return this.steps.filter((step) => step.done).length;
  }

  get progress(): number {
    return this.steps.length ? Math.round((this.doneCount / this.steps.length) * 100) : 0;
  }

  get allDone(): boolean {
    return !!this.status && this.status.completed && this.status.discover.every((step) => step.done);
  }

  openDiscover(step: CoachGuideDiscoverStep): void {
    const clientId = this.status?.example.clientId;
    if (!clientId) return;
    if (step !== 'REPLY_MESSAGE') {
      this.guide.visit(step).subscribe({ next: (status) => (this.status = status), error: () => undefined });
    }
    switch (step) {
      case 'OPEN_CLIENT': void this.router.navigate(['/clients/profil-client', clientId]); break;
      case 'VIEW_PROGRAM': void this.router.navigate(['/clients/profil-client', clientId], { queryParams: { tab: 'workouts' } }); break;
      case 'REVIEW_CHECKIN': void this.router.navigate(['/clients/profil-client', clientId], { queryParams: { tab: 'checkins' } }); break;
      case 'REPLY_MESSAGE': void this.router.navigate(['/chat'], { queryParams: { clientId } }); break;
    }
  }

  openStart(step: CoachGuideStartStep): void {
    switch (step) {
      case 'PROFILE': void this.router.navigate(['/edit-profile', sessionStorage.getItem('userId') || '']); break;
      case 'BRANDING': void this.router.navigate(['/theme']); break;
      case 'WEBSITE': void this.router.navigate(['/websites/create']); break;
      case 'PROGRAM':
        void this.router.navigate([this.status?.challenge === 'NUTRITION_PLANS' ? '/nutrition/plans' : '/workout/create-workout'],
          { queryParams: { returnUrl: '/coach-dashboard' } });
        break;
      case 'INVITE': this.showAddClient = true; break;
    }
  }

  removeExample(): void {
    this.changeExample('SCRATCH');
  }

  restoreExample(): void {
    this.changeExample('EXAMPLE');
  }

  setHidden(hidden: boolean): void {
    this.guide.setHidden(hidden).subscribe({
      next: (status) => { this.status = status; this.cdr.markForCheck(); },
      error: () => undefined,
    });
  }

  onInviteClosed(): void {
    this.showAddClient = false;
    this.load();
  }

  private changeExample(choice: 'EXAMPLE' | 'SCRATCH'): void {
    if (this.busy) return;
    this.busy = true;
    this.failed = false;
    this.guide.start(choice).pipe(finalize(() => { this.busy = false; this.cdr.markForCheck(); })).subscribe({
      next: (status) => {
        this.status = status;
        this.confirmRemove = false;
        this.exampleChanged.emit();
      },
      error: () => (this.failed = true),
    });
  }
}
