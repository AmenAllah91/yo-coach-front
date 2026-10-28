import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { CustomDomainCheck, WebsiteService } from '../../../service/website.service';
import { WebsiteBuilderStateService } from '../../../service/website-builder-state.service';
import { UsersService } from '../../../service/users.service';
import { DocumentService } from '../../../service/document.service';
import { CoachSettingsService } from '../../../service/coach-settings.service';
import { BrandingLockBannerComponent } from 'app/components/branding-lock-banner/branding-lock-banner.component';
import { CoachSubscriptionStateService } from 'app/service/coach-subscription-state.service';
import { toWebsiteVideoEmbedUrl } from '../models/website-video';
import {
  ButtonStyle, EMPTY_SOCIAL_LINKS, FontPairing, HeroBackground, HeroLayout, Radius, SECTION_KEYS, SectionKey, SiteColors,
  SiteMode, SocialLinks, StatItem, THEME_PRESETS, ThemePreset, WebsiteDesign, ensureWebsiteFontsLoaded, normalizeDesign,
  readableTextOn,
} from '../models/website-design';

type DescriptionBlockType = 'text' | 'heading' | 'image';

export type BuilderSection =
  | 'address' | 'domain' | 'theme' | 'sections' | 'profile' | 'video' | 'description' | 'stats' | 'results' | 'services'
  | 'certificates' | 'testimonials' | 'social' | 'announcement' | 'cta' | 'leadForm';

interface DescriptionBlock {
  id: string;
  type: DescriptionBlockType;
  content: string;
}

interface ProfileSection {
  image: string;
  fullName: string;
  title: string;
  slogan: string;
  bio: string;
}

interface VideoSection {
  url: string;
}

interface AnnouncementSection {
  enabled: boolean;
  message: string;
  bgColor: string;
  textColor: string;
}

interface CtaSection {
  enabled: boolean;
  label: string;
  sticky: boolean;
}

interface LeadFieldsSection {
  firstName: boolean;
  lastName: boolean;
  email: boolean;
  phone: boolean;
  buttonLabel: string;
}

interface ResultItem {
  beforeImage: string;
  afterImage: string;
  text: string;
}

interface ServiceItem {
  image: string;
  title: string;
  price: string;
  description: string;
}

interface CertificateItem {
  image: string;
  title: string;
  organization: string;
  year: string;
}

interface TestimonialItem {
  author: string;
  rating: number;
  text: string;
}

interface NavItem { key: BuilderSection; label: string; icon: string; }

/** One choice of a design option, shown as a small card. */
interface DesignOption<T extends string> { value: T; label: string; hint?: string; }

/** Same list as the API (CoachWebsiteServiceImpl.RESERVED_SLUGS): these subdomains belong to the platform. */
const RESERVED_SLUGS = new Set([
  'www', 'app', 'api', 'account', 'admin', 'integration', 'login', 'login-int', 'auth', 'mail', 'smtp',
  'minio', 'minio-int', 'minio-console', 'minio-console-int', 'static', 'assets', 'cdn', 'support', 'help',
  'blog', 'status', 'yocoach', 'yo-coach', 'test', 'staging', 'dev', 'monsite', 'sites',
]);

/** Sites saved with the first four themes: the preset whose look is the closest, so the picker shows a selection. */
const LEGACY_PRESET: Record<string, string> = { elegance: 'editorial', dynamic: 'energy', trust: 'prestige', serenity: 'nature' };

const DOMAIN_PATTERN = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** Builder of the coach's public website: one section edited at a time, saved explicitly. */
@Component({
  selector: 'app-yo-coach-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, RouterModule, TranslateModule, BrandingLockBannerComponent],
  templateUrl: './website-builder.component.html',
  styleUrls: ['./website-builder.component.scss']
})
export class WebsiteBuilderComponent implements OnInit {

  constructor(
    private router: Router,
    private sanitizer: DomSanitizer,
    private websiteService: WebsiteService,
    private builderState: WebsiteBuilderStateService,
    private userService: UsersService,
    private documentService: DocumentService,
    private coachSettingsService: CoachSettingsService,
    private subscriptionState: CoachSubscriptionStateService,
    private translate: TranslateService,
  ) {}

