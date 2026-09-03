import { CommonModule } from '@angular/common';
import {Component, Input, OnInit} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {CoachLandingPreviewComponent} from "../coach-landing-preview/coach-landing-preview.component";
import {Router} from "@angular/router";
import {DomSanitizer, SafeResourceUrl} from "@angular/platform-browser";
import {WebsiteService} from "../../../service/website.service";
import {WebsiteBuilderStateService} from "../../../service/website-builder-state.service";
import {UsersService} from "../../../service/users.service";
import {DocumentService} from "../../../service/document.service";
import {CoachSettingsService} from "../../../service/coach-settings.service";
import {TranslateModule} from '@ngx-translate/core';

type DescriptionBlockType = 'text' | 'heading' | 'image';

type CoachThemeKey = 'elegance' | 'dynamic' | 'trust' | 'serenity';

interface DescriptionBlock {
  id: string;
  type: DescriptionBlockType;
  content: string;
}

interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  announcementBg: string;
  announcementText: string;
}

interface ThemePreset {
  name: string;
  description?: string;
  bestFor?: string;
  mood?: string;
  layoutLabel?: string;
  selected: boolean;
  previewKey: CoachThemeKey;
  colors: ThemeColors;
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

@Component({
  selector: 'app-yo-coach-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, CoachLandingPreviewComponent, TranslateModule],
  templateUrl: './website-builder.component.html',
  styleUrls: ['./website-builder.component.scss']
})
export class WebsiteBuilderComponent implements OnInit{

  constructor(
    private router: Router,
    private sanitizer: DomSanitizer,
    private websiteService: WebsiteService,
    private builderState: WebsiteBuilderStateService,
    private userService: UsersService,
    private documentService: DocumentService,
    private coachSettingsService: CoachSettingsService
  ) {}


  ngOnInit(): void {
    this.loadWebsiteOrUserData();
  }

