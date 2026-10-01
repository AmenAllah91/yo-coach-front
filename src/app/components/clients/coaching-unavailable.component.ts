import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CoachingAccessService } from '../../service/coaching-access.service';

@Component({
  standalone: true,
  selector: 'app-coaching-unavailable',
  template: `<main role="alert"><h1>Coaching access unavailable</h1>
    <p>Your profile is currently archived by your coach. Your coaching content is temporarily unavailable. Please contact your coach to reactivate your access.</p>
    <button type="button" (click)="retry()">Check access</button></main>`,
  styles: [`main { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px; box-sizing: border-box; text-align: center; background: #f6f7fa; } p { max-width: 560px; line-height: 1.6; } button { padding: 12px 24px; cursor: pointer; }`]
})
export class CoachingUnavailableComponent {
  constructor(private access: CoachingAccessService, private router: Router) {}
  async retry() { if (await this.access.refresh()) await this.router.navigateByUrl('/client-dashboard'); }
}
