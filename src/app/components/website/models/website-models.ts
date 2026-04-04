export type CoachThemeName = 'Élégance' | 'Dynamique' | 'Confiance' | 'Sérénité';

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  announcementBg: string;
  announcementText: string;
}

export interface ThemePreset {
  name: CoachThemeName;
  selected: boolean;
  colors: ThemeColors;
  heroLayout: 'split' | 'centered' | 'card';
  cardRadius: string;
  buttonRadius: string;
}

export interface ProfileSection {
  image: string;
  fullName: string;
  title: string;
  slogan: string;
  bio: string;
}

export interface AnnouncementSection {
  enabled: boolean;
  message: string;
  bgColor: string;
  textColor: string;
}

export interface CtaSection {
  enabled: boolean;
  label: string;
  sticky: boolean;
}

export interface LeadFieldsSection {
  firstName: boolean;
  lastName: boolean;
  email: boolean;
  phone: boolean;
  buttonLabel: string;
}

export interface ResultItem {
  beforeImage: string;
  afterImage: string;
  text: string;
}

export interface ServiceItem {
  image: string;
  title: string;
  price: string;
  description: string;
}

export interface CertificateItem {
  image: string;
  title: string;
  organization: string;
  year: string;
}

export interface TestimonialItem {
  author: string;
  rating: number;
  text: string;
}

export interface VideoSection {
  url: string;
}

export interface CoachWebsiteData {
  siteSlug: string;
  activeTab: string;
  profile: ProfileSection;
  video: VideoSection;
  announcement: AnnouncementSection;
  cta: CtaSection;
  leadFields: LeadFieldsSection;
  colors: ThemeColors;
  results: ResultItem[];
  services: ServiceItem[];
  certificates: CertificateItem[];
  testimonials: TestimonialItem[];
}
