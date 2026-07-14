import { Component, OnInit, ViewChild } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { HeaderComponent } from '../../header/header.component';
import { InConfiguration } from '../../../core';
import { NgClass, NgIf } from '@angular/common';
import { CoachSettingsService } from 'app/service/coach-settings.service';
import { LanguageService } from 'app/service/language.service';
import { BackButtonComponent } from 'app/shared/components/back-button/back-button.component';

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
    NgIf,
    BackButtonComponent,
  ],
})
export class MainLayoutComponent implements OnInit {
  public config!: InConfiguration;
  isSidebarOpen = true;
  @ViewChild('sidebar') sidebar?: SidebarComponent;

  constructor(
    private router: Router,
    private coachSettingsService: CoachSettingsService,
    private languageService: LanguageService,
  ) {}

  get isClientsArea(): boolean {
    return this.router.url.startsWith('/clients');
  }

  ngOnInit(): void {
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
