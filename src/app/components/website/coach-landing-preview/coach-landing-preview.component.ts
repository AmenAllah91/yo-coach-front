import { CommonModule, Location } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SafeResourceUrl } from '@angular/platform-browser';
import { WebsiteService } from '../../../service/website.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../../service/language.service';
import {
  FONT_PAIRINGS, SectionKey, SocialLinks, StatItem, WebsiteDesign,
  ensureWebsiteFontsLoaded, initialsOf, normalizeDesign, readableTextOn, whatsappLink,
} from '../models/website-design';

interface SocialEntry { key: keyof SocialLinks; url: string; label: string; }

/**
 * The coach's public page, rendered from the saved content and design. One template: the hero layout, fonts,
 * corners, colors and the order of the sections are CSS variables and class names, so every combination works.
 */
@Component({
  selector: 'app-coach-landing-preview',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './coach-landing-preview.component.html',
  styleUrls: ['./coach-landing-preview.component.scss']
})
export class CoachLandingPreviewComponent implements OnChanges {
  @Input() themeKey = 'studio';
  @Input() themeName = 'Studio';

  @Input() profile: any = {};
  @Input() videoEmbedUrl: SafeResourceUrl | null = null;
  @Input() announcement: any = {};
  @Input() cta: any = {};
  @Input() leadFields: any = {};
  @Input() colors: any = {};
  @Input() services: any[] = [];
  @Input() results: any[] = [];
  @Input() certificates: any[] = [];
  @Input() testimonials: any[] = [];
  @Input() descriptionBlocks: any[] = [];
  @Input() design: Partial<WebsiteDesign> | null = null;
  @Input() socialLinks: Partial<SocialLinks> | null = null;
  @Input() stats: StatItem[] = [];
  @Input() publicSlug: string | null = null;

  @Input() publicMode = false;

  /** Preview only: the page shown at phone width. */
  mobileView = false;
  /** The profile photo could not be loaded (expired link, deleted file): the avatar takes its place. */
  imageFailed = false;

  leadForm = this.emptyLeadForm();
  submittingLead = false;
  leadSuccess = false;
  leadError = '';

  private resolvedDesign: WebsiteDesign = normalizeDesign(null);

