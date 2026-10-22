import { accountAccessGuard } from './config/guard/account-access.guard';
import { coachingAccessGuard } from './config/guard/coaching-access.guard';
// app.routes.ts

import { CanActivateFn, Route } from '@angular/router';
import { adminGuard, coachDiagnosticsGuard } from './config/guard/admin.guard';
import { MainLayoutComponent } from './template/layout/app-layout/main-layout/main-layout.component';

import { inject } from '@angular/core';
import { AuthGuard } from '@config/guard/auth.guard';
import { coachOnboardingEntryGuard, coachOnboardingGuard } from './config/guard/coach-onboarding.guard';
import { clientOnboardingEntryGuard, clientOnboardingGuard } from './config/guard/client-onboarding.guard';

const isAuthenticated: CanActivateFn = (route, state) =>
  inject(AuthGuard).isAccessAllowed(route, state);

export const APP_ROUTE: Route[] = [
  { path: 'account-unavailable', canActivate: [isAuthenticated], loadComponent: () => import('./components/account-unavailable/account-unavailable.component').then(m=>m.AccountUnavailableComponent) },
  { path: 'coaching-unavailable', loadComponent: () => import('./components/clients/coaching-unavailable.component').then((m) => m.CoachingUnavailableComponent), canActivate: [isAuthenticated] },
  {
    path: 'invitation/:token',
    loadComponent: () => import('./components/clients/invitation/invitation.component').then((m) => m.InvitationComponent),
  },
  {
    path: 'coach-onboarding',
    loadComponent: () => import('./components/coach-onboarding/coach-onboarding.component').then((m) => m.CoachOnboardingComponent),
    canActivate: [isAuthenticated, accountAccessGuard, coachingAccessGuard, coachOnboardingEntryGuard],
  },
  {
    path: 'client-onboarding',
    loadComponent: () => import('./components/client-onboarding/client-onboarding.component').then((m) => m.ClientOnboardingComponent),
    canActivate: [isAuthenticated, accountAccessGuard, coachingAccessGuard, clientOnboardingEntryGuard],
  },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [isAuthenticated, accountAccessGuard, coachingAccessGuard, coachOnboardingGuard, clientOnboardingGuard],
    canActivateChild: [accountAccessGuard, coachingAccessGuard],
    children: [
      {path:'admin/subscriptions',canActivate:[adminGuard],data:{mode:'subscriptions'},loadComponent:()=>import('./components/admin/billing/admin-billing.component').then(m=>m.AdminBillingComponent)},
      {path:'admin/plans',canActivate:[adminGuard],data:{mode:'plans'},loadComponent:()=>import('./components/admin/billing/admin-billing.component').then(m=>m.AdminBillingComponent)},
      {path:'admin/payments',canActivate:[adminGuard],loadComponent:()=>import('./components/admin/payments/admin-payments.component').then(m=>m.AdminPaymentsComponent)},
      {path:'admin/foods',redirectTo:'nutrition/custom-foods',pathMatch:'full'},
      {path:'admin/history',canActivate:[adminGuard],loadComponent:()=>import('./components/admin/history/admin-history.component').then(m=>m.AdminHistoryComponent)},
      {
        path: 'admin/coaches', canActivate: [coachDiagnosticsGuard],
        loadComponent: () => import('./components/admin/coaches/admin-coaches.component').then(m => m.AdminCoachesComponent),
      },
      {
        path: 'admin/coaches/:id', canActivate: [coachDiagnosticsGuard],
        loadComponent: () => import('./components/admin/coaches/admin-coaches.component').then(m => m.AdminCoachesComponent),
      },
      {
        path: 'admin/dashboard',
        canActivate: [adminGuard],
        loadComponent: () => import('./components/admin/dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent),
      },
      {
        path: 'forms/create-form',
        loadComponent: () => import('./components/forms/create-form/create-form.component').then((m) => m.CreateFormComponent),
      },
      { path: 'assignments/me', loadComponent: () => import('./components/forms/my-assignments-component/my-assignments.component').then((m) => m.MyAssignmentsComponent) },
      { path: 'assignments/:id/fill', loadComponent: () => import('./components/forms/assignment-fill-component/assignment-fill.component').then((m) => m.AssignmentFillComponent) },
      {
        path: 'forms/:id/edit',
        loadComponent: () => import('./components/forms/create-form/create-form.component').then((m) => m.CreateFormComponent),
      },
      { path: 'forms', loadComponent: () => import('./components/forms/forms-list/forms-list.component').then((m) => m.FormsListComponent) },
      {
        path: 'workout/exercise-library',
        loadComponent: () => import('./components/exercise-library/exercise-library.component').then((m) => m.ExerciseLibraryComponent),
      },
      {
        path: 'clients',
        loadComponent: () => import('./template/clients.component').then((m) => m.ClientsComponent),
      },
      {
        path: 'clients/profil-client/:id',
        loadComponent: () => import('./components/clients/profil-client/profil-client.component').then((m) => m.ProfilClientComponent),
      },
      {
        path: 'clients/client-workouts',
        loadComponent: () => import('./components/clients/client-workouts/client-workouts.component').then((m) => m.ClientWorkoutsComponent),
      },
      {
        path: 'clients/client-nutrition',
        loadComponent: () => import('./components/clients/client-nutrition/client-nutrition.component').then((m) => m.ClientNutritionComponent),
      },
      {
        path: 'workout/program-library',
        loadComponent: () => import('./components/program-library/program-library.component').then((m) => m.ProgramLibraryComponent),
      },
      {
        path: 'workout/create-workout',
        loadComponent: () => import('./components/program-library/create-workout/create-workout.component').then((m) => m.CreateWorkoutComponent),
      },
      {
        path: 'clients/create-workout/:idClient',
        loadComponent: () => import('./components/program-library/create-and-assign/create-and-assign.component').then((m) => m.CreateAndAssignComponent),
      },
      {
        path: 'clients/create-workout/:idClient/edit/:id',
        loadComponent: () => import('./components/program-library/create-and-assign/create-and-assign.component').then((m) => m.CreateAndAssignComponent),
      },
      {
        path: 'workout/edit-workout/:id',
        loadComponent: () => import('./components/program-library/create-workout/create-workout.component').then((m) => m.CreateWorkoutComponent),
      },
      {
        path: 'calendar',
        loadComponent: () => import('./components/calendar/calendar-clients/calendar-clients.component').then((m) => m.CalendarClientsComponent),
      },
      {
        path: 'nutrition/foods',
        loadComponent: () => import('./components/nutrition/foods/foods.component').then((m) => m.FoodsComponent),
      },
      {
        path: 'nutrition/custom-foods',
        loadComponent: () => import('./components/nutrition/custom-foods/custom-foods.component').then((m) => m.CustomFoodsComponent),
      },
      {
        path: 'nutrition/meals',
        loadComponent: () => import('./components/nutrition/meals/meals-list.component').then(m => m.MealsListComponent),
      },
      {
        path: 'nutrition/meals/create',
        loadComponent: () => import('./components/nutrition/meals/meal-editor.component').then(m => m.MealEditorComponent),
      },
      {
        path: 'nutrition/meals/:id',
        loadComponent: () => import('./components/nutrition/meals/meal-editor.component').then(m => m.MealEditorComponent),
      },
      {
        path: 'nutrition/food-replacement-groups',
        loadComponent: () => import('./components/nutrition/food-replacement-groups/food-replacement-groups.component').then((m) => m.FoodReplacementGroupsComponent),
      },
      {
        path: 'nutrition/plans',
        loadComponent: () => import('./components/nutrition/nutrition-plans/nutrition-plans.component').then((m) => m.NutritionPlansComponent),
      },
      {
        path: 'nutrition/create-macro-plan',
        loadComponent: () => import('./components/nutrition/create-macro-plan/create-macro-plan.component').then((m) => m.CreateMacroPlanComponent),
      },
      {
        path: 'nutrition/create-macro-plan/:id',
        loadComponent: () => import('./components/nutrition/create-macro-plan/create-macro-plan.component').then((m) => m.CreateMacroPlanComponent),
      },
      {
        path: 'nutrition/create-macro-plan-total-day',
        loadComponent: () => import('./components/nutrition/create-macro-plan-total-day/create-macro-plan-total-day.component').then((m) => m.CreateMacroPlanTotalDayComponent),
      },
      {
        path: 'clients/create-macro-plan/:idClient',
        loadComponent: () => import('./components/nutrition/assign-macro-plan/assign-macro-plan.component').then((m) => m.AssignMacroPlanComponent),
      },
      {
        path: 'clients/create-macro-plan/:idClient/edit/:id',
        loadComponent: () => import('./components/nutrition/assign-macro-plan/assign-macro-plan.component').then((m) => m.AssignMacroPlanComponent),
      },
      {
        path: 'clients/create-macro-plan-total-day/:idClient',
        loadComponent: () => import('./components/nutrition/assign-macro-plan-total-day/assign-macro-plan-total-day.component').then((m) => m.AssignMacroPlanTotalDayComponent),
      },
      {
        path: 'clients/create-macro-plan-total-day/:idClient/edit/:id',
        loadComponent: () => import('./components/nutrition/assign-macro-plan-total-day/assign-macro-plan-total-day.component').then((m) => m.AssignMacroPlanTotalDayComponent),
      },
      {
        path: 'clients/create-full-plan/:idClient',
        loadComponent: () => import('./components/nutrition/assign-full-plan/assign-full-plan.component').then((m) => m.AssignFullPlanComponent),
      },
      {
        path: 'clients/create-full-plan/:idClient/edit/:id',
        loadComponent: () => import('./components/nutrition/assign-full-plan/assign-full-plan.component').then((m) => m.AssignFullPlanComponent),
      },
      {
        path: 'nutrition/create-macro-plan-total-day/:id',
        loadComponent: () => import('./components/nutrition/create-macro-plan-total-day/create-macro-plan-total-day.component').then((m) => m.CreateMacroPlanTotalDayComponent),
      },
      {
        path: 'nutrition/create-full-plan',
        loadComponent: () => import('./components/nutrition/create-full-plan/create-full-plan.component').then((m) => m.CreateFullPlanComponent),
      },
      {
        path: 'nutrition/create-full-plan/:id',
        loadComponent: () => import('./components/nutrition/create-full-plan/create-full-plan.component').then((m) => m.CreateFullPlanComponent),
      },
      {
        path: 'grow/contact-form',
        loadComponent: () => import('./components/website/contact-form-manager/contact-form-manager.component').then((m) => m.ContactFormManagerComponent),
      },
      {
        path: 'websites/create',
        loadComponent: () => import('./components/website/website-builder/website-builder.component').then((m) => m.WebsiteBuilderComponent),
      },
      {
        path: 'websites/leads',
        loadComponent: () => import('./components/website/website-leads/website-leads.component').then((m) => m.WebsiteLeadsComponent)
      },
      {
        path: 'coach-dashboard',
        loadComponent: () => import('./components/coach-dashboard/coach-dashboard.component').then((m) => m.CoachDashboardComponent),
      },
      {
        path: 'coach-dashboard/activities',
        loadComponent: () => import('./components/coach-dashboard/all-activities/all-activities.component').then((m) => m.AllActivitiesComponent),
      },
      {
        // SUB-37: "My subscription".
        path: 'subscription',
        loadComponent: () => import('./components/my-subscription/my-subscription.component').then(m => m.MySubscriptionComponent),
      },
      {
        // SUB-36: "Pay my invoice" link of the billing emails.
        path: 'billing/pay',
        loadComponent: () => import('./components/pay-invoice/pay-invoice.component').then(m => m.PayInvoiceComponent),
      },
      {
        // SUB-23: return from Flouci (the payment service redirects here).
        path: 'payment/success',
        data: { outcome: 'success' },
        loadComponent: () => import('./components/payment-return/payment-return.component').then(m => m.PaymentReturnComponent),
      },
      {
        path: 'payment/failed',
        data: { outcome: 'failed' },
        loadComponent: () => import('./components/payment-return/payment-return.component').then(m => m.PaymentReturnComponent),
      },
      {
        // SUB-46: plan-change screen (from "My subscription" and the client-limit notice).
        path: 'subscription/change-plan',
        loadComponent: () => import('./components/change-plan/change-plan.component').then(m => m.ChangePlanComponent),
      },
      {
        // SUB-22: payment screen ("Upgrade to a paid plan" in the sidebar).
        path: 'subscription/checkout',
        loadComponent: () => import('./components/subscription-checkout/subscription-checkout.component').then(m => m.SubscriptionCheckoutComponent),
      },
      {
        path: 'tasks',
        loadComponent: () => import('./components/clients/my-tasks/my-tasks.component').then(m => m.MyTasksComponent),
      },
      {
        path: 'client-dashboard',
        loadComponent: () => import('./components/clients/client-dashboard/client-dashboard.component').then((m) => m.ClientDashboardComponent),
      },{
        path: 'forms/my-checkins',
        loadComponent: () => import('./components/forms/my-checkins/my-checkins.component').then((m) => m.MyCheckinsComponent),
      },{
        path: 'forms/manage-checkins',
        loadComponent: () => import('./components/forms/manage-checkins/manage-checkins.component').then((m) => m.ManageCheckinsComponent),
      },{
        path: 'chat',
        loadComponent: () => import('./components/chat/chat/chat.component').then((m) => m.ChatComponent),
      },{
        path: 'edit-profile/:id',
        loadComponent: () => import('./components/profile/edit-profile/edit-profile.component').then((m) => m.EditProfileComponent),
      },{
        path: 'subscriptions',
        redirectTo: 'admin/subscriptions', pathMatch: 'full',
      },{
        path: 'users',
        loadComponent: () => import('./components/admin/users/users.component').then((m) => m.UsersComponent),
      },
      {
        // Client page (the coach sees the pictures inside the client profile).
        path: 'progress-pictures',
        loadComponent: () => import('./components/clients/client-progress/client-progress.component').then((m) => m.ClientProgressComponent),
      },
      {
        // Client page (the coach sees the measurements inside the client profile).
        path: 'body-measurements',
        loadComponent: () => import('./components/clients/client-measurements/client-measurements.component').then((m) => m.ClientMeasurementsComponent),
      },
      {
        path: 'configuration',
        loadComponent: () => import('./components/configuration-coachng/configuration-coachng.component').then((m) => m.ConfigurationCoachngComponent),
      },
      {
        path: 'theme',
        loadComponent: () => import('./components/theme/theme-colors/theme-colors.component').then((m) => m.ThemeColorsComponent),
      },
    ],
  },
  {
    path: 'register',
    loadComponent: () => import('./template/layout/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'landing-page',
    loadComponent: () => import('./components/website/landing-page/landing-page.component').then((m) => m.LandingPageComponent),
  },
  {
    path: 'plans-landing',
    loadComponent: () => import('./components/website/plans-landing-page/plans-landing-page.component').then((m) => m.PlansLandingPageComponent),
  },
  {
    path: 'yosoft-landing-page',
    loadComponent: () => import('./components/website/yosoft-landing-page/yosoft-landing-page.component').then((m) => m.YosoftLandingPageComponent),
  },
  {
    path: 'websites/preview',
    loadComponent: () => import('./components/website/coach-landing-preview-page/coach-landing-preview-page.component').then((m) => m.CoachLandingPreviewPageComponent)
  },
  {
    path: 'site',
    loadComponent: () => import('./components/website/public-website/public-website.component').then((m) => m.PublicWebsiteComponent)
  },
  {
    path: 'contact/:slug',
    loadComponent: () => import('./components/website/public-contact-form/public-contact-form.component').then((m) => m.PublicContactFormComponent),
  },
  {
    path: 'video-viewer',
    loadComponent: () => import('./components/video-viewer/video-viewer.component').then((m) => m.VideoViewerComponent),
  },

];
