import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { finalize } from 'rxjs';
import { CoachGuideChoice, CoachGuideService } from '../../service/coach-guide.service';

/**
 * Seen once, right after the onboarding questionnaire: welcomes the coach and lets them choose how to start, with the
 * example client (recommended, already created at registration) or from scratch (the example is removed).
 */
@Component({
  selector: 'app-coach-welcome',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './coach-welcome.component.html',
  styleUrl: './coach-welcome.component.scss',
})
export class CoachWelcomeComponent implements OnInit {
  choice: CoachGuideChoice = 'EXAMPLE';
  saving = false;
  failed = false;
  firstName = sessionStorage.getItem('firstName') || '';

  constructor(private readonly guide: CoachGuideService, private readonly router: Router) {}

  ngOnInit(): void {
    // Seen once: a coach who already chose goes straight to the dashboard.
    this.guide.load().subscribe({
      next: (status) => {
        if (status.started) void this.router.navigate(['/coach-dashboard']);
        this.firstName = status.coachFirstName || this.firstName;
      },
      error: () => undefined,
    });
  }

  confirm(): void {
    if (this.saving) return;
    this.saving = true;
    this.failed = false;
    this.guide.start(this.choice).pipe(finalize(() => (this.saving = false))).subscribe({
      next: () => void this.router.navigate(['/coach-dashboard']),
      error: () => (this.failed = true),
    });
  }
}
