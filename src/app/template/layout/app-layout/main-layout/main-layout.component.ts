import { Component, OnInit, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { HeaderComponent } from '../../header/header.component';
import { InConfiguration } from '../../../core';
import { NgClass } from '@angular/common';
import { CoachSettingsService } from 'app/service/coach-settings.service';
import { LanguageService } from 'app/service/language.service';
import { TranslateModule } from '@ngx-translate/core';
import { SubscriptionNoticeComponent } from 'app/components/subscription-notice/subscription-notice.component';
import { SubscriptionBannerComponent } from 'app/components/subscription-banner/subscription-banner.component';

@Component({
  selector: 'app-main-layout',
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.scss'],
  standalone: true,
  imports: [
    HeaderComponent,
    SidebarComponent,
    RouterOutlet,
    NgClass,
    TranslateModule,
    SubscriptionNoticeComponent,
    SubscriptionBannerComponent,
  ],
})
export class MainLayoutComponent implements OnInit {
  public config!: InConfiguration;
  isSidebarOpen = window.innerWidth >= 1024;
  @ViewChild('sidebar') sidebar?: SidebarComponent;

  constructor(
    private coachSettingsService: CoachSettingsService,
    private languageService: LanguageService,
  ) {}

  ngOnInit(): void {
    const storedLanguage = localStorage.getItem('lang');
    if (storedLanguage && this.languageService.languages.includes(storedLanguage)) {
      return;
    }

    this.coachSettingsService.loadConfig().subscribe({
      next: (config) => {
        const langCode = this.languageService.languageNameToCode(
          config.defaults.language,
        );

        this.languageService.setLanguage(langCode);
      },
      error: () => {},
    });
  }

  handleSidebarToggle(isOpen: boolean) {
    this.isSidebarOpen = isOpen;
  }

  closeSidebar() {
    this.sidebar?.closeSidebar();
  }

  toggleSidebar() {
    this.sidebar?.toggleSidebar();
  }
}
