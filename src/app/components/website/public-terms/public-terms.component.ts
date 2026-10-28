import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LanguageService } from 'app/service/language.service';

/**
 * Terms shown to a visitor before they send a message through a coach's contact form or website.
 * Public, no sign-in: the text lives here (in French and English) rather than in the i18n files, which are loaded
 * for the whole app; a legal page reads better as full paragraphs than as scattered keys.
 */
@Component({
  selector: 'app-public-terms',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './public-terms.component.html',
  styleUrls: ['./public-terms.component.scss'],
})
export class PublicTermsComponent {
  readonly updated = '2026-10-27';
  lang: 'fr' | 'en';

  constructor(private translate: TranslateService, private languageService: LanguageService, title: Title) {
    this.translate.use(this.languageService.getCurrentLanguage());
    this.lang = this.languageService.getCurrentLanguage() === 'en' ? 'en' : 'fr';
    title.setTitle(this.lang === 'en' ? 'Terms of use · YoCoach' : 'Conditions d’utilisation · YoCoach');
  }

  setLang(lang: 'fr' | 'en'): void {
    this.lang = lang;
    this.languageService.setLanguage(lang);
  }

  goBack(): void {
    if (window.history.length > 1) window.history.back(); else window.close();
  }
}
