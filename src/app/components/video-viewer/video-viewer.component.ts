import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LanguageService } from 'app/service/language.service';

@Component({
  selector: 'app-video-viewer',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './video-viewer.component.html',
  styleUrl: './video-viewer.component.scss',
})
export class VideoViewerComponent {
  videoUrl: SafeResourceUrl | null = null;
  originalUrl = '';
  title = '';
  loadingShort = false;

  constructor(
    private route: ActivatedRoute,
    private sanitizer: DomSanitizer,
    private translate: TranslateService,
    private languageService: LanguageService,
  ) {
    this.translate.use(this.languageService.getCurrentLanguage());
    const url = this.route.snapshot.queryParamMap.get('url') ?? '';
    const title = this.route.snapshot.queryParamMap.get('title') ?? '';

    this.originalUrl = url;
    this.title = title;

    if (this.isYouTubeShort(url)) {
      this.loadingShort = true;

      setTimeout(() => {
        window.location.replace(url);
      }, 300);

      return;
    }

    const embedUrl = this.toEmbedUrl(url);

    if (embedUrl) {
      this.videoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
    }
  }

  get displayTitle(): string {
    return this.title || this.translate.instant('EXERCISE_VIDEO');
  }

  private isYouTubeShort(url: string): boolean {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      const segments = parsed.pathname.split('/').filter(Boolean);

      return host.includes('youtube.com') && segments[0] === 'shorts';
    } catch {
      return false;
    }
  }

  private toEmbedUrl(url: string): string | null {
    if (!url.trim()) return null;

    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      const segments = parsed.pathname.split('/').filter(Boolean);

      let videoId = '';

      if (host.includes('youtu.be')) {
        videoId = segments[0] ?? '';
      }

      if (host.includes('youtube.com')) {
        videoId = parsed.searchParams.get('v') ?? '';

        if (!videoId && segments[0] === 'embed') {
          videoId = segments[1] ?? '';
        }

        if (!videoId && segments[0] === 'shorts') {
          videoId = segments[1] ?? '';
        }
      }

      videoId = videoId.split('?')[0].split('&')[0].trim();

      if (!videoId) return null;

      return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1`;
    } catch {
      return null;
    }
  }
}
