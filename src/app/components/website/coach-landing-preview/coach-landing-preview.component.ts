import { CommonModule, Location } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SafeResourceUrl } from '@angular/platform-browser';
import { WebsiteService } from '../../../service/website.service';

@Component({
  selector: 'app-coach-landing-preview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './coach-landing-preview.component.html',
  styleUrls: ['./coach-landing-preview.component.scss']
})
export class CoachLandingPreviewComponent {
  @Input() themeKey: 'elegance' | 'dynamic' | 'trust' | 'serenity' = 'elegance';
  @Input() themeName = 'Élégance';

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
  @Input() publicSlug: string | null = null;

  @Input() publicMode = false;

  leadForm = {
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  };

  submittingLead = false;
  leadSuccess = false;
  leadError = '';

  constructor(
    private location: Location,
    private websiteService: WebsiteService
  ) {}

  closePreview(): void {
    if (!this.publicMode) {
      this.location.back();
    }
  }

  getStars(count: number): string[] {
    return Array.from({ length: count || 5 });
  }

  trackByIndex(index: number): number {
    return index;
  }

  get hasDescriptionBlocks(): boolean {
    return Array.isArray(this.descriptionBlocks) && this.descriptionBlocks.length > 0;
  }

  submitLead(): void {
    this.leadSuccess = false;
    this.leadError = '';

    if (!this.publicSlug) {
      this.leadError = 'Slug public introuvable.';
      return;
    }

    if (!this.leadForm.phone?.trim()) {
      this.leadError = 'Le Téléphone est requis.';
      return;
    }

    this.submittingLead = true;

    this.websiteService.submitPublicLead(this.publicSlug, {
      firstName: this.leadFields?.firstName ? this.leadForm.firstName : undefined,
      lastName: this.leadFields?.lastName ? this.leadForm.lastName : undefined,
      email: this.leadForm.email,
      phone: this.leadFields?.phone ? this.leadForm.phone : undefined
    }).subscribe({
      next: () => {
        this.submittingLead = false;
        this.leadSuccess = true;
        this.leadForm = {
          firstName: '',
          lastName: '',
          email: '',
          phone: ''
        };
      },
      error: () => {
        this.submittingLead = false;
        this.leadError = 'Une erreur est survenue lors de l’envoi.';
      }
    });
  }
}
