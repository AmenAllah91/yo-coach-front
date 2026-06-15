export interface AppThemeColors {
  id?: string;
  name: string;
  active: boolean;

  mobileLogoUrl?: string;

  primary: string;
  secondary: string;

  background: string;
  surface: string;
  card: string;
  cardSurface: string;

  textPrimary: string;
  textSecondary: string;
  textHint: string;

  success: string;
  successLight: string;
  error: string;
  errorLight: string;
  warning: string;
  warningLight: string;

  border: string;
  divider: string;
  disabled: string;
  dragHandle: string;
  emptyStateBg: string;

  buttonText: string;

  selectedTabBg: string;
  activeBg: string;

  headerStart: string;
  headerMid: string;
  headerEnd: string;

  createdBy?: string;
  updatedBy?: string;
}

export interface AppThemeColorsPage {
  content: AppThemeColors[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}
