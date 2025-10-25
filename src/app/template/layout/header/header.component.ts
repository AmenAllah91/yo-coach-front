import {CommonModule, NgClass} from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef, EventEmitter,
  OnInit, Output,
} from '@angular/core';
import {RouterLink} from '@angular/router';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {NgbDropdown, NgbDropdownMenu, NgbDropdownToggle} from '@ng-bootstrap/ng-bootstrap';
import {FormsModule} from '@angular/forms';
import {FeatherModule} from 'angular-feather';
import {InConfiguration, LanguageService} from '../../core';
import {AuthService} from "@config/auth.service";

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  standalone: true,
  imports: [
    FeatherModule,
    FormsModule,
    NgbDropdown,
    NgbDropdownToggle,
    NgbDropdownMenu,
    NgClass,
    RouterLink,
    TranslateModule,
    CommonModule
  ],
  providers: []
})
export class HeaderComponent implements OnInit,AfterViewInit {
  public config!: InConfiguration;
  flagvalue: string | string[] | undefined = "assets/images/flags/french.jpg";
  countryName: string | string[] = [];
  langStoreValue?: string;
  defaultFlag?: string;
  userId: string;
  urlPhoto: string;
  gender: string;
  @Output() toggleSideBar = new EventEmitter<void>();

  constructor(
    private cdRef: ChangeDetectorRef,
    public elementRef: ElementRef,
    protected authService: AuthService,
    public languageService: LanguageService,
    private translate: TranslateService,
  ) {
const lang = localStorage.getItem('lang') || 'fr';
this.translate.use(lang);}

  ngAfterViewInit(): void {
    this.cdRef.detectChanges();
  }

  showErrorModal = false;
  errorMessage = '';
  showSucessModal=false;

  handleErrorModalClose() {
    this.showErrorModal = false;
    this.errorMessage = '';
  }

  listLang = [
    { text: 'English', flag: 'assets/images/flags/us.jpg', lang: 'en' },
    { text: 'french', flag: 'assets/images/flags/french.jpg', lang: 'fr' },
  ];



  ngOnInit() {

    const savedLang = localStorage.getItem('lang')?localStorage.getItem('lang'):'fr';
    const langItem = this.listLang.find(item => item.lang===savedLang)
    this.setLanguage(langItem.text,langItem.lang,langItem.flag)
    this.langStoreValue = localStorage.getItem('lang') as string;
    const val = this.listLang.filter((x) => x.lang === this.langStoreValue);
    this.countryName = val.map((element) => element.text);
    if (val.length === 0) {
      if (this.flagvalue === undefined) {
        this.defaultFlag = 'assets/images/flags/french.jpg';
      }
    } else {
      this.flagvalue = val.map((element) => element.flag);
    }
  }

  setLanguage(text: string, lang: string, flag: string) {
    this.countryName = text;
    this.flagvalue = flag;
    this.langStoreValue = lang;
    this.languageService.setLanguage(lang);
    this.translate.use(lang);
    localStorage.setItem('lang', lang);
} logout() {
    this.authService.logout();
  }

  isActive: boolean = false;
  adminPin: string;
  userName: string="";

  toggleRightSidebar(){
    this.toggleSideBar.emit();
  }

  onImageError(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    if(!this.gender || this.gender == 'HOMME')
      imgElement.src = '/assets/images/photoprofilvierge.jpg';
    else
      imgElement.src = '/assets/images/photoprofilviergeFemme.jpg';
  }
}
