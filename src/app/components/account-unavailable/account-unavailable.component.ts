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
  styles:[`.account-unavailable{min-height:100vh;display:grid;place-items:center;padding:24px;background:light-dark(#f8fafc, #171a1f);color:light-dark(#020c20, #e9eff9)}section{max-width:540px;text-align:center;background:light-dark(white, #1d2125);border:1px solid light-dark(#e2e8f0, #34393f);border-radius:16px;padding:40px 28px}.lock{font-size:36px;margin-bottom:20px}h1{font-size:25px;margin-bottom:18px}p{color:light-dark(#64748b, #a5abb4);line-height:1.7}.reason{background:light-dark(#fff8e6, #372c0c);padding:12px;border-radius:8px}button{border:0;background:#020c20;color:white;border-radius:8px;padding:12px 18px;margin:16px 4px 0;cursor:pointer}.secondary{background:light-dark(#eef2f7, #14171b);color:light-dark(#334155, #d1d7e0)}button:disabled{opacity:.5}button:focus-visible{outline:2px solid #0ea5e9;outline-offset:3px}`]})
export class AccountUnavailableComponent implements OnInit {
  checking=false;
  readonly reasons=['MANUAL_ADMIN_BLOCK','SUBSCRIPTION_EXPIRED','PAYMENT_PROBLEM','OTHER'];
  constructor(public access:AccountAccessService,private auth:AuthService,private router:Router) {}
  ngOnInit() { if(this.access.state$.value.status === 'ACTIVE') {this.access.state$.next({status:'CHECKING'});void this.retry();} }
  async retry() { if(this.checking)return; this.checking=true; try { if(await this.access.refresh()) await this.router.navigateByUrl('/coach-dashboard'); } finally {this.checking=false;} }
  logout() { this.auth.logout(); }
}