  goBack(): void { window.history.back(); }
  loadWebsiteOrUserData(): void {
    const saved = this.builderState.getDraft();

    if (saved) {
      this.populateFromDraft(saved);
      this.loadPublicProfilePhoto();
      return;
    }

    this.websiteService.getMyWebsite().subscribe({
      next: async (website) => {
        if (website) {
          this.populateFromWebsite(website);
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
    this.siteSlug = saved.slug || this.siteSlug;

    this.applySelectedTheme(saved.themeName, saved.themeKey);

    this.profile = saved.profile || this.profile;
    this.video.url = saved.videoUrl || '';
    this.descriptionBlocks = saved.descriptionBlocks || [];
    this.announcement = saved.announcement || this.announcement;
    this.cta = saved.cta || this.cta;
    this.leadFields = saved.leadFields || this.leadFields;
    this.colors = saved.colors || this.colors;
    this.services = saved.services || [];
    this.results = saved.results || [];
    this.certificates = saved.certificates || [];
    this.testimonials = saved.testimonials || [];
  }

  populateFromWebsite(site: any): void {
    this.siteSlug = site.slug || this.siteSlug;

    this.applySelectedTheme(site.themeName, site.themeKey);

    this.profile = site.profile || this.profile;
    this.video.url = site.video?.url || '';
    this.descriptionBlocks = site.descriptionBlocks || [];
    this.announcement = site.announcement || this.announcement;
    this.cta = site.cta || this.cta;
    this.leadFields = site.leadFields || this.leadFields;
    this.colors = site.colors || this.colors;

    this.services = site.services || [];
    this.results = site.results || [];
    this.certificates = site.certificates || [];
    this.testimonials = site.testimonials || [];
  }

  loadUserProfile(): void {
    this.userService.getUserById(sessionStorage.getItem('userId')).subscribe({
      next: async (user) => {
        this.profile.fullName = `${user.firstName} ${user.lastName}`;
        this.profile.title = 'Coach';
        this.profile.slogan = 'Transformez votre vie';
        this.profile.bio = 'Parlez de vous ici...';
        this.siteSlug = `${user.firstName}-${user.lastName}`;

        const avatarUrl = user.avatarUrl?.trim();
        this.profile.image = avatarUrl && avatarUrl.toLowerCase() !== 'not found' ? avatarUrl : '';
        this.loadPublicProfilePhoto();
      },
      error: () => {}
    });
  }

  private loadPublicProfilePhoto(): void {
    this.coachSettingsService.loadConfig(true).subscribe({
      next: config => {
        const publicPhoto = config.publicProfile?.photoUrl?.trim();
        if (publicPhoto) this.profile.image = publicPhoto;
      },
      error: () => {}
    });
  }

  descriptionBlocks: DescriptionBlock[] = [
    {
      id: this.generateId(),
      type: 'text',
      content: 'Parlez ici de votre approche, de votre méthode et des résultats que vous apportez.'
    }
  ];
  previewOpen = false;

  tabs = [
    'Profil',
    'Vidéo',
    'Description',
    'Résultats',
    'Services',
    'Certificats',
    'Témoignages'
  ];

  activeTab = 'Profil';
  siteSlug = 'monsite';

  themes: ThemePreset[] = [
    {
      name: 'Élégance',
      description: 'Un site premium, calme et éditorial avec une forte mise en valeur du profil.',
      bestFor: 'Coaching de vie, mindset, accompagnement haut de gamme',
      mood: 'Raffiné, minimal, personnel',
      layoutLabel: 'Portrait central + sections éditoriales',
      selected: true,
      previewKey: 'elegance',
      colors: {
        primary: '#26384a',
        secondary: '#edf5f8',
        accent: '#c9782f',
        background: '#ffffff',
        text: '#27313f',
        announcementBg: '#26384a',
        announcementText: '#ffffff'
      }
    },
    {
      name: 'Dynamique',
      description: 'Une présentation impactante avec un hero fort et un appel à l action visible.',
      bestFor: 'Fitness, performance, coaching business, programmes intensifs',
      mood: 'Énergique, direct, moderne',
      layoutLabel: 'Hero split + blocs puissants',
      selected: false,
      previewKey: 'dynamic',
      colors: {
        primary: '#151936',
        secondary: '#eef4f8',
        accent: '#f04a67',
        background: '#ffffff',
        text: '#1f2937',
        announcementBg: '#151936',
        announcementText: '#ffffff'
      }
    },
    {
      name: 'Confiance',
      description: 'Une structure rassurante qui met les preuves, services et certifications en avant.',
      bestFor: 'Coaching professionnel, reconversion, leadership, entreprise',
      mood: 'Sérieux, crédible, structuré',
      layoutLabel: 'Preuves + services détaillés',
      selected: false,
      previewKey: 'trust',
      colors: {
        primary: '#18314d',
        secondary: '#e7eef4',
        accent: '#d98732',
        background: '#f8fafc',
        text: '#243a55',
        announcementBg: '#18314d',
        announcementText: '#ffffff'
      }
    },
    {
      name: 'Sérénité',
      description: 'Une ambiance douce, respirante et centrée sur la relation coach-client.',
      bestFor: 'Bien-être, nutrition, thérapie douce, coaching holistique',
      mood: 'Apaisant, humain, naturel',
      layoutLabel: 'Portrait doux + parcours fluide',
      selected: false,
      previewKey: 'serenity',
      colors: {
        primary: '#4f6f75',
        secondary: '#e7f1df',
        accent: '#d99540',
        background: '#fbfdfb',
        text: '#34464a',
        announcementBg: '#4f6f75',
        announcementText: '#ffffff'
      }
    },
    {
      name: 'Autorité',
      description: 'Un thème sobre et institutionnel pour inspirer confiance dès le premier écran.',
      bestFor: 'Executive coaching, consultants, dirigeants, B2B',
      mood: 'Expert, premium, décisif',
      layoutLabel: 'Structure confiance + palette executive',
      selected: false,
      previewKey: 'trust',
      colors: {
        primary: '#10233f',
        secondary: '#edf2f7',
        accent: '#b7791f',
        background: '#f7fafc',
        text: '#1f2937',
        announcementBg: '#10233f',
        announcementText: '#ffffff'
      }
    },
    {
      name: 'Vitalité',
      description: 'Un thème lumineux et actif pour vendre une transformation visible et motivante.',
      bestFor: 'Sport, nutrition, énergie, coaching performance',
      mood: 'Vif, positif, motivant',
      layoutLabel: 'Layout dynamique + couleurs solaires',
      selected: false,
      previewKey: 'dynamic',
      colors: {
        primary: '#12343b',
        secondary: '#e6f5f2',
        accent: '#ef7b45',
        background: '#ffffff',
        text: '#1f2937',
        announcementBg: '#12343b',
        announcementText: '#ffffff'
      }
    },
    {
      name: 'Clarté',
      description: 'Un thème net et lisible pour expliquer une méthode et convertir sans distraction.',
      bestFor: 'Coaching scolaire, organisation, productivité, accompagnement familial',
      mood: 'Simple, clair, accessible',
      layoutLabel: 'Layout élégance + lecture confortable',
      selected: false,
      previewKey: 'elegance',
      colors: {
        primary: '#24536b',
        secondary: '#eaf6fb',
        accent: '#2f9e8f',
        background: '#ffffff',
        text: '#243447',
        announcementBg: '#24536b',
        announcementText: '#ffffff'
      }
    },
    {
      name: 'Ancrage',
      description: 'Un thème naturel et profond pour un positionnement calme, mature et authentique.',
      bestFor: 'Coaching holistique, respiration, transitions de vie, accompagnement émotionnel',
      mood: 'Naturel, stable, chaleureux',
      layoutLabel: 'Layout sérénité + palette organique',
      selected: false,
      previewKey: 'serenity',
      colors: {
        primary: '#3f5f55',
        secondary: '#edf3e8',
        accent: '#c47c4a',
        background: '#fbfcf8',
        text: '#34433d',
        announcementBg: '#3f5f55',
        announcementText: '#ffffff'
      }
    }
  ];

  profile: ProfileSection = {
    image: '',
    fullName: '',
    title: 'Coach Certifiée en Développement Personnel',
    slogan: 'Transformez votre vie, révélez votre potentiel',
    bio: `Passionnée par l'humain, j'accompagne les professionnels et les particuliers dans l'atteinte de leurs objectifs. Mon approche bienveillante et orientée solutions vous aide à surmonter les obstacles et à construire une vie alignée avec vos valeurs profondes.`
  };

  video: VideoSection = {
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  };

  announcement: AnnouncementSection = {
    enabled: true,
    message: '🎉 Offre spéciale : -20% sur votre première séance de coaching ! Réservez maintenant ❤️',
    bgColor: '#1a1a2e',
    textColor: '#ffffff'
  };

  cta: CtaSection = {
    enabled: true,
    label: 'Commencer le coaching',
    sticky: false
  };

  leadFields: LeadFieldsSection = {
    firstName: true,
    lastName: false,
    email: false,
    phone: true,
    buttonLabel: 'Réserver un appel découverte'
  };

  colors: ThemeColors = {
    primary: '#2c3e50',
    secondary: '#e8f4f8',
    accent: '#e67e22',
    background: '#ffffff',
    text: '#333333',
    announcementBg: '#1a1a2e',
    announcementText: '#ffffff'
  };

  results: ResultItem[] = [
    {
      beforeImage: 'https://images.unsplash.com/photo-1499996860823-5214fcc65f8f?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
      afterImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
      text: 'Retrouver confiance en soi après 3 mois de coaching'
    }
  ];

  services: ServiceItem[] = [
    {
      image: '',
      title: 'Coaching Individuel',
      price: '120€ / séance',
      description: 'Séances personnalisées pour surmonter vos blocages et atteindre vos objectifs personnels ou professionnels.'
    },
    {
      image: '',
      title: 'Bilan de Compétences',
      price: '1500€',
      description: 'Un accompagnement complet pour faire le point sur votre carrière et définir un nouveau projet professionnel.'
    },
    {
      image: '',
      title: 'Atelier Confiance en Soi',
      price: '80€ / personne',
      description: 'Session de groupe interactive pour développer votre estime personnelle et oser passer à l’action.'
    }
  ];

  certificates: CertificateItem[] = [
    {
      image: '',
      title: 'Master Coach Certifié (MCC)',
      organization: 'International Coaching Federation',
      year: '2020'
    },
    {
      image: '',
      title: 'Praticien PNL',
      organization: 'Institut Français de PNL',
      year: '2018'
    }
  ];

  testimonials: TestimonialItem[] = [
    {
      author: 'Julien D.',
      rating: 5,
      text: `L'accompagnement de Sophie a été un véritable tournant dans ma carrière. J'ai pu prendre des décisions difficiles avec clarté et sérénité.`
    },
    {
      author: 'Marie L.',
      rating: 5,
      text: `Une écoute exceptionnelle et des outils concrets. Je me sens enfin alignée avec mes choix de vie.`
    }
  ];

  setTab(tab: string): void {
    this.activeTab = tab;
  }

  tabLabelKey(tab: string): string {
    const keys: Record<string, string> = {
      Profil: 'PROFILE',
      'Vidéo': 'VIDEO',
      Description: 'DESCRIPTION',
      'Résultats': 'WEBSITE_RESULTS',
      Services: 'SERVICES',
      'Certificats': 'CERTIFICATES',
      'Témoignages': 'TESTIMONIALS',
    };
    return keys[tab] || tab;
  }

  selectTheme(index: number): void {
    this.themes = this.themes.map((theme, i) => ({
      ...theme,
      selected: i === index
    }));

    const selected = this.selectedTheme;
    this.colors = { ...selected.colors };
    this.announcement.bgColor = selected.colors.announcementBg;
    this.announcement.textColor = selected.colors.announcementText;
  }

  get selectedTheme(): ThemePreset {
    return this.themes.find(t => t.selected) ?? this.themes[0];
  }

  get normalizedSlug(): string {
    return this.normalizeSlug(this.siteSlug) || 'monsite';
  }

  get publicSiteUrl(): string {
    return `https://${this.normalizedSlug}.yo-coach.app`;
  }

  get videoEmbedUrl(): SafeResourceUrl | null {
    const embedUrl = this.toEmbedUrl(this.video.url);
    return embedUrl ? this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl) : null;
  }

  openPreview(): void {
    const data = {
      slug: this.normalizedSlug,
      themeKey: this.selectedTheme.previewKey,
      themeName: this.selectedTheme.name,
      descriptionBlocks: this.descriptionBlocks,
      profile: this.profile,
      videoUrl: this.video.url,
      announcement: this.announcement,
      cta: this.cta,
      leadFields: this.leadFields,
      colors: this.colors,
      services: this.services,
      results: this.results,
      certificates: this.certificates,
      testimonials: this.testimonials
    };
    this.builderState.setDraft(data);

    this.router.navigate(['/websites/preview'], {
      state: data
    });
  }

  closePreview(): void {
    this.previewOpen = false;
    document.body.style.overflow = '';
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

    return url;
  }


  saveWebsite(): void {
    const payload = {
      slug: this.normalizedSlug,
      themeKey: this.selectedTheme.previewKey,
      themeName: this.selectedTheme.name,
      descriptionBlocks: this.descriptionBlocks,
      profile: this.profile,
      video: {
        url: this.video.url
      },
      announcement: this.announcement,
      cta: this.cta,
      leadFields: this.leadFields,
      colors: this.colors,
      services: this.services,
      results: this.results,
      certificates: this.certificates,
      testimonials: this.testimonials,
      published: true
    };

    this.websiteService.saveMyWebsite(payload).subscribe({
      next: res => {
        console.log('Site enregistré avec succès', res);
      },
      error: err => {
        console.error('Erreur lors de l’enregistrement du site', err);
      }
    });
  }

  onProfileImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      console.error('Le fichier sélectionné n’est pas une image');
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      this.uploadWebsiteImage(file, url => this.profile.image = url);
    };

    reader.onerror = () => {
      console.error('Erreur lors de la lecture de l’image');
    };

    reader.readAsDataURL(file);
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 11);
  }

