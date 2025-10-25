// app.routes.ts

import {CanActivateFn, Route} from '@angular/router';
import { MainLayoutComponent } from './template/layout/app-layout/main-layout/main-layout.component';
import {RegisterComponent} from "./template/layout/register/register.component";
import {inject} from "@angular/core";
import {AuthGuard} from "@config/guard/auth.guard";

const isAuthenticated: CanActivateFn = (route, state) =>
  inject(AuthGuard).isAccessAllowed(route, state);

export const APP_ROUTE: Route[] = [
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [isAuthenticated]

  },
  {
    path: 'register',
    component: RegisterComponent
  }


];
