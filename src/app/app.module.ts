import { CommonModule } from '@angular/common';
import {
  HTTP_INTERCEPTORS,
  HttpClient,
  HttpClientModule,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { APP_INITIALIZER, importProvidersFrom, NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule } from '@angular/material/dialog';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule, provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, RouterModule } from '@angular/router';
import { AuthInterceptor } from '@config/AuthInterceptor';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { NgxDatatableModule } from '@swimlane/ngx-datatable';
import { FeatherModule } from 'angular-feather';
import { allIcons } from 'angular-feather/icons';
import { KeycloakAngularModule, KeycloakService } from 'keycloak-angular';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { NgxSpinnerModule } from 'ngx-spinner';
import { provideToastr, ToastrModule } from 'ngx-toastr';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { createTranslateLoader } from './app.config';
import { APP_ROUTE } from './app.routes';
import { LanguageService } from './template/core';
import { PageLoaderComponent } from './template/layout/page-loader/page-loader.component';
import {firstValueFrom} from "rxjs";
import {AuthService} from "@config/auth.service";
import {environment} from "@env/environment";

export function HttpLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}
function isPublicCoachHostname(host: string): boolean {
  if (!host) return false;

  const normalized = host.toLowerCase();

  const privateHosts = [
    'localhost',

    'integration.yo-coach.app',
    'www.integration.yo-coach.app',

    'account.yo-coach.app',
    'www.account.yo-coach.app',

    'login.yo-coach.app',
    'www.login.yo-coach.app',

    'login-int.yo-coach.app',
    'www.login-int.yo-coach.app',

    'minio.yo-coach.app',
    'www.minio.yo-coach.app',

    'minio-int.yo-coach.app',
    'www.minio-int.yo-coach.app',

    'minio-console.yo-coach.app',
    'www.minio-console.yo-coach.app',

    'minio-console-int.yo-coach.app',
    'www.minio-console-int.yo-coach.app',

    'yo-coach.app',
    'www.yo-coach.app'
  ];

  if (normalized.startsWith('localhost')) {
    return false;
  }

  if (privateHosts.includes(normalized)) {
    return false;
  }

  return normalized.endsWith('.yo-coach.app');
}

function initializeKeycloakAndSync(
  keycloak: KeycloakService,
  authService: AuthService,
  http: HttpClient
) {
  return async () => {
    const host = window.location.hostname;
    const path = window.location.pathname;

    const publicPaths = [
      '/video-viewer',
    ];

    const isPublicPath = publicPaths.some((publicPath) =>
      path.startsWith(publicPath)
    );

    if (isPublicPath) {
      console.log('Public page detected, skipping Keycloak init:', path);
      return true;
    }

    const isPublicHost = isPublicCoachHostname(host);

    if (isPublicHost) {
      console.log('Public coach website detected, skipping Keycloak init');
      return true;
    }

    console.log('Initializing Keycloak...');

    const authenticated = await keycloak.init({
      config: {
        url: 'https://login-int.yo-coach.app',
        realm: 'yo-coach',
        clientId: 'front-app',
      },
      initOptions: {
        onLoad: 'check-sso',
        checkLoginIframe: false,
      },
    }).catch(err => {
      console.error('Keycloak initialization failed:', err);
      return false;
    });

    if (authenticated) {
      await authService.storeUserInfo();
      console.log('Keycloak initialized. Authenticated:', authenticated);

      try {
        const user = await firstValueFrom(
          http.post<any>(`${environment.baseApiUrl}/public/sync`, {})
        );

        if (user && user.id) {
          sessionStorage.setItem('userId', user.id);
          console.log('User synced with backend:', user);
        }
      } catch (err) {
        console.error('Error syncing user with backend:', err);
      }
    }

    return authenticated;
  };
}


@NgModule({
  declarations: [
    AppComponent,
  ],
  imports: [
    BrowserAnimationsModule,
    CommonModule,
    RouterModule,
    PageLoaderComponent,
    KeycloakAngularModule,
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    KeycloakAngularModule,
    HttpClientModule,
    InfiniteScrollModule,
    NgxSpinnerModule,
    FormsModule,
    ReactiveFormsModule,
    NgxDatatableModule,
    MatDialogModule,
    ToastrModule.forRoot({
      positionClass: 'toast-top-right',
      preventDuplicates: true,
    }),
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: HttpLoaderFactory,
        deps: [HttpClient]
      }
    })
  ],
  providers: [
    KeycloakService,
    provideHttpClient(withInterceptorsFromDi()),
    provideRouter(APP_ROUTE),
    provideToastr(),
    provideAnimations(),
    // {provide: LocationStrategy, useClass: HashLocationStrategy},
    {provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true},
    LanguageService,
    importProvidersFrom(
      TranslateModule.forRoot({
        defaultLanguage: 'fr',
        loader: {
          provide: TranslateLoader,
          useFactory: createTranslateLoader,
          deps: [HttpClient],
        },
      })
    ),
    importProvidersFrom(FeatherModule.pick(allIcons)),
    {



      provide: APP_INITIALIZER,
      useFactory: initializeKeycloakAndSync,
      multi: true,
      deps: [KeycloakService, AuthService, HttpClient]
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
}
