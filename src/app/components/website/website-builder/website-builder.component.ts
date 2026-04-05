import { CommonModule } from '@angular/common';
import {Component, Input, OnInit} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {CoachLandingPreviewComponent} from "../coach-landing-preview/coach-landing-preview.component";
import {Router} from "@angular/router";
import {DomSanitizer, SafeResourceUrl} from "@angular/platform-browser";
import {WebsiteService} from "../../../service/website.service";
import {WebsiteBuilderStateService} from "../../../service/website-builder-state.service";
import {UsersService} from "../../../service/users.service";


type CoachThemeName = 'Élégance' | 'Dynamique' | 'Confiance' | 'Sérénité';

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
  name: CoachThemeName;
  selected: boolean;
  previewKey: 'elegance' | 'dynamic' | 'trust' | 'serenity';
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
  imports: [CommonModule, FormsModule, CoachLandingPreviewComponent],
  templateUrl: './website-builder.component.html',
  styleUrls: ['./website-builder.component.scss']
})
export class WebsiteBuilderComponent implements OnInit{

  constructor(
    private router: Router,
    private sanitizer: DomSanitizer,
    private websiteService: WebsiteService,
    private builderState: WebsiteBuilderStateService,
    private userService: UsersService
  ) {}


  ngOnInit(): void {
    this.loadWebsiteOrUserData();
  }
  loadWebsiteOrUserData(): void {
    this.websiteService.getMyWebsite().subscribe({
      next: async (website) => {
        if (website) {
          this.populateFromWebsite(website);
        }
      },
      error: () => {
        this.loadUserProfile();
      }
    });
  }

  populateFromWebsite(site: any): void {
    this.siteSlug = site.slug;

    this.profile = site.profile;
    this.video.url = site.video?.url;

    this.announcement = site.announcement;
    this.cta = site.cta;
    this.leadFields = site.leadFields;
    this.colors = site.colors;

    this.services = site.services || [];
    this.results = site.results || [];
    this.certificates = site.certificates || [];
    this.testimonials = site.testimonials || [];
  }

  loadUserProfile(): void {
    const saved = this.builderState.getDraft();

    if (saved) {
      this.selectedTheme.previewKey = saved.themeKey;
      this.selectedTheme.name = saved.themeName;
      this.profile = saved.profile;
      this.video.url = saved.videoUrl;
      this.announcement = saved.announcement;
      this.cta = saved.cta;
      this.leadFields = saved.leadFields;
      this.colors = saved.colors;
      this.services = saved.services || [];
      this.results = saved.results || [];
      this.certificates = saved.certificates || [];
      this.testimonials = saved.testimonials || [];
    }
    else {
      this.userService.getUserById(sessionStorage.getItem('userId')).subscribe({
        next: async (user) => {

          this.profile.fullName = `${user.firstName} ${user.lastName}`;
          this.profile.title = 'Coach';
          this.profile.slogan = 'Transformez votre vie';
          this.profile.bio = 'Parlez de vous ici...';
          this.siteSlug = `${user.firstName}-${user.lastName}`;

          if (user.avatarUrl) {
            try {
              this.profile.image = await this.convertImageToBase64(user.avatarUrl);
            } catch {
              this.profile.image = '';
            }
          }

        },
        error: () => {
        }
      });
    }
  }

  private convertImageToBase64(url: string): Promise<string> {
    return fetch(url)
      .then(res => res.blob())
      .then(blob => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      }));
  }


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
      selected: true,
      previewKey: 'elegance',
      colors: {
        primary: '#2c3e50',
        secondary: '#e8f4f8',
        accent: '#e67e22',
        background: '#ffffff',
        text: '#333333',
        announcementBg: '#1a1a2e',
        announcementText: '#ffffff'
      }
    },
    {
      name: 'Dynamique',
      selected: false,
      previewKey: 'dynamic',
      colors: {
        primary: '#2c3e50',
        secondary: '#e8f4f8',
        accent: '#e67e22',
        background: '#ffffff',
        text: '#333333',
        announcementBg: '#1a1a2e',
        announcementText: '#ffffff'
      }
    },
    {
      name: 'Confiance',
      selected: false,
      previewKey: 'trust',
      colors: {
        primary: '#0f4c75',
        secondary: '#bbe1fa',
        accent: '#3282b8',
        background: '#f8fafc',
        text: '#1f2937',
        announcementBg: '#0f4c75',
        announcementText: '#ffffff'
      }
    },
    {
      name: 'Sérénité',
      selected: false,
      previewKey: 'serenity',
      colors: {
        primary: '#557b83',
        secondary: '#e5efc1',
        accent: '#39aea9',
        background: '#ffffff',
        text: '#374151',
        announcementBg: '#557b83',
        announcementText: '#ffffff'
      }
    }
  ];

  profile: ProfileSection = {
    image: 'assets/images/photoprofilvierge.jpg',
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
    email: true,
    phone: false,
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

  get videoEmbedUrl(): SafeResourceUrl | null {
    const embedUrl = this.toEmbedUrl(this.video.url);
    return embedUrl ? this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl) : null;
  }

  openPreview(): void {
    const data = {
      themeKey: this.selectedTheme.previewKey,
      themeName: this.selectedTheme.name,
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
      slug: this.siteSlug,
      themeKey: this.selectedTheme.previewKey,
      themeName: this.selectedTheme.name,

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
      this.profile.image = reader.result as string;
    };

    reader.onerror = () => {
      console.error('Erreur lors de la lecture de l’image');
    };

    reader.readAsDataURL(file);
  }
}