  /** SUB-27/29: the whole website is a paid feature. Visible, but nothing can be changed during the trial. */
  brandingLocked = false;

  readonly navGroups: { title: string; items: NavItem[] }[] = [
    {
      title: 'WB_GROUP_SETUP',
      items: [
        { key: 'address', label: 'WB_SECTION_ADDRESS', icon: 'link' },
        { key: 'domain', label: 'WB_SECTION_DOMAIN', icon: 'globe' },
        { key: 'theme', label: 'WB_SECTION_THEME', icon: 'droplet' },
        { key: 'sections', label: 'WB_SECTION_LAYOUT', icon: 'layout' },
      ],
    },
    {
      title: 'WB_GROUP_CONTENT',
      items: [
        { key: 'profile', label: 'PROFILE', icon: 'user' },
        { key: 'video', label: 'VIDEO', icon: 'video' },
        { key: 'description', label: 'DESCRIPTION', icon: 'align-left' },
        { key: 'stats', label: 'WB_SECTION_STATS', icon: 'bar-chart-2' },
        { key: 'services', label: 'SERVICES', icon: 'briefcase' },
        { key: 'results', label: 'WEBSITE_RESULTS', icon: 'trending-up' },
        { key: 'certificates', label: 'CERTIFICATES', icon: 'award' },
        { key: 'testimonials', label: 'TESTIMONIALS', icon: 'message-square' },
        { key: 'social', label: 'WB_SECTION_SOCIAL', icon: 'share-2' },
      ],
    },
    {
      title: 'WB_GROUP_CONVERSION',
      items: [
        { key: 'leadForm', label: 'WB_SECTION_LEAD_FORM', icon: 'inbox' },
        { key: 'cta', label: 'ACTION_BUTTON', icon: 'mouse-pointer' },
        { key: 'announcement', label: 'ANNOUNCEMENT_BAR', icon: 'volume-2' },
      ],
    },
  ];

  readonly presets: ThemePreset[] = THEME_PRESETS;
  readonly sectionKeys: SectionKey[] = SECTION_KEYS;

  readonly layoutOptions: DesignOption<HeroLayout>[] = [
    { value: 'split', label: 'WB_LAYOUT_SPLIT', hint: 'WB_LAYOUT_SPLIT_HINT' },
    { value: 'centered', label: 'WB_LAYOUT_CENTERED', hint: 'WB_LAYOUT_CENTERED_HINT' },
    { value: 'cover', label: 'WB_LAYOUT_COVER', hint: 'WB_LAYOUT_COVER_HINT' },
    { value: 'card', label: 'WB_LAYOUT_CARD', hint: 'WB_LAYOUT_CARD_HINT' },
  ];
  readonly fontOptions: DesignOption<FontPairing>[] = [
    { value: 'modern', label: 'WB_FONT_MODERN', hint: 'Inter' },
    { value: 'editorial', label: 'WB_FONT_EDITORIAL', hint: 'Playfair Display' },
    { value: 'bold', label: 'WB_FONT_BOLD', hint: 'Montserrat' },
    { value: 'friendly', label: 'WB_FONT_FRIENDLY', hint: 'Nunito' },
    { value: 'classic', label: 'WB_FONT_CLASSIC', hint: 'Cormorant' },
  ];
  readonly radiusOptions: DesignOption<Radius>[] = [
    { value: 'sharp', label: 'WB_RADIUS_SHARP' },
    { value: 'soft', label: 'WB_RADIUS_SOFT' },
    { value: 'round', label: 'WB_RADIUS_ROUND' },
  ];
  readonly buttonOptions: DesignOption<ButtonStyle>[] = [
    { value: 'square', label: 'WB_BTN_SQUARE' },
    { value: 'rounded', label: 'WB_BTN_ROUNDED' },
    { value: 'pill', label: 'WB_BTN_PILL' },
  ];
  readonly modeOptions: DesignOption<SiteMode>[] = [
    { value: 'light', label: 'WB_MODE_LIGHT' },
    { value: 'dark', label: 'WB_MODE_DARK' },
  ];
  readonly heroBackgroundOptions: DesignOption<HeroBackground>[] = [
    { value: 'solid', label: 'WB_HERO_SOLID' },
    { value: 'gradient', label: 'WB_HERO_GRADIENT' },
    { value: 'image', label: 'WB_HERO_IMAGE' },
  ];

