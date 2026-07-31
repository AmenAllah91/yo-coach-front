import {CommonModule, NgClass} from '@angular/common';
import {
  AfterViewInit, ApplicationRef,
  ChangeDetectorRef,
  Component, ComponentFactoryResolver,
  ElementRef, EmbeddedViewRef, EventEmitter, Injector,
  Input, OnDestroy, OnInit, Output,
} from '@angular/core';
import {Router, RouterLink} from '@angular/router';
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
import {CoachSettingsService} from "../../../service/coach-settings.service";
import {ChatService} from "../../../service/chat.service";
import {getTimeAgo} from "../../../models/notification";
import {Subject, timer} from "rxjs";
import {takeUntil} from "rxjs/operators";

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
export class HeaderComponent implements OnInit, OnDestroy, AfterViewInit {
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
  @Input() sidebarOpen = true;

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
    private router: Router,
    private chatService: ChatService,
    private coachSettingsService: CoachSettingsService,
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
  notifications: Notification[] = [];
  notificationsEnabled = true;
  private notificationPreferences: any = null;
  private isCoach = false;
  private readonly destroy$ = new Subject<void>();



  handleErrorModalClose() {
    this.showErrorModal = false;
    this.errorMessage = '';
  }

  listLang = [
    { text: 'English', flag: 'assets/images/flags/us.jpg', lang: 'en' },
    { text: 'french', flag: 'assets/images/flags/french.jpg', lang: 'fr' },
  ];



