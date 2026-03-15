import {CommonModule, NgClass} from '@angular/common';
import {
  AfterViewInit, ApplicationRef,
  ChangeDetectorRef,
  Component, ComponentFactoryResolver,
  ElementRef, EmbeddedViewRef, EventEmitter, Injector,
  OnInit, Output,
} from '@angular/core';
import {RouterLink} from '@angular/router';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {NgbDropdown, NgbDropdownMenu, NgbDropdownToggle} from '@ng-bootstrap/ng-bootstrap';
import {FormsModule} from '@angular/forms';
import {FeatherModule} from 'angular-feather';
import {InConfiguration, LanguageService} from '../../core';
import {AuthService} from "@config/auth.service";
import {Conversation} from "../../../components/chat/models/conversation";
import {ChatMessage} from "../../../components/chat/models/chat-message";
import {Notification} from "../../../models/notification";
import {ChatPanelComponent} from "../../../components/chat/chat-panel/chat-panel.component";
import {WebsocketService} from "../../../service/websocket.service";
import {ChatWebsocketService} from "../../../service/chat-websocket.service";
import {NotificationService} from "../../../service/notification.service";

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
  userId = sessionStorage.getItem('userId');
  urlPhoto: string;
  gender: string;
  @Output() toggleSideBar = new EventEmitter<void>();
  @Output() sidebarToggle = new EventEmitter<void>();

  constructor(
    private cdRef: ChangeDetectorRef,
    public elementRef: ElementRef,
    protected authService: AuthService,
    public languageService: LanguageService,
    private translate: TranslateService,
    private chatwsService: ChatWebsocketService,
    private componentFactoryResolver: ComponentFactoryResolver,
    private injector: Injector,
    private appRef: ApplicationRef,
    private webSocketService: WebsocketService,
    private notificationService: NotificationService,
  ) {
const lang = localStorage.getItem('lang') || 'fr';
this.translate.use(lang);}

  ngAfterViewInit(): void {
    this.cdRef.detectChanges();
  }

  showErrorModal = false;
  errorMessage = '';
  showSucessModal=false;
  chatPanelOpen = false;
  conversations: Conversation[] = [];
  unreadConversations = 0;
  notificationsMessages: Notification[] =[];



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
    this.getMessagesNotifs();
    this.webSocketService.notification$.subscribe((data) => {
      if (!data) return;

      setTimeout(() => {
        const notif = new Notification(data);
        if (notif.notificationType === 'PUSH_NOTIF_MESSAGE') {
          if (this.chatPanelOpen) {
            this.webSocketService.markNotificationsAsSeen([notif.id]);
            return;
          }
          if (!notif.seen) {
            this.unreadConversations++;
            this.notificationsMessages = [notif, ...this.notificationsMessages];
          }
        }

        this.cdRef.detectChanges();
      }, 0);
    });

    this.chatwsService.messages$.subscribe((msg: ChatMessage) => {
      if (!msg) return;
      const conv = this.conversations.find(c => c.id === msg.conversationId);
      if (conv) conv.lastMessage = msg.content;
    });

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

  toggleSidebar() {
    this.sidebarToggle.emit();
  }

  onImageError(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    if(!this.gender || this.gender == 'HOMME')
      imgElement.src = '/assets/images/photoprofilvierge.jpg';
    else
      imgElement.src = '/assets/images/photoprofilviergeFemme.jpg';
  }

  clearUnreadNotificationsMessages() {
    const ids = this.notificationsMessages
      .filter(n => !n.seen)
      .map(n => n.id);

    if (ids.length === 0) return;
    this.webSocketService.markNotificationsAsSeen(ids);
    this.notificationsMessages.forEach(n => {
      if (ids.includes(n.id)) n.seen = true;
    });

    this.unreadConversations = 0;
  }

  openConversationList() {
    this.chatPanelOpen = true;

    const factory = this.componentFactoryResolver.resolveComponentFactory(ChatPanelComponent);
    const componentRef = factory.create(this.injector);
    this.appRef.attachView(componentRef.hostView);
    const domElem = (componentRef.hostView as EmbeddedViewRef<any>).rootNodes[0] as HTMLElement;
    document.body.appendChild(domElem);

    componentRef.instance.closed.subscribe(() => {
      this.chatPanelOpen = false;

      this.appRef.detachView(componentRef.hostView);
      document.body.removeChild(domElem);
      componentRef.destroy();
    });

    setTimeout(() => {
      this.clearUnreadNotificationsMessages();
    }, 200);
  }

  getMessagesNotifs() {
    this.notificationService.getMessagesNotifs(this.userId).subscribe((notifications) => {
      const converted = notifications.map(n => new Notification(n));
      converted.forEach((notif) => {
        if(notif.notificationType == 'PUSH_NOTIF_MESSAGE')
          this.notificationsMessages.push(notif);

      })
      const notifsMessagesNbr=this.notificationsMessages.filter((notif)=>  notif!=null && notif.seen==false).length;
      this.unreadConversations += notifsMessagesNbr;
    })
  }

  protected readonly sessionStorage = sessionStorage;
}