  activeSection: BuilderSection = 'profile';
  siteSlug = '';
  published = true;
  /** The coach already has a saved website (its public address works). */
  hasSavedSite = false;
  loading = true;
  saving = false;
  saveError = '';
  savedRecently = false;
  uploadingCount = 0;
  uploadError = '';
  private savedSnapshot = '';
  private embedSource: string | null = null;
  private embedUrl: SafeResourceUrl | null = null;
  private savedTimer?: ReturnType<typeof setTimeout>;

  /** Preset the coach started from (saved as themeKey); the options below can then differ from it. */
  selectedPresetKey = THEME_PRESETS[0].key;
  design: WebsiteDesign = normalizeDesign(null);
  colors: SiteColors = { ...THEME_PRESETS[0].colors };
  socialLinks: SocialLinks = { ...EMPTY_SOCIAL_LINKS };
  stats: StatItem[] = [];

  /** Custom domain, as typed; the saved one and its state come from the API. */
  customDomain = '';
  savedCustomDomain = '';
  customDomainStatus: 'PENDING' | 'VERIFIED' | '' = '';
  customDomainToken = '';
  customDomainTarget = 'sites.yo-coach.app';
  publicHost = 'yo-coach.app';
  domainCheck: CustomDomainCheck | null = null;
  verifyingDomain = false;
  domainError = '';
  copiedValue = '';

  ngOnInit(): void {
    this.subscriptionState.brandingLocked().subscribe((locked) => (this.brandingLocked = locked));
    this.loadWebsiteOrUserData();
  }

  goBack(): void { window.history.back(); }

  loadWebsiteOrUserData(): void {
    const saved = this.builderState.getDraft();

    if (saved) {
      // Back from the preview: the edits are kept, and so is what was last saved (to show unsaved changes).
      this.populateFromDraft(saved);
      this.savedSnapshot = saved.savedSnapshot || '';
      this.hasSavedSite = !!saved.hasSavedSite;
      this.published = saved.published !== false;
      this.activeSection = saved.activeSection || this.activeSection;
      this.builderState.clearDraft();
      this.loading = false;
      this.loadPublicProfilePhoto();
      return;
    }

    this.websiteService.getMyWebsite().subscribe({
      next: (website) => {
        if (website) {
          this.populateFromWebsite(website);
          this.hasSavedSite = true;
          this.published = website.published !== false;
          this.savedSnapshot = this.snapshot();
          this.loading = false;
          this.loadPublicProfilePhoto();
        } else {
          this.loadUserProfile();
        }
      },
      error: () => {
        this.loadUserProfile();
      }
    });
  }

  populateFromDraft(saved: any): void {
    this.populateCommon(saved);
    this.video.url = saved.videoUrl || '';
    this.savedCustomDomain = saved.savedCustomDomain || '';
    this.customDomainStatus = saved.customDomainStatus || '';
    this.customDomainToken = saved.customDomainToken || '';
    this.customDomainTarget = saved.customDomainTarget || this.customDomainTarget;
    this.publicHost = saved.publicHost || this.publicHost;
  }

  populateFromWebsite(site: any): void {
    this.populateCommon(site);
    this.video.url = site.video?.url || '';
    // The email box used to do nothing: a website saved with it unchecked still asks for an email, as before.
    if (!this.leadFields.email && !this.leadFields.phone) this.leadFields = { ...this.leadFields, email: true };
    this.savedCustomDomain = site.customDomain || '';
    this.customDomainStatus = site.customDomainStatus || '';
    this.customDomainToken = site.customDomainToken || '';
    this.customDomainTarget = site.customDomainTarget || this.customDomainTarget;
    this.publicHost = site.publicHost || this.publicHost;
  }

