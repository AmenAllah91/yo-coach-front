import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { Router } from "@angular/router";
import { SafeResourceUrl } from "@angular/platform-browser";

@Component({
  selector: 'app-coach-landing-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './coach-landing-preview.component.html',
  styleUrls: ['./coach-landing-preview.component.scss']
})
export class CoachLandingPreviewComponent {
  @Input() themeKey: 'elegance' | 'dynamic' | 'trust' | 'serenity' = 'elegance';
  @Input() themeName = 'Élégance';

  @Input() profile: any;
  @Input() videoEmbedUrl: SafeResourceUrl | null = null;
  @Input() announcement: any;
  @Input() cta: any;
  @Input() leadFields: any;
  @Input() colors: any;
  @Input() services: any[] = [];
  @Input() results: any[] = [];
  @Input() certificates: any[] = [];
  @Input() testimonials: any[] = [];

  @Input() publicMode = false;

  constructor(private router: Router) {}

  closePreview(): void {
    if (!this.publicMode) {
      this.router.navigate(['/websites/create']);
    }
  }

  getStars(count: number): string[] {
    return Array.from({ length: count || 5 });
  }

  trackByIndex(index: number): number {
    return index;
  }
}
