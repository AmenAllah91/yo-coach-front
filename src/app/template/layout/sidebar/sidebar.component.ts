import { Component, OnInit, Inject, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { NgScrollbar } from 'ngx-scrollbar';
import { AuthService } from '@config/auth.service';
import { RouteInfo } from './sidebar.metadata';
import { ROUTES } from './sidebar-items';

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
export class SidebarComponent implements OnInit {
  isExpanded = true;
  sidebarItems: RouteInfo[] = [];
  listMaxHeight = '100%';
  activeItem: any = null;
  activeSubItem: any = null;
  roles: string[] = [];
  @Output() sidebarToggle = new EventEmitter<boolean>(); // Notify parent about toggle

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private authService: AuthService
  ) {}

  async ngOnInit() {
    this.setExpanded(window.innerWidth >= 1024);
    this.roles = await this.authService.extractRoles();

    this.initializeSidebar();
  }

  async initializeSidebar() {
    this.sidebarItems = ROUTES;
    this.sidebarItems = this.filterSidebarItemsByRoles(ROUTES, this.roles);
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