  /** Fields the saved site and the preview draft share. */
  private populateCommon(data: any): void {
    this.siteSlug = data.slug || this.siteSlug;
    this.selectedPresetKey = this.presets.some((p) => p.key === data.themeKey)
      ? data.themeKey : (LEGACY_PRESET[data.themeKey] || this.selectedPresetKey);
    this.design = normalizeDesign(data.design, data.themeKey);
    ensureWebsiteFontsLoaded(this.design.font);

    this.profile = data.profile || this.profile;
    this.descriptionBlocks = data.descriptionBlocks || [];
    this.announcement = data.announcement || this.announcement;
    this.cta = data.cta || this.cta;
    this.leadFields = data.leadFields || this.leadFields;
    this.colors = data.colors || this.colors;
    this.socialLinks = { ...EMPTY_SOCIAL_LINKS, ...(data.socialLinks || {}) };
    this.stats = Array.isArray(data.stats) ? data.stats.map((s: any) => ({ value: s?.value || '', label: s?.label || '' })) : [];
    this.customDomain = data.customDomain || '';
    this.services = data.services || [];
    this.results = data.results || [];
    this.certificates = data.certificates || [];
    this.testimonials = data.testimonials || [];
  }

  loadUserProfile(): void {
    this.userService.getUserById(sessionStorage.getItem('userId')).subscribe({
      next: (user) => {
        const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
        this.profile.fullName = fullName;
        // get(), not instant(): on a fresh load the language file may still be on its way.
        this.translate.get('WB_DEFAULT_TITLE').subscribe((title) => { if (!this.profile.title) this.profile.title = title; });
        this.siteSlug = this.normalizeSlug(fullName || user.login || '');

        const avatarUrl = user.avatarUrl?.trim();
        this.profile.image = avatarUrl && avatarUrl.toLowerCase() !== 'not found' ? avatarUrl : '';
        this.savedSnapshot = '';
        this.loading = false;
        this.loadPublicProfilePhoto();
      },
      error: () => (this.loading = false),
    });
  }

  private loadPublicProfilePhoto(): void {
    this.coachSettingsService.loadConfig(true).subscribe({
      next: config => {
        const publicPhoto = config.publicProfile?.photoUrl?.trim();
        if (publicPhoto && !this.profile.image) this.profile.image = publicPhoto;
      },
      error: () => {}
    });
  }

  descriptionBlocks: DescriptionBlock[] = [];

  profile: ProfileSection = {
    image: '',
    fullName: '',
    title: '',
    slogan: '',
    bio: '',
  };

  video: VideoSection = { url: '' };

  announcement: AnnouncementSection = {
    enabled: false,
    message: '',
    bgColor: THEME_PRESETS[0].colors.announcementBg,
    textColor: THEME_PRESETS[0].colors.announcementText,
  };

  cta: CtaSection = {
    enabled: true,
    label: '',
    sticky: false
  };

  leadFields: LeadFieldsSection = {
    firstName: true,
    lastName: true,
    email: true,
    phone: true,
    buttonLabel: ''
  };

  // A new website starts empty: example testimonials, certificates or prices must never be published by mistake.
  results: ResultItem[] = [];
  services: ServiceItem[] = [];
  certificates: CertificateItem[] = [];
  testimonials: TestimonialItem[] = [];

