// app.routes.ts

import {CanActivateFn, Route} from '@angular/router';
import { MainLayoutComponent } from './template/layout/app-layout/main-layout/main-layout.component';
import {RegisterComponent} from "./template/layout/register/register.component";
import { ExerciseLibraryComponent } from './components/exercise-library/exercise-library.component';
import { ClientsComponent } from './template/clients.component';
import { ProgramLibraryComponent } from './components/program-library/program-library.component';
import {inject} from "@angular/core";
import {AuthGuard} from "@config/guard/auth.guard";

const isAuthenticated: CanActivateFn = (route, state) =>
  inject(AuthGuard).isAccessAllowed(route, state);

export const APP_ROUTE: Route[] = [
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [isAuthenticated],
    children: [
      {
        path: 'workout/exercise-library',
        component: ExerciseLibraryComponent
      },
      {
        path: 'clients',
        component: ClientsComponent
      },
      {
        path: 'workout/program-library',
        component: ProgramLibraryComponent
      }
    ]
  },
  {
    path: 'register',
    component: RegisterComponent
  }
];