  ngOnInit() {
    this.authService.extractRoles().then((roles) => {
      this.isCoach = roles.includes('ROLE_COACH');
      if (!this.isCoach) return;
      this.coachSettingsService.configChanges$
        .pipe(takeUntil(this.destroy$))
        .subscribe((config) => this.applyNotificationSetting(config.notifications));
      this.coachSettingsService.loadConfig(true).subscribe({
        error: () => this.applyNotificationSetting({ enabled: false }),
      });
    });

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
    timer(5000, 5000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.getMessagesNotifs());
    this.webSocketService.notification$.pipe(takeUntil(this.destroy$)).subscribe((data) => {
      if (!data || !this.notificationTypeEnabled(data.notificationType)) return;

      setTimeout(() => {
        const notif = new Notification(data);
        this.notifications = [notif, ...this.notifications.filter(item => item.id !== notif.id)];
        if (typeof window.Notification !== 'undefined' && window.Notification.permission === 'granted') {
          const browserNotification = new window.Notification(notif.title || 'Yo Coach', {
            body: notif.message || '',
          });
          browserNotification.onclick = () => {
            window.focus();
            if (notif.redirectUrl) {
              this.router.navigateByUrl(notif.redirectUrl);
            }
            browserNotification.close();
          };
        }
        if (notif.notificationType === 'PUSH_NOTIF_MESSAGE') {
          this.chatService.requestConversationRefresh(notif.entityId);
          if (this.chatPanelOpen) {
            this.webSocketService.markNotificationsAsSeen([notif.id]);
            notif.seen = true;
            this.syncMessageNotifications();
            return;
          }
        }

        this.syncMessageNotifications();

        this.cdRef.detectChanges();
      }, 0);
    });

    this.chatwsService.messages$.pipe(takeUntil(this.destroy$)).subscribe((msg: ChatMessage) => {
      if (!msg) return;
      const conv = this.conversations.find(c => c.id === msg.conversationId);
      if (conv) conv.lastMessage = msg.content;
      if (this.notificationsEnabled) this.getMessagesNotifs();
    });

    this.chatService.conversationOpened$
      .pipe(takeUntil(this.destroy$))
      .subscribe(conversationId => {
        if (conversationId) this.markConversationNotificationsRead(conversationId);
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
    this.notificationService.markNotificationsAsSeen(ids).subscribe();
    this.notifications.forEach(n => {
      if (ids.includes(n.id)) n.seen = true;
    });
    this.syncMessageNotifications();
  }

  openConversationList() {
    if (this.chatPanelOpen) {
      return;
    }

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

  }

  getMessagesNotifs() {
    if (!this.notificationsEnabled) {
      this.clearHeaderNotifications();
      return;
    }
    this.notificationService.getMessagesNotifs(this.userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
      next: (notifications) => {
      const converted = notifications
        .map(n => new Notification(n))
        .filter(n => this.notificationTypeEnabled(n.notificationType));
      this.notifications = converted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      this.notificationsMessages = converted.filter(
        notif => notif.notificationType === 'PUSH_NOTIF_MESSAGE'
      );
      const notifsMessagesNbr=this.notificationsMessages.filter((notif)=>  notif!=null && notif.seen==false).length;
      this.unreadConversations = notifsMessagesNbr;
      const activeConversationId = this.chatService.getActiveConversationId();
      if (activeConversationId) this.markConversationNotificationsRead(activeConversationId);
      },
      error: err => console.warn('Notification synchronization unavailable:', err?.status || err)
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private syncMessageNotifications(): void {
    if (!this.notificationsEnabled) {
      this.notificationsMessages = [];
      this.unreadConversations = 0;
      return;
    }
    this.notificationsMessages = this.notifications
      .filter(item => item.notificationType === 'PUSH_NOTIF_MESSAGE');
    this.unreadConversations = this.notificationsMessages
      .filter(item => !item.seen).length;
  }

  private applyNotificationSetting(preferences: any): void {
    this.notificationPreferences = preferences || { enabled: false };
    this.notificationsEnabled = this.notificationPreferences.enabled === true;
    if (!this.notificationsEnabled) {
      this.clearHeaderNotifications();
    } else {
      this.getMessagesNotifs();
    }
    this.cdRef.detectChanges();
  }

  private clearHeaderNotifications(): void {
    this.notifications = [];
    this.notificationsMessages = [];
    this.unreadConversations = 0;
  }

  private notificationTypeEnabled(type: string): boolean {
    if (!this.notificationsEnabled) return false;
    const keyByType: Record<string, string> = {
      WORKOUT_COMPLETED: 'workoutCompleted',
      BODY_MEASUREMENTS_UPDATED: 'measurementAdded',
      PROGRESS_ADDED: 'progressPictureAdded',
      PUSH_NOTIF_MESSAGE: 'messageReceived',
      CHECK_IN_SUBMITTED: 'checkInSubmitted',
      PROGRAM_ENDING_SOON: 'programEndingSoon',
    };
    const preferenceKey = keyByType[type];
    return !preferenceKey || this.notificationPreferences?.[preferenceKey] !== false;
  }

  private markConversationNotificationsRead(conversationId: string): void {
    const relatedIds = this.notifications
      .filter(item =>
        !item.seen &&
        item.notificationType === 'PUSH_NOTIF_MESSAGE' &&
        item.entityId === conversationId &&
        !!item.id
      )
      .map(item => item.id as string);

    if (!relatedIds.length) return;

    this.notificationService.markNotificationsAsSeen(relatedIds)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.notifications.forEach(item => {
            if (item.id && relatedIds.includes(item.id)) item.seen = true;
          });
          this.syncMessageNotifications();
          this.cdRef.detectChanges();
        },
        error: err => console.error('Failed to mark conversation notifications as read:', err)
      });
  }

  get unreadNotifications(): Notification[] {
    return this.notifications.filter(item => !item.seen);
  }

  get olderNotifications(): Notification[] {
    return this.notifications.filter(item => item.seen);
  }

  get unreadNotificationCount(): number {
    return this.unreadNotifications.length;
  }

  notificationTime(item: Notification): string {
    const elapsedSeconds = Math.floor((Date.now() - item.createdAt.getTime()) / 1000);
    if (elapsedSeconds < 60) return "à l'instant";
    return getTimeAgo(item.createdAt)
      .replace('minutes ago', 'min').replace('hours ago', 'h').replace('days ago', 'j');
  }

  notificationIcon(type: string): string {
    const icons: Record<string, string> = {
      PUSH_NOTIF_MESSAGE: 'message-square', NEW_LEAD: 'user-plus', CHECK_IN_SUBMITTED: 'clipboard',
      WORKOUT_COMPLETED: 'activity', WORKOUT_MISSED: 'alert-circle', PROGRESS_ADDED: 'trending-up',
      BODY_MEASUREMENTS_UPDATED: 'maximize-2', PROGRAM_ENDING_SOON: 'calendar',
      PROGRAM_ASSIGNED: 'clipboard', PROGRAM_UPDATED: 'edit-3', WORKOUT_DUE_TODAY: 'activity',
      CHECK_IN_DUE: 'check-square', WORKOUT_OVERDUE: 'alert-circle',
      NUTRITION_DAY_OVERDUE: 'calendar', CHECK_IN_OVERDUE: 'alert-circle'
    };
    return icons[type] || 'bell';
  }

  notificationSourceLabel(source?: string): string {
    const labels: Record<string, string> = {
      FORMULAIRE_CONTACT: 'Depuis le formulaire de contact',
      SITE_WEB: 'Depuis le site web'
    };
    return source ? labels[source] || '' : '';
  }

  notificationInitials(item: Notification): string {
    const message = (item.message || '').trim();
    const sender = message
      .split(/\s+(?:vous\s+)?a\s+/i)[0]
      .replace(/[^A-Za-zÀ-ÖØ-öø-ÿ\s'-]/g, '')
      .trim();
    const words = sender.split(/\s+/).filter(Boolean);

    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }
    if (words.length === 1) {
      return words[0].slice(0, 2).toUpperCase();
    }
    return 'YO';
  }

  markAllNotificationsRead(event: Event): void {
    event.stopPropagation();
    this.markVisibleNotificationsRead();
  }

  markVisibleNotificationsRead(): void {
    const ids = this.unreadNotifications.map(item => item.id).filter(Boolean) as string[];
    if (!ids.length) return;

    this.notifications.forEach(item => {
      if (item.id && ids.includes(item.id)) item.seen = true;
    });
    this.syncMessageNotifications();
    this.cdRef.detectChanges();

    this.notificationService.markNotificationsAsSeen(ids).subscribe({
      error: err => console.error('Failed to mark notifications as read:', err)
    });
  }

  openNotification(item: Notification): void {
    if (!item.seen && item.id) {
      this.notificationService.markNotificationsAsSeen([item.id]).subscribe();
      item.seen = true;
      this.syncMessageNotifications();
    }

    if (item.notificationType === 'PUSH_NOTIF_MESSAGE' && item.entityId) {
      this.chatService.getConversations(0, 100).subscribe(page => {
        const conversation = page.content.find(conv => conv.id === item.entityId);
        if (conversation) this.openConversation(conversation);
      });
      return;
    }

    if (item.notificationType === 'PROGRAM_ASSIGNED' || item.notificationType === 'PROGRAM_UPDATED') {
      const programId = item.entityId || this.getNotificationQueryParam(item.redirectUrl, 'programId');
      this.router.navigate(['/clients/client-workouts'], {
        queryParams: programId ? { programId } : undefined,
      });
      return;
    }

    if (item.redirectUrl) this.router.navigateByUrl(item.redirectUrl);
  }

  private getNotificationQueryParam(url: string | undefined, name: string): string | null {
    if (!url) return null;

    const query = url.split('?')[1];
    return query ? new URLSearchParams(query).get(name) : null;
  }

  private openConversation(conversation: Conversation): void {
    if (this.chatPanelOpen) return;
    this.chatPanelOpen = true;
    const factory = this.componentFactoryResolver.resolveComponentFactory(ChatPanelComponent);
    const componentRef = factory.create(this.injector);
    componentRef.instance.openConversation(conversation);
    this.appRef.attachView(componentRef.hostView);
    const domElem = (componentRef.hostView as EmbeddedViewRef<any>).rootNodes[0] as HTMLElement;
    document.body.appendChild(domElem);
    componentRef.instance.closed.subscribe(() => {
      this.chatPanelOpen = false;
      this.appRef.detachView(componentRef.hostView);
      domElem.remove();
      componentRef.destroy();
    });
  }

  protected readonly sessionStorage = sessionStorage;
}
