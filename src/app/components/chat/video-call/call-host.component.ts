import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { ActiveCall, CallManagerService, IncomingCall } from '../../../service/call-manager.service';
import { VideoCallOverlayComponent } from './video-call-overlay.component';
import { CallTone } from './call-tones';

/**
 * Audit chat 2026-10-27, calls. Mounted once in the app root: the incoming call (a window in the bottom-right corner,
 * a ringtone, the tab title blinking) on every page, and the call window, which stays open while the user browses.
 */
@Component({
  selector: 'app-call-host',
  standalone: true,
  imports: [CommonModule, FeatherModule, TranslateModule, VideoCallOverlayComponent],
  templateUrl: './call-host.component.html',
  styleUrls: ['./call-host.component.scss'],
})
export class CallHostComponent implements OnInit, OnDestroy {
  incoming: IncomingCall | null = null;
  active: ActiveCall | null = null;

  private readonly ringtone = new CallTone();
  private readonly subscriptions = new Subscription();
  private titleTimer?: ReturnType<typeof setInterval>;
  private originalTitle = '';

  constructor(public calls: CallManagerService, private translate: TranslateService) {}

  ngOnInit(): void {
    this.calls.listen();
    this.subscriptions.add(this.calls.incoming$.subscribe((call) => {
      this.incoming = call;
      if (call) this.startRinging(call); else this.stopRinging();
    }));
    this.subscriptions.add(this.calls.active$.subscribe((call) => this.active = call));
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.stopRinging();
    this.ringtone.dispose();
  }

  initials(name: string): string {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((part) => part[0]!.toUpperCase()).join('') || '?';
  }

  accept(): void {
    this.calls.accept();
  }

  decline(): void {
    this.calls.decline();
  }

  private startRinging(call: IncomingCall): void {
    this.ringtone.start('ring');
    clearInterval(this.titleTimer);
    this.originalTitle = this.originalTitle || document.title;
    const label = `📞 ${call.callerName || this.translate.instant('CALL_INCOMING_VIDEO')}`;
    let on = false;
    this.titleTimer = setInterval(() => {
      on = !on;
      document.title = on ? label : this.originalTitle;
    }, 1000);
  }

  private stopRinging(): void {
    this.ringtone.stop();
    clearInterval(this.titleTimer);
    this.titleTimer = undefined;
    if (this.originalTitle) document.title = this.originalTitle;
    this.originalTitle = '';
  }
}
