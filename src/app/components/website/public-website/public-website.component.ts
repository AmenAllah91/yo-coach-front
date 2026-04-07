import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CoachLandingPreviewComponent } from '../coach-landing-preview/coach-landing-preview.component';
import { WebsiteService } from '../../../service/website.service';

@Component({
  selector: 'app-public-website',
  standalone: true,
  imports: [CommonModule, CoachLandingPreviewComponent],
  template: `
    <div *ngIf="loading" class="public-site-state">Chargement...</div>
    <div *ngIf="error" class="public-site-state">Site introuvable</div>

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
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      background: #f8fafc;
      color: #1f2937;
    }
  `]
})
export class PublicWebsiteComponent implements OnInit {
  website: any = null;
  loading = true;
  error = false;
  videoEmbedUrl: SafeResourceUrl | null = null;

  constructor(
    private websiteService: WebsiteService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    const slug = this.extractSlugFromHost();

    if (!slug) {
      this.error = true;
      this.loading = false;
      return;
    }

    this.websiteService.getPublicWebsite(slug).subscribe({
      next: (res) => {
        this.website = res;
        this.videoEmbedUrl = this.buildSafeVideoUrl(res?.video?.url);
        this.loading = false;
      },
      error: () => {
        this.error = true;
        this.loading = false;
      }
    });
  }

  private extractSlugFromHost(): string | null {
    const host = window.location.hostname;

    const parts = host.split('.');

    if (parts.length >= 3) {
      return parts[0];
    }

    return null;
  }

  private buildSafeVideoUrl(url: string): SafeResourceUrl | null {
    const embedUrl = this.toEmbedUrl(url);
    return embedUrl
      ? this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl)
      : null;
  }

  private toEmbedUrl(url: string): string {
    if (!url) return '';

    const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/i);
    if (youtubeMatch?.[1]) {
      return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    }

    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/i);
    if (vimeoMatch?.[1]) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }

    return '';
  }
}