  constructor(
    private location: Location,
    private websiteService: WebsiteService,
    private translate: TranslateService,
    private languageService: LanguageService
  ) {
    this.translate.use(this.languageService.getCurrentLanguage());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['design'] || changes['themeKey']) {
      this.resolvedDesign = normalizeDesign(this.design, this.themeKey);
      ensureWebsiteFontsLoaded(this.resolvedDesign.font);
    }
    if (changes['profile']) this.imageFailed = false;
  }

  get d(): WebsiteDesign { return this.resolvedDesign; }

  get rootClasses(): string[] {
    const d = this.d;
    return [`cs--layout-${d.layout}`, `cs--font-${d.font}`, `cs--radius-${d.radius}`, `cs--btn-${d.buttonStyle}`,
      `cs--${d.mode}`, `cs--hero-${d.heroBackground}`];
  }

  get fontHeading(): string { return (FONT_PAIRINGS[this.d.font] || FONT_PAIRINGS.modern).heading; }
  get fontBody(): string { return (FONT_PAIRINGS[this.d.font] || FONT_PAIRINGS.modern).body; }
  get onPrimary(): string { return readableTextOn(this.colors?.primary); }
  get onAccent(): string { return readableTextOn(this.colors?.accent); }

  /** Cover photo of the hero; the coach's photo when the hero wants an image but none was uploaded. */
  get heroImage(): string {
    if (this.d.heroBackground !== 'image') return '';
    const url = this.d.heroImage || (this.imageFailed ? '' : this.profile?.image) || '';
    return url ? `url("${url.replace(/"/g, '%22')}")` : '';
  }

  get avatarSrc(): string {
    return this.imageFailed ? '' : (this.profile?.image || '');
  }

  get initials(): string { return initialsOf(this.profile?.fullName); }

  get socials(): SocialEntry[] {
    const links = this.socialLinks || {};
    const entries: SocialEntry[] = [
      { key: 'instagram', url: links.instagram || '', label: 'Instagram' },
      { key: 'facebook', url: links.facebook || '', label: 'Facebook' },
      { key: 'tiktok', url: links.tiktok || '', label: 'TikTok' },
      { key: 'youtube', url: links.youtube || '', label: 'YouTube' },
      { key: 'linkedin', url: links.linkedin || '', label: 'LinkedIn' },
      { key: 'whatsapp', url: whatsappLink(links.whatsapp), label: 'WhatsApp' },
    ];
    return entries.filter((entry) => !!entry.url.trim());
  }

  /** Sections the coach filled, in their order; the contact form is always there. */
  get visibleSections(): SectionKey[] {
    return this.d.sectionOrder.filter((key) => key === 'contact' || (!this.d.hiddenSections.includes(key) && this.hasContent(key)));
  }

  hasContent(key: SectionKey): boolean {
    switch (key) {
      case 'video': return !!this.videoEmbedUrl;
      case 'about': return this.hasDescriptionBlocks || !!this.profile?.bio?.trim();
      case 'stats': return this.filledStats.length > 0;
      case 'services': return this.services?.length > 0;
      case 'results': return this.results?.length > 0;
      case 'certificates': return this.certificates?.length > 0;
      case 'testimonials': return this.testimonials?.length > 0;
      case 'contact': return true;
    }
  }

  get filledStats(): StatItem[] {
    return (this.stats || []).filter((stat) => stat?.value?.trim() && stat?.label?.trim());
  }

  get hasDescriptionBlocks(): boolean {
    return Array.isArray(this.descriptionBlocks) && this.descriptionBlocks.length > 0;
  }

  get ctaLabel(): string {
    return this.cta?.label?.trim() || this.translate.instant('WB_CTA_PLACEHOLDER');
  }

  get leadButtonLabel(): string {
    return this.leadFields?.buttonLabel?.trim() || this.translate.instant('WB_LEAD_BUTTON_PLACEHOLDER');
  }

  get year(): number { return new Date().getFullYear(); }

  closePreview(): void {
    if (!this.publicMode) this.location.back();
  }

  getStars(count: number): string[] {
    return Array.from({ length: Math.min(5, Math.max(1, count || 5)) });
  }

  trackByIndex(index: number): number { return index; }

  /** Quoted so a URL with parentheses keeps the rule valid. */
  cssImage(url?: string): string {
    return url ? `url("${url.replace(/"/g, '%22')}")` : '';
  }

  scrollToContact(): void {
    document.getElementById('cs-contact')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  submitLead(): void {
    this.leadSuccess = false;
    this.leadError = '';

    if (!this.publicSlug) {
      this.leadError = this.translate.instant(this.publicMode ? 'PUBLIC_SLUG_NOT_FOUND' : 'PREVIEW_SUBMISSIONS_DISABLED');
      return;
    }

    // Only the fields the coach shows count; the visitor must leave at least one way to be reached.
    const email = this.leadFields?.email ? this.leadForm.email.trim() : '';
    const phone = this.leadFields?.phone ? this.leadForm.phone.trim() : '';
    if (!email && !phone) {
      this.leadError = this.translate.instant(this.leadFields?.email && this.leadFields?.phone
        ? 'LEAD_CONTACT_REQUIRED' : this.leadFields?.phone ? 'LEAD_PHONE_REQUIRED' : 'CONTACT_ERROR_EMAIL_REQUIRED');
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.leadError = this.translate.instant('CONTACT_ERROR_EMAIL_INVALID');
      return;
    }
    if (phone && !/^\+?[0-9 ().-]{6,30}$/.test(phone)) {
      this.leadError = this.translate.instant('LEAD_PHONE_INVALID');
      return;
    }

    this.submittingLead = true;

    this.websiteService.submitPublicLead(this.publicSlug, {
      firstName: this.leadFields?.firstName ? this.leadForm.firstName.trim() : undefined,
      lastName: this.leadFields?.lastName ? this.leadForm.lastName.trim() : undefined,
      email: email || undefined,
      phone: phone || undefined,
      message: this.leadForm.message.trim() || undefined,
      website: this.leadForm.website,
    }).subscribe({
      next: () => {
        this.submittingLead = false;
        this.leadSuccess = true;
        this.leadForm = this.emptyLeadForm();
      },
      error: (err) => {
        this.submittingLead = false;
        this.leadError = this.translate.instant(err?.status === 429 ? 'CONTACT_ERROR_TOO_MANY' : 'REQUEST_SEND_ERROR');
      }
    });
  }

  private emptyLeadForm() {
    return { firstName: '', lastName: '', email: '', phone: '', message: '', website: '' };
  }
}
