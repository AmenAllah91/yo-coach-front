import {Component} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { HeaderComponent } from '../../header/header.component';
import {InConfiguration } from '../../../core';
import {NgClass} from "@angular/common";

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
  ],
})
export class MainLayoutComponent{
  public config!: InConfiguration;
  isSidebarOpen = false;

  handleSidebarToggle(state: boolean): void {
    this.isSidebarOpen = state;
  }
  constructor(){}

}