  private applySelectedTheme(themeName?: string, themeKey?: CoachThemeKey): void {
    const selectedIndex = this.themes.findIndex(theme => theme.name === themeName);
    const fallbackIndex = this.themes.findIndex(theme => theme.previewKey === themeKey);
    const index = selectedIndex >= 0 ? selectedIndex : fallbackIndex >= 0 ? fallbackIndex : 0;

    this.themes = this.themes.map((theme, i) => ({
      ...theme,
      selected: i === index
    }));
  }

  private normalizeSlug(value: string): string {
    return (value || '')
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
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
    this.results.push({
      beforeImage: '',
      afterImage: '',
      text: ''
    });
  }

  removeResult(index: number): void {
    this.results.splice(index, 1);
  }

  addService(): void {
    this.services.push({
      image: '',
      title: 'Nouveau service',
      price: '',
      description: ''
    });
  }

  removeService(index: number): void {
    this.services.splice(index, 1);
  }

  addCertificate(): void {
    this.certificates.push({
      image: '',
      title: 'Nouveau certificat',
      organization: '',
      year: new Date().getFullYear().toString()
    });
  }

  removeCertificate(index: number): void {
    this.certificates.splice(index, 1);
  }

  addTestimonial(): void {
    this.testimonials.push({
      author: 'Nouveau client',
      rating: 5,
      text: ''
    });
  }

