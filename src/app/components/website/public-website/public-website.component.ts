import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { DomSanitizer, Meta, SafeResourceUrl, Title } from '@angular/platform-browser';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../../service/language.service';
import { toWebsiteVideoEmbedUrl } from '../models/website-video';
import { CoachLandingPreviewComponent } from '../coach-landing-preview/coach-landing-preview.component';
import { WebsiteService } from '../../../service/website.service';

/** A coach's public site: the API tells which site answers on this host (slug.yo-coach.app or the coach's domain). */
@Component({
  selector: 'app-public-website',
  standalone: true,
  imports: [CommonModule, TranslateModule, CoachLandingPreviewComponent],
  template: `
    <div *ngIf="loading" class="public-site-state"><span class="public-site-spinner"></span></div>
    <div *ngIf="error" class="public-site-state">
      <strong>{{ 'PUBLIC_SITE_NOT_FOUND' | translate }}</strong>
      <span>{{ 'PUBLIC_SITE_NOT_FOUND_HINT' | translate }}</span>
    </div>

    <app-coach-landing-preview
      *ngIf="!loading && !error && website"
      [publicMode]="true"
      [publicSlug]="website.slug"
      [themeKey]="website.themeKey"
      [themeName]="website.themeName"
      [profile]="website.profile"
      [videoEmbedUrl]="videoEmbedUrl"
      [announcement]="website.announcement"
      [cta]="website.cta"
      [leadFields]="website.leadFields"
      [colors]="website.colors"
      [design]="website.design"
      [socialLinks]="website.socialLinks"
      [stats]="website.stats || []"
      [descriptionBlocks]="website.descriptionBlocks || []"
      [services]="website.services || []"
      [results]="website.results || []"
      [certificates]="website.certificates || []"
      [testimonials]="website.testimonials || []">
    </app-coach-landing-preview>
  `,
  styles: [`
    .public-site-state {
      min-height: 100vh;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: #f8fafc;
      color: #1f2937;
      text-align: center;
    }
    .public-site-state strong { font-size: 20px; }
    .public-site-state span { color: #64748b; font-size: 15px; }
    .public-site-spinner {
      width: 26px;
      height: 26px;
      border: 2px solid #d6e2ec;
      border-top-color: #44b4df;
      border-radius: 50%;
      animation: public-site-spin .8s linear infinite;
    }
    @keyframes public-site-spin { to { transform: rotate(360deg); } }
  `]
})
export class PublicWebsiteComponent implements OnInit {
  website: any = null;
  loading = true;
  error = false;
  videoEmbedUrl: SafeResourceUrl | null = null;

  constructor(
    private websiteService: WebsiteService,
    private sanitizer: DomSanitizer,
    private title: Title,
    private meta: Meta,
    translate: TranslateService,
    languageService: LanguageService,
  ) {
    translate.use(languageService.getCurrentLanguage());
  }

  ngOnInit(): void {
    const host = window.location.hostname;
    // Local check of a site: http://localhost:4200/site?slug=xxx
    const slug = new URLSearchParams(window.location.search).get('slug');
    const request = slug ? this.websiteService.getPublicWebsite(slug) : this.websiteService.resolvePublicWebsite(host);

    request.subscribe({
      next: (res) => {
        this.website = res;
        this.videoEmbedUrl = this.buildSafeVideoUrl(res?.video?.url);
        this.loading = false;
        this.describePage(res);
      },
      error: () => {
        this.error = true;
        this.loading = false;
      }
    });
  }

  /** Tab title and the text shown when the link is shared (for crawlers that run scripts). */
  private describePage(site: any): void {
    const name = site?.profile?.fullName?.trim();
    const headline = [name, site?.profile?.title?.trim()].filter(Boolean).join(' · ');
    if (headline) this.title.setTitle(headline);
    const description = (site?.profile?.slogan || site?.profile?.bio || '').trim().slice(0, 160);
    if (description) {
      this.meta.updateTag({ name: 'description', content: description });
      this.meta.updateTag({ property: 'og:description', content: description });
    }
    if (headline) this.meta.updateTag({ property: 'og:title', content: headline });
    if (site?.profile?.image) this.meta.updateTag({ property: 'og:image', content: site.profile.image });
  }

  private buildSafeVideoUrl(url: string): SafeResourceUrl | null {
    const embedUrl = toWebsiteVideoEmbedUrl(url);
    return embedUrl
      ? this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl)
      : null;
  }
}
