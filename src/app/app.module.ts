import {APP_INITIALIZER, importProvidersFrom, NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {BrowserAnimationsModule, provideAnimations} from '@angular/platform-browser/animations';
import {KeycloakAngularModule, KeycloakService} from "keycloak-angular";
import {
  HTTP_INTERCEPTORS,
  HttpClient,
  HttpClientModule,
  provideHttpClient,
  withInterceptorsFromDi
} from "@angular/common/http";
import {CommonModule, HashLocationStrategy, LocationStrategy} from "@angular/common";
import {provideRouter, RouterModule} from "@angular/router";
import {PageLoaderComponent} from "./template/layout/page-loader/page-loader.component";
import {APP_ROUTE} from "./app.routes";
import {provideToastr, ToastrModule} from "ngx-toastr";
import {AuthInterceptor} from "@config/AuthInterceptor";
import {LanguageService} from "./template/core";
import {TranslateLoader, TranslateModule} from "@ngx-translate/core";
import {TranslateHttpLoader} from '@ngx-translate/http-loader';
import {FeatherModule} from "angular-feather";
import {allIcons} from "angular-feather/icons";
import {createTranslateLoader} from "./app.config";
import {InfiniteScrollModule} from "ngx-infinite-scroll";
import {NgxSpinnerModule} from "ngx-spinner";
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {NgxDatatableModule} from '@swimlane/ngx-datatable';
import {MatDialogModule} from '@angular/material/dialog'
import { environment} from "@env/environment";

export function HttpLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

function initializeKeycloak(keycloak: KeycloakService) {
  return () => {
    console.log('Initializing Keycloak...');
    return keycloak.init({
      config: {
        url: 'http://54.38.35.221:9081',
        realm: 'yo-coach',
        clientId: 'front-app'
      },
      initOptions: {
        onLoad: 'check-sso',
        checkLoginIframe: false,
        silentCheckSsoRedirectUri: window.location.origin + '/assets/silent-check-sso.html'
      }
    }).then(authenticated => {
      console.log('Keycloak initialized. Authenticated:', authenticated);
      return authenticated;
    }).catch(error => {
      console.error('Keycloak initialization failed:', error);
      return false;
    });
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
      useFactory: initializeKeycloak,
      multi: true,
      deps: [KeycloakService]
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
}
