import { Component, OnInit, OnDestroy, Inject, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { NgScrollbar } from 'ngx-scrollbar';
import { AuthService } from '@config/auth.service';
import { RouteInfo } from './sidebar.metadata';
import { ROUTES } from './sidebar-items';
import { filter } from 'rxjs/operators';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    NgScrollbar,
    FeatherModule,
    TranslateModule,
  ],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
})
export class SidebarComponent implements OnInit, OnDestroy {
  isExpanded = true;
  sidebarItems: RouteInfo[] = [];
  listMaxHeight = '100%';
  activeItem: any = null;
  activeSubItem: any = null;
  roles: string[] = [];
  private destroy$ = new Subject<void>();
  @Output() sidebarToggle = new EventEmitter<boolean>();

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private authService: AuthService,
    private router: Router,
  ) {}

  async ngOnInit() {
    this.setExpanded(window.innerWidth >= 1024);
    this.roles = await this.authService.extractRoles();

    this.initializeSidebar();

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntil(this.destroy$),
      )
      .subscribe(() => {
        this.syncActiveState();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private syncActiveState(): void {
    const currentUrl = this.router.url.split('?')[0].split('#')[0];

    const normalizePath = (path: string): string =>
      path.startsWith('/') ? path : '/' + path;

    let matchedItem: RouteInfo | null = null;
    let matchedSub: RouteInfo | null = null;

    for (const item of this.sidebarItems) {
      if (item.submenu?.length) {
        const sub = item.submenu.find((s) => {
          if (!s.path) return false;
          const normalized = normalizePath(s.path);
          return currentUrl === normalized || currentUrl.startsWith(normalized + '/');
        });
        if (sub) {
          matchedItem = item;
          matchedSub = sub;
          break;
        }
      } else {
        if (!item.path) continue;
        const normalized = normalizePath(item.path);
        if (currentUrl === normalized || currentUrl.startsWith(normalized + '/')) {
          matchedItem = item;
          break;
        }
      }
    }

    for (const item of this.sidebarItems) {
      item.isActive = item === matchedItem && !matchedSub;
      if (item.submenu?.length) {
        const subActive = matchedSub && item === matchedItem;
        item.isExpanded = !!subActive;
        item.submenu.forEach((s) => (s.isActive = subActive && s === matchedSub));
      }
    }

    this.activeItem = matchedItem;
    this.activeSubItem = matchedSub;
  }

  async initializeSidebar() {
    // Some coach accounts also carry ROLE_CLIENT. In the rest of the app a
    // coach takes precedence, so the sidebar must follow the same rule instead
    // of rendering both the client and coach navigation blocks.
    const effectiveRoles = this.roles.includes('ROLE_COACH')
      ? this.roles.filter((role) => role !== 'ROLE_CLIENT')
      : this.roles;

    // Work on fresh objects because role filtering also filters submenus.
    // Mutating the shared ROUTES constant can leak one user's menu into a
    // later session in the same browser.
    const routes = ROUTES.map((item) => ({
      ...item,
      submenu: item.submenu?.map((subItem) => ({ ...subItem })) || [],
    }));

    this.sidebarItems = this.filterSidebarItemsByRoles(routes, effectiveRoles);
    this.syncActiveState();
  }

  filterSidebarItemsByRoles(
    items: RouteInfo[],
    userRoles: string[]
  ): RouteInfo[] {
    return items.filter((item) => {
      if (!item.roles || item.roles.some((role) => userRoles.includes(role))) {
        if (item.submenu?.length) {
          item.submenu = this.filterSidebarItemsByRoles(
            item.submenu,
            userRoles
          );
        }
        return true;
      }
      return false;
    });
  }

  toggleSidebar() {
    this.setExpanded(!this.isExpanded);
  }

  closeSidebar() {
    this.setExpanded(false);
  }

  private setExpanded(isExpanded: boolean, emit = true) {
    this.isExpanded = isExpanded;
    if (emit) {
      this.sidebarToggle.emit(this.isExpanded);
    }
  }

  toggleSubmenu(event: Event, item: any): void {
    event.preventDefault();
    if (this.activeItem && this.activeItem !== item) {
      this.activeItem.isActive = false;
      if (window.innerWidth < 1024) this.activeItem.isExpanded = false;
      if (this.activeSubItem) this.activeSubItem.isActive = false;
    }
    if (!item.submenu?.length && window.innerWidth < 1024) this.toggleSidebar();
    item.isActive = true;
    item.isExpanded = !item.isExpanded;
    this.activeItem = item;
  }
  activateSubmenu(parentItem: any, subItem: any) {
    if (window.innerWidth < 1024) this.toggleSidebar();
    if (this.activeSubItem && this.activeSubItem !== subItem) {
      this.activeSubItem.isActive = false;
    }
    subItem.isActive = true;
    this.activeSubItem = subItem;
    this.activeItem.isActive = false;
    parentItem.isActive = false;
  }

  trackByItem(index: number, item: RouteInfo) {
    return item.path;
  }

  @HostListener('window:resize')
  onWindowResize() {
    const shouldBeExpanded = window.innerWidth >= 1024;
    if (this.isExpanded !== shouldBeExpanded) {
      this.setExpanded(shouldBeExpanded);
    }
  }
}
