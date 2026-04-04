import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CoachLandingPreviewComponent } from "../coach-landing-preview/coach-landing-preview.component";

@Component({
  selector: 'app-coach-landing-preview-page',
  standalone: true,
  imports: [CommonModule, CoachLandingPreviewComponent],
  template: `
    <app-coach-landing-preview
      [themeKey]="data.themeKey"
      [themeName]="data.themeName"
      [profile]="data.profile"
      [videoEmbedUrl]="videoEmbedUrl"
      [announcement]="data.announcement"
      [cta]="data.cta"
      [leadFields]="data.leadFields"
      [colors]="data.colors"
      [services]="data.services"
      [results]="data.results"
      [certificates]="data.certificates"
      [testimonials]="data.testimonials">
    </app-coach-landing-preview>
  `
})
export class CoachLandingPreviewPageComponent {
  data = history.state;
  videoEmbedUrl: SafeResourceUrl | null = null;

  constructor(
    private router: Router,
    private sanitizer: DomSanitizer
  ) {
    this.videoEmbedUrl = this.buildSafeVideoUrl(this.data.videoUrl);
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
