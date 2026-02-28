import { AssignFullPlanComponent } from './components/nutrition/assign-full-plan/assign-full-plan.component';
import { AssignMacroPlanTotalDayComponent } from './components/nutrition/assign-macro-plan-total-day/assign-macro-plan-total-day.component';
import { AssignMacroPlanComponent } from './components/nutrition/assign-macro-plan/assign-macro-plan.component';
// app.routes.ts

import { CanActivateFn, Route } from '@angular/router';
import { MainLayoutComponent } from './template/layout/app-layout/main-layout/main-layout.component';
import { RegisterComponent } from './template/layout/register/register.component';
import { ExerciseLibraryComponent } from './components/exercise-library/exercise-library.component';
import { ClientsComponent } from './template/clients.component';
import { ProgramLibraryComponent } from './components/program-library/program-library.component';
import { FoodsComponent } from './components/nutrition/foods/foods.component';
import { CustomFoodsComponent } from './components/nutrition/custom-foods/custom-foods.component';
import { NutritionPlansComponent } from './components/nutrition/nutrition-plans/nutrition-plans.component';
import { CreateMacroPlanComponent } from './components/nutrition/create-macro-plan/create-macro-plan.component';
import { CreateFullPlanComponent } from './components/nutrition/create-full-plan/create-full-plan.component';

import { inject } from '@angular/core';
import { AuthGuard } from '@config/guard/auth.guard';
import { CreateMacroPlanTotalDayComponent } from './components/nutrition/create-macro-plan-total-day/create-macro-plan-total-day.component';
import { CreateWorkoutComponent } from './components/program-library/create-workout/create-workout.component';
import { CreateFormComponent } from './components/forms/create-form/create-form.component';
import { ProfilClientComponent } from './components/clients/profil-client/profil-client.component';
import { ClientWorkoutsComponent } from './components/clients/client-workouts/client-workouts.component';
import { ClientNutritionComponent } from './components/clients/client-nutrition/client-nutrition.component';
import { CalendarClientsComponent } from './components/calendar/calendar-clients/calendar-clients.component';
import { LandingPageComponent } from './components/website/landing-page/landing-page.component';
import { YosoftLandingPageComponent } from './components/website/yosoft-landing-page/yosoft-landing-page.component';
import {CoachDashboardComponent} from "./components/coach-dashboard/coach-dashboard.component";
import {ClientDashboardComponent} from "./components/clients/client-dashboard/client-dashboard.component";
import { CreateAndAssignComponent } from './components/program-library/create-and-assign/create-and-assign.component';
import {FormsListComponent} from "./components/forms/forms-list/forms-list.component";
import {MyAssignmentsComponent} from "./components/forms/my-assignments-component/my-assignments.component";
import {AssignmentFillComponent} from "./components/forms/assignment-fill-component/assignment-fill.component";
import {MyCheckinsComponent} from "./components/forms/my-checkins/my-checkins.component";
import {ManageCheckinsComponent} from "./components/forms/manage-checkins/manage-checkins.component";
import {ChatComponent} from "./components/chat/chat/chat.component";
import {InvitationComponent} from "./components/clients/invitation/invitation.component";

const isAuthenticated: CanActivateFn = (route, state) =>
  inject(AuthGuard).isAccessAllowed(route, state);

export const APP_ROUTE: Route[] = [
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [isAuthenticated],
    children: [
      {
        path: 'forms/create-form',
        component: CreateFormComponent,
      },
      { path: 'assignments/me', component: MyAssignmentsComponent },
      { path: 'assignments/:id/fill', component: AssignmentFillComponent },
      {
        path: 'forms/:id/edit',
        component: CreateFormComponent,
      },
      { path: 'forms', component: FormsListComponent },
      {
        path: 'workout/exercise-library',
        component: ExerciseLibraryComponent,
      },
      {
        path: 'clients',
        component: ClientsComponent,
      },
      {
        path: 'clients/profil-client/:id',
        component: ProfilClientComponent,
      },
      {
        path: 'clients/client-workouts',
        component: ClientWorkoutsComponent,
      },
      {
        path: 'clients/client-nutrition',
        component: ClientNutritionComponent,
      },
      {
        path: 'workout/program-library',
        component: ProgramLibraryComponent,
      },
      {
        path: 'workout/create-workout',
        component: CreateWorkoutComponent,
      },
      {
        path: 'clients/create-workout/:idClient',
        component: CreateAndAssignComponent,
      },
      {
        path: 'clients/create-workout/:idClient/edit/:id',
        component: CreateAndAssignComponent,
      },
      {
        path: 'workout/edit-workout/:id',
        component: CreateWorkoutComponent,
      },
      {
        path: 'calendar',
        component: CalendarClientsComponent,
      },
      {
        path: 'nutrition/foods',
        component: FoodsComponent,
      },
      {
        path: 'nutrition/custom-foods',
        component: CustomFoodsComponent,
      },
      {
        path: 'nutrition/plans',
        component: NutritionPlansComponent,
      },
      {
        path: 'nutrition/create-macro-plan',
        component: CreateMacroPlanComponent,
      },
      {
        path: 'nutrition/create-macro-plan/:id',
        component: CreateMacroPlanComponent,
      },
      {
        path: 'nutrition/create-macro-plan-total-day',
        component: CreateMacroPlanTotalDayComponent,
      },
      {
        path: 'clients/create-macro-plan/:idClient',
        component: AssignMacroPlanComponent,
      },
      {
        path: 'clients/create-macro-plan/:idClient/edit/:id',
        component: AssignMacroPlanComponent,
      },
      {
        path: 'clients/create-macro-plan-total-day/:idClient',
        component: AssignMacroPlanTotalDayComponent,
      },
      {
        path: 'clients/create-macro-plan-total-day/:idClient/edit/:id',
        component: AssignMacroPlanTotalDayComponent,
      },
      {
        path: 'clients/create-full-plan/:idClient',
        component: AssignFullPlanComponent,
      },
      {
        path: 'clients/create-full-plan/:idClient/edit/:id',
        component: AssignFullPlanComponent,
      },
      {
        path: 'nutrition/create-macro-plan-total-day/:id',
        component: CreateMacroPlanTotalDayComponent,
      },
      {
        path: 'nutrition/create-full-plan',
        component: CreateFullPlanComponent,
      },
      {
        path: 'nutrition/create-full-plan/:id',
        component: CreateFullPlanComponent,
      },
      // {
      //   path: 'form/create-form',
      //   component: CreateFormComponent,
      // },
      {
        path: 'coach-dashboard',
        component: CoachDashboardComponent,
      },
      {
        path: 'client-dashboard',
        component: ClientDashboardComponent,
      },{
        path: 'forms/my-checkins',
        component: MyCheckinsComponent,
      },{
        path: 'forms/manage-checkins',
        component: ManageCheckinsComponent,
      },{
        path: 'chat',
        component: ChatComponent,
      },{
        path: 'invitation/:token',
        component: InvitationComponent,
      },
    ],
  },
  {
    path: 'register',
    component: RegisterComponent,
  },
  {
    path: 'landing-page',
    component: LandingPageComponent,
  },
  {
    path: 'yosoft-landing-page',
    component: YosoftLandingPageComponent,
  }
];
