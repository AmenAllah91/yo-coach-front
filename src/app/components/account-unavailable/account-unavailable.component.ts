import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AccountAccessService } from '../../service/account-access.service';
import { AuthService } from '../../config/auth.service';

@Component({selector:'app-account-unavailable',standalone:true,imports:[CommonModule,TranslateModule],
  template:`<main class="account-unavailable" role="alert" *ngIf="access.state$ | async as state">
    <section><div class="lock" aria-hidden="true">&#128274;</div>
      <h1>{{ ('ACCOUNT_ACCESS_' + state.status + '_TITLE') | translate }}</h1>
      <p>{{ ('ACCOUNT_ACCESS_' + state.status + '_MESSAGE') | translate }}</p>
      <p class="reason" *ngIf="state.status === 'BLOCKED' && reasons.includes(state.reason || '')">{{ 'COACH_BLOCK_REASON' | translate }}: {{ ('COACH_REASON_' + state.reason) | translate }}</p>
      <div><button type="button" (click)="retry()" [disabled]="checking">{{ (checking ? 'ACCOUNT_ACCESS_CHECKING_TITLE' : 'ACCOUNT_ACCESS_RECHECK') | translate }}</button>
      <button type="button" class="secondary" (click)="logout()">{{ 'ACCOUNT_ACCESS_LOGOUT' | translate }}</button></div>
    </section></main>`,
  styles:[`.account-unavailable{min-height:100vh;display:grid;place-items:center;padding:24px;background:#f8fafc;color:#020c20}section{max-width:540px;text-align:center;background:white;border:1px solid #e2e8f0;border-radius:16px;padding:40px 28px}.lock{font-size:36px;margin-bottom:20px}h1{font-size:25px;margin-bottom:18px}p{color:#64748b;line-height:1.7}.reason{background:#fff8e6;padding:12px;border-radius:8px}button{border:0;background:#020c20;color:white;border-radius:8px;padding:12px 18px;margin:16px 4px 0;cursor:pointer}.secondary{background:#eef2f7;color:#334155}button:disabled{opacity:.5}button:focus-visible{outline:2px solid #0ea5e9;outline-offset:3px}`]})
export class AccountUnavailableComponent implements OnInit {
  checking=false;
  readonly reasons=['MANUAL_ADMIN_BLOCK','SUBSCRIPTION_EXPIRED','PAYMENT_PROBLEM','OTHER'];
  constructor(public access:AccountAccessService,private auth:AuthService,private router:Router) {}
  ngOnInit() { if(this.access.state$.value.status === 'ACTIVE') {this.access.state$.next({status:'CHECKING'});void this.retry();} }
  async retry() { if(this.checking)return; this.checking=true; try { if(await this.access.refresh()) await this.router.navigateByUrl('/coach-dashboard'); } finally {this.checking=false;} }
  logout() { this.auth.logout(); }
}
