import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  public languages: string[] = ['fr', 'en', 'es', 'de'];

  constructor(public translate: TranslateService) {
    translate.addLangs(this.languages);

    let lang = localStorage.getItem('lang');
    if (!lang) {
      lang = 'fr'; // Default to French
      localStorage.setItem('lang', lang);
    }
    this.translate.use(lang);
  }

  public setLanguage(lang: string) {
    this.translate.use(lang);
    localStorage.setItem('lang', lang);
  }
}
