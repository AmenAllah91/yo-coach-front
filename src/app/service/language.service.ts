import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  public languages: string[] = ['fr', 'en'];

  constructor(public translate: TranslateService) {
    translate.addLangs(this.languages);

    let lang = localStorage.getItem('lang');

    if (!lang || !this.languages.includes(lang)) {
      lang = 'fr';
    }

    this.translate.setDefaultLang('fr');
    this.translate.use(lang);
  }

  public setLanguage(lang: string): void {
    const safeLang = this.languages.includes(lang) ? lang : 'fr';

    this.translate.use(safeLang);
    localStorage.setItem('lang', safeLang);
  }

  public getCurrentLanguage(): string {
    const lang = localStorage.getItem('lang');
    return lang && this.languages.includes(lang) ? lang : 'fr';
  }

  public languageNameToCode(language: string | null | undefined): string {
    switch ((language || '').toLowerCase()) {
      case 'english':
      case 'en':
        return 'en';

      case 'french':
      case 'français':
      case 'francais':
      case 'fr':
        return 'fr';

      default:
        return 'fr';
    }
  }

  public languageCodeToName(code: string | null | undefined): string {
    switch ((code || '').toLowerCase()) {
      case 'en':
        return 'English';

      case 'fr':
      default:
        return 'French';
    }
  }
}
