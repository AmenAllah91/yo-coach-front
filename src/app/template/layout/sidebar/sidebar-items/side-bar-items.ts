import { RouteInfo } from '../sidebar.metadata';

export const items: RouteInfo[] = [
  {
    path: '/dashboard',
    title: 'Dashboard',
    iconType: 'feather',
    icon: 'grid',
    class: '',
    groupTitle: false,
    badge: '',
    badgeClass: '',
    submenu: []
  },
  {
    path: '',
    title: 'Clients',
    iconType: 'feather',
    icon: 'users',
    class: '',
    groupTitle: false,
    badge: '',
    badgeClass: '',
    submenu: [
      {
        path: '/clients/individual',
        title: 'Individual',
        iconType: 'feather',
        icon: 'user',
        class: '',
        groupTitle: false,
        badge: '',
        badgeClass: '',
        submenu: []
      },
      {
        path: '/clients/groups',
        title: 'Groups',
        iconType: 'feather',
        icon: 'users',
        class: '',
        groupTitle: false,
        badge: '',
        badgeClass: '',
        submenu: []
      }
    ]
  },
  {
    path: '',
    title: 'Workout',
    iconType: 'feather',
    icon: 'zap',
    class: '',
    groupTitle: false,
    badge: '',
    badgeClass: '',
    submenu: [
      {
        path: '/workout/program-library',
        title: 'Program Library',
        iconType: 'feather',
        icon: 'folder',
        class: '',
        groupTitle: false,
        badge: '',
        badgeClass: '',
        submenu: []
      },
      {
        path: '/workout/exercise-library',
        title: 'Exercise Library',
        iconType: 'feather',
        icon: 'target',
        class: '',
        groupTitle: false,
        badge: '',
        badgeClass: '',
        submenu: []
      }
    ]
  },
  {
    path: '',
    title: 'Nutrition',
    iconType: 'feather',
    icon: 'heart',
    class: '',
    groupTitle: false,
    badge: '',
    badgeClass: '',
    submenu: [
      {
        path: '/nutrition/plans',
        title: 'Plans',
        iconType: 'feather',
        icon: 'clipboard',
        class: '',
        groupTitle: false,
        badge: '',
        badgeClass: '',
        submenu: []
      },
      {
        path: '/nutrition/custom-foods',
        title: 'Custom Foods',
        iconType: 'feather',
        icon: 'plus-circle',
        class: '',
        groupTitle: false,
        badge: '',
        badgeClass: '',
        submenu: []
      },
      {
        path: '/nutrition/days',
        title: 'Days',
        iconType: 'feather',
        icon: 'calendar',
        class: '',
        groupTitle: false,
        badge: '',
        badgeClass: '',
        submenu: []
      },
      {
        path: '/nutrition/meals',
        title: 'Meals',
        iconType: 'feather',
        icon: 'coffee',
        class: '',
        groupTitle: false,
        badge: '',
        badgeClass: '',
        submenu: []
      }
    ]
  },
  {
    path: '/chat',
    title: 'Chat',
    iconType: 'feather',
    icon: 'message-square',
    class: '',
    groupTitle: false,
    badge: '',
    badgeClass: '',
    submenu: []
  },
  {
    path: '/calendar',
    title: 'Calendar',
    iconType: 'feather',
    icon: 'calendar',
    class: '',
    groupTitle: false,
    badge: '',
    badgeClass: '',
    submenu: []
  },
  {
    path: '',
    title: 'Forms',
    iconType: 'feather',
    icon: 'file-text',
    class: '',
    groupTitle: false,
    badge: '',
    badgeClass: '',
    submenu: [
      {
        path: '/forms/check-in-forms',
        title: 'Check-in Forms',
        iconType: 'feather',
        icon: 'clipboard',
        class: '',
        groupTitle: false,
        badge: '',
        badgeClass: '',
        submenu: []
      },
      {
        path: '/forms/initial-questionnaire',
        title: 'Initial Questionnaire',
        iconType: 'feather',
        icon: 'help-circle',
        class: '',
        groupTitle: false,
        badge: '',
        badgeClass: '',
        submenu: []
      }
    ]
  },
  {
    path: '/settings',
    title: 'Settings',
    iconType: 'feather',
    icon: 'settings',
    class: '',
    groupTitle: false,
    badge: '',
    badgeClass: '',
    submenu: []
  }
];
