// Sidebar route metadata
export interface RouteInfo {
  path: string;
  title: string;
  iconType: string;
  icon: string;
  class: string;
  groupTitle: boolean;
  badge: string;
  badgeClass: string;
  roles?:string[] ;
  submenu?: RouteInfo[];
  /** Other pages that light this entry (e.g. the « Photos » tab of « Progress »). */
  activeOn?: string[];
  isExpanded?: boolean;
  isActive?: boolean;
}
