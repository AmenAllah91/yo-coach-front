// app.config.ts

import {HTTP_INTERCEPTORS, HttpClient, provideHttpClient, withInterceptorsFromDi} from '@angular/common/http';
import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { APP_ROUTE } from './app.routes';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { HashLocationStrategy, LocationStrategy } from '@angular/common';
import {LanguageService } from 'app/template/core';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { FeatherModule } from 'angular-feather';
import { allIcons } from 'angular-feather/icons';
import { sidebarIcons } from './template/layout/sidebar/sidebar-icons';
import { taskIcons } from './components/clients/profil-client/client-tasks-tab/task-icons';
import { provideToastr } from 'ngx-toastr';
import {AuthInterceptor} from "@config/AuthInterceptor";
import {KeycloakService} from "keycloak-angular";

// assets/i18n/*.json are not content-hashed by the build, so a browser can keep an
// older copy while the new bundle already uses new keys (raw keys in the UI).
// Versioning the URL per app load always fetches the translations shipped with the bundle.
const TRANSLATIONS_VERSION = Date.now();

export function createTranslateLoader(http: HttpClient): TranslateHttpLoader {
    return new TranslateHttpLoader(http, './assets/i18n/', `.json?v=${TRANSLATIONS_VERSION}`);
}

export const appConfig: ApplicationConfig = {
    providers: [
        KeycloakService,
        provideHttpClient( withInterceptorsFromDi()),
        provideRouter(APP_ROUTE),
        provideToastr(),
        provideAnimations(),
        { provide: LocationStrategy, useClass: HashLocationStrategy },
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
        LanguageService,
        importProvidersFrom(
            TranslateModule.forRoot({
                defaultLanguage: 'en',
                loader: {
                    provide: TranslateLoader,
                    useFactory: createTranslateLoader,
                    deps: [HttpClient],
                },
            })
        ),
        importProvidersFrom(FeatherModule.pick({ ...allIcons, ...sidebarIcons, ...taskIcons }))
    ],

};
