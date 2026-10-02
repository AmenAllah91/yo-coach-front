import { Component } from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-coaching-unavailable',
  template: `<main role="alert"><h1>Coaching access unavailable</h1>
    <p>Your profile is currently archived by your coach. Your coaching content is temporarily unavailable. Please contact your coach to reactivate your access.</p></main>`,
  styles: [`main { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px; box-sizing: border-box; text-align: center; background: #f6f7fa; } p { max-width: 560px; line-height: 1.6; }`]
})
export class CoachingUnavailableComponent {}