  setSection(section: BuilderSection): void {
    this.activeSection = section;
    if (window.innerWidth < 900) {
      setTimeout(() => document.querySelector('.wb-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    }
  }

  /** Short summary shown next to a section in the menu (a count, or nothing). */
  sectionMeta(section: BuilderSection): string {
    switch (section) {
      case 'services': return this.services.length ? `${this.services.length}` : '';
      case 'results': return this.results.length ? `${this.results.length}` : '';
      case 'certificates': return this.certificates.length ? `${this.certificates.length}` : '';
      case 'testimonials': return this.testimonials.length ? `${this.testimonials.length}` : '';
      case 'description': return this.filledBlocks().length ? `${this.filledBlocks().length}` : '';
      case 'stats': return this.filledStats().length ? `${this.filledStats().length}` : '';
      case 'social': { const n = this.socialCount; return n ? `${n}` : ''; }
      default: return '';
    }
  }

  /** Whether a section has what the page needs (a dot in the menu tells the coach what is left). */
  sectionDone(section: BuilderSection): boolean {
    switch (section) {
      case 'address': return !this.slugError;
      case 'domain': return !this.customDomain.trim() || this.customDomainStatus === 'VERIFIED';
      case 'theme': return true;
      case 'sections': return true;
      case 'profile': return !!(this.profile.fullName?.trim() && this.profile.title?.trim() && this.profile.bio?.trim());
      case 'video': return !!this.videoEmbedUrl;
      case 'description': return this.filledBlocks().length > 0;
      case 'stats': return this.filledStats().length > 0;
      case 'services': return this.services.length > 0;
      case 'results': return this.results.length > 0;
      case 'certificates': return this.certificates.length > 0;
      case 'testimonials': return this.testimonials.length > 0;
      case 'social': return this.socialCount > 0;
      case 'leadForm': return this.leadFields.email || this.leadFields.phone;
      case 'cta': return this.cta.enabled;
      case 'announcement': return this.announcement.enabled && !!this.announcement.message.trim();
    }
  }

  get completion(): number {
    const keys: BuilderSection[] = ['profile', 'description', 'services', 'results', 'testimonials', 'video', 'social'];
    return Math.round(keys.filter((key) => this.sectionDone(key)).length / keys.length * 100);
  }

  get socialCount(): number {
    return Object.values(this.socialLinks).filter((v) => !!v?.trim()).length;
  }

  // ---------- Design ----------

  get selectedPreset(): ThemePreset {
    return this.presets.find((p) => p.key === this.selectedPresetKey) ?? this.presets[0];
  }

  /** The preset fills the look; the coach's own hero photo and the order of the sections are kept. */
  applyPreset(preset: ThemePreset): void {
    this.selectedPresetKey = preset.key;
    this.design = { ...this.design, ...preset.design };
    this.colors = { ...preset.colors };
    this.announcement.bgColor = preset.colors.announcementBg;
    this.announcement.textColor = preset.colors.announcementText;
    ensureWebsiteFontsLoaded(this.design.font);
  }

  resetThemeColors(): void {
    this.colors = { ...this.selectedPreset.colors };
  }

  setDesign<K extends keyof WebsiteDesign>(key: K, value: WebsiteDesign[K]): void {
    this.design = { ...this.design, [key]: value };
    if (key === 'font') ensureWebsiteFontsLoaded(value as FontPairing);
  }

  /** Text color that reads on a color (for the swatches and samples). */
  readableOn(color: string): string { return readableTextOn(color); }

  onHeroImageSelected(event: Event): void {
    const file = this.pickImage(event);
    if (file) this.uploadWebsiteImage(file, url => this.setDesign('heroImage', url));
  }

  removeHeroImage(): void { this.setDesign('heroImage', ''); }

  // ---------- Sections order ----------

  sectionHidden(key: SectionKey): boolean { return this.design.hiddenSections.includes(key); }

  toggleSectionVisible(key: SectionKey): void {
    if (key === 'contact') return;
    const hidden = this.sectionHidden(key)
      ? this.design.hiddenSections.filter((k) => k !== key)
      : [...this.design.hiddenSections, key];
    this.setDesign('hiddenSections', hidden);
  }

  moveSection(key: SectionKey, direction: -1 | 1): void {
    const order = [...this.design.sectionOrder];
    const index = order.indexOf(key);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    this.setDesign('sectionOrder', order);
  }

  resetSectionOrder(): void {
    this.setDesign('sectionOrder', [...SECTION_KEYS]);
  }

  /** Whether the page has something to show in a section (hidden or not). */
  sectionHasContent(key: SectionKey): boolean {
    switch (key) {
      case 'video': return !!this.videoEmbedUrl;
      case 'about': return this.filledBlocks().length > 0 || !!this.profile.bio?.trim();
      case 'stats': return this.filledStats().length > 0;
      case 'services': return this.services.length > 0;
      case 'results': return this.results.length > 0;
      case 'certificates': return this.certificates.length > 0;
      case 'testimonials': return this.testimonials.length > 0;
      case 'contact': return true;
    }
  }

  // ---------- Stats ----------

  addStat(): void {
    if (this.stats.length >= 4) return;
    this.stats.push({ value: '', label: '' });
  }

  removeStat(index: number): void {
    this.stats.splice(index, 1);
  }

  private filledStats(): StatItem[] {
    return this.stats.filter((s) => s.value?.trim() && s.label?.trim());
  }

  // ---------- Address / domain ----------

  get normalizedSlug(): string {
    return this.normalizeSlug(this.siteSlug);
  }

  get slugError(): string {
    const slug = this.normalizedSlug;
    if (slug.length < 3 || slug.length > 40) return 'WB_SLUG_LENGTH_ERROR';
    if (RESERVED_SLUGS.has(slug)) return 'WB_SLUG_RESERVED_ERROR';
    return '';
  }

  get slugSiteUrl(): string {
    return `https://${this.normalizedSlug || '…'}.${this.publicHost}`;
  }

  /** The address visitors use: the coach's domain once it is verified, the slug otherwise. */
  get publicSiteUrl(): string {
    return this.customDomainStatus === 'VERIFIED' && this.savedCustomDomain && this.savedCustomDomain === this.normalizedDomain
      ? `https://${this.savedCustomDomain}` : this.slugSiteUrl;
  }

  get normalizedDomain(): string {
    return this.customDomain.trim().toLowerCase()
      .replace(/^[a-z]+:\/\//, '').replace(/[/?#].*$/, '').replace(/:\d+$/, '').replace(/^www\./, '').replace(/\.$/, '');
  }

  get customDomainError(): string {
    const domain = this.normalizedDomain;
    if (!domain) return '';
    if (!DOMAIN_PATTERN.test(domain)) return 'WB_DOMAIN_INVALID';
    if (domain === this.publicHost || domain.endsWith('.' + this.publicHost)) return 'WB_DOMAIN_PLATFORM';
    return '';
  }

  /** The DNS records can only be checked once the domain typed is the one saved. */
  get domainSaved(): boolean {
    return this.hasSavedSite && !!this.savedCustomDomain && this.savedCustomDomain === this.normalizedDomain;
  }

  verifyDomain(): void {
    if (!this.domainSaved || this.verifyingDomain) return;
    this.verifyingDomain = true;
    this.domainError = '';
    this.websiteService.verifyCustomDomain().subscribe({
      next: (check) => {
        this.verifyingDomain = false;
        this.domainCheck = check;
        this.customDomainStatus = check.status;
      },
      error: (err) => {
        this.verifyingDomain = false;
        this.domainError = err?.error?.error || this.translate.instant('WB_DOMAIN_CHECK_ERROR');
      },
    });
  }

  copyValue(value: string): void {
    if (!value) return;
    navigator.clipboard?.writeText(value).then(() => {
      this.copiedValue = value;
      setTimeout(() => (this.copiedValue = ''), 1800);
    });
  }

  /** Created again only when the link changes: a new object on every check would reload the iframe each time. */
  get videoEmbedUrl(): SafeResourceUrl | null {
    if (this.embedSource !== this.video.url) {
      this.embedSource = this.video.url;
      const embed = toWebsiteVideoEmbedUrl(this.video.url);
      this.embedUrl = embed ? this.sanitizer.bypassSecurityTrustResourceUrl(embed) : null;
    }
    return this.embedUrl;
  }

  get videoUrlInvalid(): boolean {
    return !!this.video.url.trim() && !this.videoEmbedUrl;
  }

  get dirty(): boolean {
    return !this.loading && this.snapshot() !== this.savedSnapshot;
  }

  get canSave(): boolean {
    return !this.brandingLocked && !this.saving && !this.uploadingCount && !this.slugError && !this.customDomainError
      && (this.dirty || !this.hasSavedSite);
  }

  openPreview(): void {
    const data = {
      ...this.payload(),
      videoUrl: this.video.url,
      savedSnapshot: this.savedSnapshot,
      hasSavedSite: this.hasSavedSite,
      activeSection: this.activeSection,
      savedCustomDomain: this.savedCustomDomain,
      customDomainStatus: this.customDomainStatus,
      customDomainToken: this.customDomainToken,
      customDomainTarget: this.customDomainTarget,
      publicHost: this.publicHost,
    };
    this.builderState.setDraft(data);

    this.router.navigate(['/websites/preview'], {
      state: data
    });
  }

  openPublicSite(): void {
    if (this.hasSavedSite) window.open(this.publicSiteUrl, '_blank', 'noopener');
  }

  saveWebsite(): void {
    if (!this.canSave) {
      if (this.slugError) this.activeSection = 'address';
      else if (this.customDomainError) this.activeSection = 'domain';
      return;
    }
    const payload = this.payload();
    this.saving = true;
    this.saveError = '';
    this.websiteService.saveMyWebsite(payload).subscribe({
      next: (saved) => {
        this.saving = false;
        this.hasSavedSite = true;
        this.siteSlug = saved?.slug || payload.slug;
        this.descriptionBlocks = this.filledBlocks();
        this.stats = this.filledStats();
        this.customDomain = saved?.customDomain || '';
        this.savedCustomDomain = saved?.customDomain || '';
        this.customDomainStatus = saved?.customDomainStatus || '';
        this.customDomainToken = saved?.customDomainToken || '';
        this.customDomainTarget = saved?.customDomainTarget || this.customDomainTarget;
        this.publicHost = saved?.publicHost || this.publicHost;
        if (!this.savedCustomDomain) this.domainCheck = null;
        this.savedSnapshot = this.snapshot();
        this.savedRecently = true;
        clearTimeout(this.savedTimer);
        this.savedTimer = setTimeout(() => (this.savedRecently = false), 3000);
      },
      error: (err) => {
        this.saving = false;
        const body = err?.error;
        this.saveError = body?.error || body?.message || (typeof body === 'string' && body.length < 200 ? body : '')
          || this.translate.instant('WB_SAVE_ERROR');
      }
    });
  }

  togglePublished(): void {
    this.published = !this.published;
  }

  /** At least one way to reach the visitor stays in the form. */
  toggleContactField(field: 'email' | 'phone'): void {
    const other = field === 'email' ? 'phone' : 'email';
    if (this.leadFields[field] && !this.leadFields[other]) return;
    this.leadFields = { ...this.leadFields, [field]: !this.leadFields[field] };
  }

  onProfileImageSelected(event: Event): void {
    const file = this.pickImage(event);
    if (file) this.uploadWebsiteImage(file, url => this.profile.image = url);
  }

  removeProfileImage(): void {
    this.profile.image = '';
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 11);
  }

  private normalizeSlug(value: string): string {
    return (value || '')
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private filledBlocks(): DescriptionBlock[] {
    return this.descriptionBlocks.filter((block) => block.content?.trim());
  }

  private payload() {
    return {
      slug: this.normalizedSlug,
      themeKey: this.selectedPreset.key,
      themeName: this.selectedPreset.name,
      design: this.design,
      socialLinks: this.socialLinks,
      stats: this.filledStats(),
      customDomain: this.normalizedDomain,
      descriptionBlocks: this.filledBlocks(),
      profile: this.profile,
      video: { url: this.video.url.trim() },
      announcement: this.announcement,
      cta: this.cta,
      leadFields: this.leadFields,
      colors: this.colors,
      services: this.services,
      results: this.results,
      certificates: this.certificates,
      testimonials: this.testimonials,
      published: this.published,
    };
  }

  private snapshot(): string {
    return JSON.stringify(this.payload());
  }

  addBlock(type: DescriptionBlockType): void {
    this.descriptionBlocks.push({
      id: this.generateId(),
      type,
      content: ''
    });
  }

  updateBlock(id: string, updates: Partial<DescriptionBlock>): void {
    const block = this.descriptionBlocks.find(item => item.id === id);
    if (!block) return;

    Object.assign(block, updates);
    this.descriptionBlocks = [...this.descriptionBlocks];
  }

  removeBlock(id: string): void {
    this.descriptionBlocks = this.descriptionBlocks.filter(block => block.id !== id);
  }

  moveBlockUp(id: string): void {
    const index = this.descriptionBlocks.findIndex(block => block.id === id);
    if (index <= 0) return;

    const updated = [...this.descriptionBlocks];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    this.descriptionBlocks = updated;
  }

  moveBlockDown(id: string): void {
    const index = this.descriptionBlocks.findIndex(block => block.id === id);
    if (index === -1 || index >= this.descriptionBlocks.length - 1) return;

    const updated = [...this.descriptionBlocks];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    this.descriptionBlocks = updated;
  }

  addResult(): void {
    this.results.push({ beforeImage: '', afterImage: '', text: '' });
  }

  removeResult(index: number): void {
    this.results.splice(index, 1);
  }

  addService(): void {
    this.services.push({ image: '', title: '', price: '', description: '' });
  }

  removeService(index: number): void {
    this.services.splice(index, 1);
  }

  addCertificate(): void {
    this.certificates.push({ image: '', title: '', organization: '', year: new Date().getFullYear().toString() });
  }

  removeCertificate(index: number): void {
    this.certificates.splice(index, 1);
  }

  addTestimonial(): void {
    this.testimonials.push({ author: '', rating: 5, text: '' });
  }

  removeTestimonial(index: number): void {
    this.testimonials.splice(index, 1);
  }

  onBlockImageSelected(id: string, event: Event): void {
    const file = this.pickImage(event);
    if (file) this.uploadWebsiteImage(file, url => this.updateBlock(id, { content: url }));
  }

  onServiceImageSelected(index: number, event: Event): void {
    const file = this.pickImage(event);
    if (file) this.uploadWebsiteImage(file, url => this.services[index].image = url);
  }

  onCertificateImageSelected(index: number, event: Event): void {
    const file = this.pickImage(event);
    if (file) this.uploadWebsiteImage(file, url => this.certificates[index].image = url);
  }

  onResultImageSelected(index: number, type: 'before' | 'after', event: Event): void {
    const file = this.pickImage(event);
    if (!file) return;
    this.uploadWebsiteImage(file, url => {
      if (type === 'before') this.results[index].beforeImage = url; else this.results[index].afterImage = url;
    });
  }

  trackByBlockId(index: number, block: DescriptionBlock): string {
    return block.id;
  }

  trackByIndex(index: number): number {
    return index;
  }

  /** CSS background for an uploaded image; quoted so a URL with parentheses keeps the rule valid. */
  cssImage(url?: string): string {
    return url ? `url("${url.replace(/"/g, '%22')}")` : '';
  }

  /** The selected file when it is an image of at most 5 MB; the input is cleared so the same file can be picked again. */
  private pickImage(event: Event): File | null {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    input.value = '';
    this.uploadError = '';
    if (!file) return null;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.uploadError = this.translate.instant('CONTACT_IMAGE_TYPE_ERROR');
      return null;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.uploadError = this.translate.instant('CONTACT_IMAGE_SIZE_ERROR');
      return null;
    }
    return file;
  }

  private uploadWebsiteImage(file: File, onUploaded: (url: string) => void): void {
    const extension = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '';
    const storedFile = new File(
      [file],
      `website-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${extension}`,
      { type: file.type, lastModified: file.lastModified }
    );
    const ownerId = sessionStorage.getItem('userId') || 'coach';
    this.uploadingCount++;
    this.documentService.uploadFileInPath(storedFile, `coach-websites/${ownerId}`).subscribe({
      next: (url) => {
        this.uploadingCount--;
        onUploaded(url);
      },
      error: () => {
        this.uploadingCount--;
        this.uploadError = this.translate.instant('CONTACT_IMAGE_UPLOAD_ERROR');
      }
    });
  }
}
