// Sidebar icons missing from Feather, taken from Lucide 1.48 (ISC), Feather's fork.
// Same 24px grid and markup format as angular-feather's own icons, so they pick up
// the identical stroke width, caps and currentColor styling. Register them next to
// `allIcons` via FeatherModule.pick and use them as <i-feather name="kebab-case-name">.
const icon = (name: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="feather feather-${name}">${body}</svg>`;

export const sidebarIcons = {
  LayoutDashboard: icon('layout-dashboard',
    '<rect width="7" height="9" x="3" y="3" rx="1"></rect><rect width="7" height="5" x="14" y="3" rx="1"></rect>' +
    '<rect width="7" height="9" x="14" y="12" rx="1"></rect><rect width="7" height="5" x="3" y="16" rx="1"></rect>'),
  Dumbbell: icon('dumbbell',
    '<path d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z"></path>' +
    '<path d="m2.5 21.5 1.4-1.4"></path><path d="m20.1 3.9 1.4-1.4"></path>' +
    '<path d="M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z"></path>' +
    '<path d="m9.6 14.4 4.8-4.8"></path>'),
  Apple: icon('apple',
    '<path d="M12 6.528V3a1 1 0 0 1 1-1h0"></path>' +
    '<path d="M18.237 21A15 15 0 0 0 22 11a6 6 0 0 0-10-4.472A6 6 0 0 0 2 11a15.1 15.1 0 0 0 3.763 10 3 3 0 0 0 3.648.648 5.5 5.5 0 0 1 5.178 0A3 3 0 0 0 18.237 21"></path>'),
  CalendarDays: icon('calendar-days',
    '<path d="M8 2v3"></path><path d="M16 2v3"></path><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M3 9h18"></path>' +
    '<path d="M8 13h.01"></path><path d="M12 13h.01"></path><path d="M16 13h.01"></path>' +
    '<path d="M8 17h.01"></path><path d="M12 17h.01"></path><path d="M16 17h.01"></path>'),
  ClipboardList: icon('clipboard-list',
    '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect>' +
    '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>' +
    '<path d="M12 11h4"></path><path d="M12 16h4"></path><path d="M8 11h.01"></path><path d="M8 16h.01"></path>'),
  Palette: icon('palette',
    '<path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"></path>' +
    '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"></circle><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"></circle>' +
    '<circle cx="6.5" cy="12.5" r=".5" fill="currentColor"></circle><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"></circle>'),
  FileCheck: icon('file-check',
    '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"></path>' +
    '<path d="M14 2v5a1 1 0 0 0 1 1h5"></path><path d="m9 15 2 2 4-4"></path>'),
  ListChecks: icon('list-checks',
    '<path d="M13 5h8"></path><path d="M13 12h8"></path><path d="M13 19h8"></path>' +
    '<path d="m3 17 2 2 4-4"></path><path d="m3 7 2 2 4-4"></path>'),
  Utensils: icon('utensils',
    '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"></path><path d="M7 2v20"></path>' +
    '<path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"></path>'),
  ArrowLeftRight: icon('arrow-left-right',
    '<path d="M8 3 4 7l4 4"></path><path d="M4 7h16"></path><path d="m16 21 4-4-4-4"></path><path d="M20 17H4"></path>'),
};