  removeTestimonial(index: number): void {
    this.testimonials.splice(index, 1);
  }

  onBlockImageSelected(id: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = () => {
      this.uploadWebsiteImage(file, url => this.updateBlock(id, { content: url }));
    };
    reader.readAsDataURL(file);
  }

  onServiceImageSelected(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = () => {
      this.uploadWebsiteImage(file, url => this.services[index].image = url);
    };
    reader.readAsDataURL(file);
  }

  onCertificateImageSelected(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = () => {
      this.uploadWebsiteImage(file, url => this.certificates[index].image = url);
    };
    reader.readAsDataURL(file);
  }

  onResultImageSelected(index: number, type: 'before' | 'after', event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (type === 'before') {
        this.uploadWebsiteImage(file, url => this.results[index].beforeImage = url);
      } else {
        this.uploadWebsiteImage(file, url => this.results[index].afterImage = url);
      }
    };
    reader.readAsDataURL(file);
  }

  trackByBlockId(index: number, block: DescriptionBlock): string {
    return block.id;
  }

  private uploadWebsiteImage(file: File, onUploaded: (url: string) => void): void {
    const extension = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '';
    const storedFile = new File(
      [file],
      `website-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${extension}`,
      { type: file.type, lastModified: file.lastModified }
    );
    const ownerId = sessionStorage.getItem('userId') || 'coach';
    this.documentService.uploadFileInPath(storedFile, `coach-websites/${ownerId}`).subscribe({
      next: onUploaded,
      error: err => console.error('Erreur upload image MinIO', err)
    });
  }
}
