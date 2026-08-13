import {Component, ElementRef, ViewChild} from '@angular/core';
import {CommonModule} from "@angular/common";
import {MatIcon} from "@angular/material/icon";
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {LanguageService} from '../../../service/language.service';
interface Feature {
  icon: string;        // ici on met juste un identifiant ou un emoji
  title: string;
  description: string;
  colorClass: string;  // classe de dégradé pour le fond de l’icône
}
interface Benefit {
  title: string;
  description: string;
}

interface Gym {
  name: string;
  members: number;
}
interface TrainingBenefit {
  icon: string;
  text: string;
}
interface FreeTrialItem {
  icon: string;
  text: string;
}
interface Testimonial {
  name: string;
  role: string;
  image: string;
  content: string;
  rating: number;
}
interface FAQItem {
  question: string;
  answer: string;
}
interface Platform {
  icon: string;      // nom d'icône Material
  name: string;
  description: string;
  details: string;

}

interface Integration {
  icon: string;      // nom d'icône Material
  title: string;
  description: string;
}
@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule, MatIcon, TranslateModule],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.scss'
})
export class LandingPageComponent {
  constructor(private translate: TranslateService, private languageService: LanguageService) {
    this.translate.use(this.languageService.getCurrentLanguage());
  }
  gyms: string[] = [
    'FitZone',
    'PowerGym',
    'Spartans',
    'EliteClub',
    'IronTemple',
    'BodyFactory',
    'MaxFit',
    'GymPro',
    'AthleteZone',
    'FitnessPark',
  ];
  @ViewChild('statisticsSection') statisticsSection!: ElementRef; // 👈 nouvelle section


  statsInView = false;   // 👈 statistics
  // On duplique plusieurs fois pour un scroll fluide
  get repeatedGyms() {
    return [...this.gyms, ...this.gyms, ...this.gyms];
  }
  @ViewChild('featuresSection') featuresSection!: ElementRef;
  @ViewChild('pricingSection') pricingSection!: ElementRef;

  sectionInView = false;
  pricingInView = false; // 👈 pricing

  features: Feature[] = [
    {
      icon: '👥',
      title: 'MEMBER_MANAGEMENT',
      description: 'MEMBER_MANAGEMENT_DESCRIPTION',
      colorClass: 'gradient-blue',
    },
    {
      icon: '💳',
      title: 'SMART_SUBSCRIPTIONS',
      description: 'SMART_SUBSCRIPTIONS_DESCRIPTION',
      colorClass: 'gradient-green',
    },
    {
      icon: '📅',
      title: 'SCHEDULING_RESERVATIONS',
      description: 'SCHEDULING_RESERVATIONS_DESCRIPTION',
      colorClass: 'gradient-purple',
    },
    {
      icon: '🔔',
      title: 'MARKETING_AUTOMATION',
      description: 'MARKETING_AUTOMATION_DESCRIPTION',
      colorClass: 'gradient-orange',
    },
    {
      icon: '📈',
      title: 'ADVANCED_STATISTICS',
      description: 'ADVANCED_STATISTICS_DESCRIPTION',
      colorClass: 'gradient-pink',
    },
    {
      icon: '📊',
      title: 'FINANCIAL_REPORTS',
      description: 'FINANCIAL_REPORTS_DESCRIPTION',
      colorClass: 'gradient-indigo',
    },
  ];
  ngAfterViewInit(): void {
    // Observer Features
    if (this.featuresSection) {
      const featuresObserver = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              this.sectionInView = true;
              featuresObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.1 },
      );
      featuresObserver.observe(this.featuresSection.nativeElement);
    }

    // Observer Multi-salles
    if (this.multiSection) {
      const multiObserver = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              this.inView = true;
              multiObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.1 },
      );
      multiObserver.observe(this.multiSection.nativeElement);
    }

    // Observer Statistics
    if (this.statisticsSection) {
      const statsObserver = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              this.statsInView = true;
              statsObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.1 },
      );
      statsObserver.observe(this.statisticsSection.nativeElement);
    }

    // 👇 Observer Pricing
    if (this.pricingSection) {
      const pricingObserver = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              this.pricingInView = true;
              pricingObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.1 },
      );
      pricingObserver.observe(this.pricingSection.nativeElement);
    }
    if (this.freeTrialSection) {
      const freeTrialObserver = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              this.freeTrialInView = true;
              freeTrialObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.1 },
      );

      freeTrialObserver.observe(this.freeTrialSection.nativeElement);
    }
    if (this.testimonialsSection) {
      const testimonialsObserver = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              this.testimonialsInView = true;
              testimonialsObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.1 },
      );

      testimonialsObserver.observe(this.testimonialsSection.nativeElement);
    }
    if (this.faqSection) {
      const faqObserver = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              this.faqInView = true;
              faqObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.1 },
      );

      faqObserver.observe(this.faqSection.nativeElement);
    }
// Observer Easy Section ("Votre salle reste organisée...")
    if (this.easySection) {
      this.easyObserver = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              this.easyInView = true;
              this.easyObserver?.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.1 },
      );

      this.easyObserver.observe(this.easySection.nativeElement);
    }
    if (this.multiLocationSection) {
      this.observer = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              this.inView = true; // utilisé aussi pour les barres de progression
              this.observer?.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.1 },
      );

      this.observer.observe(this.multiLocationSection.nativeElement);
    }
    if (this.multiLocationSection) {
      const multiLocationObserver = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              this.inView = true;
              multiLocationObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.1 },
      );

      multiLocationObserver.observe(this.multiLocationSection.nativeElement);
    }
  }




  @ViewChild('multiSection') multiSection!: ElementRef;

  inView = false;

  benefits: Benefit[] = [
    {
      title: 'Abonnements flexibles et valables dans toutes vos salles',
      description:
        "Offrez à vos adhérents la liberté d'accéder à n'importe quel établissement de votre réseau.",
    },
    {
      title: 'Statistiques détaillées pour chaque salle',
      description:
        'Suivez les performances individuelles ou globales : adhésions, fréquentation, revenus, etc.',
    },
    {
      title: 'Gestion centralisée depuis un seul compte',
      description:
        'Pilotez tous vos établissements depuis un tableau de bord unique : plus rapide, plus simple.',
    },
    {
      title: "Transferts d'adhérents entre salles",
      description:
        "Déplacez facilement un membre d'une salle à une autre sans créer de nouveau dossier.",
    },
    {
      title: 'Vue consolidée de tous vos revenus',
      description:
        'Accédez en un clic à une vision complète de votre activité multi-sites.',
    },
    {
      title: 'Rôles & équipes dédiées pour chaque établissement',
      description:
        'Chaque salle garde son autonomie tout en restant connectée au réseau.',
    },{
      title: 'Rôles & équipes dédiées pour chaque établissement',
      description:
        'Chaque salle garde son autonomie tout en restant connectée au réseau.',
    }

  ];

  gymss: Gym[] = [
    { name: 'Salle Centre-Ville', members: 324 },
    { name: 'Salle Lac', members: 278 },
    { name: 'Salle Nord', members: 412 },
    { name: 'Salle Sud', members: 189 },
  ];


  getProgress(memberCount: number): string {
    const max = 500; // même logique que ton code React
    const percent = (memberCount / max) * 100;
    return `${percent}%`;
  }
  desktopFeatures: string[] = [
    'INSTALL_ON_YOUR_COMPUTER',
    'NO_MONTHLY_FEES',
    'ALL_ESSENTIAL_FEATURES',
    'DATA_STORED_LOCALLY',
    'TECHNICAL_SUPPORT_INCLUDED',
    'FREE_LIFETIME_UPDATES',
    // '🎁 Formation vidéo gratuite (2,500 DT)',
  ];

  cloudFeatures: string[] = [
    'ACCESS_ANYWHERE_WEB_MOBILE',
    'AUTOMATIC_CLOUD_BACKUP',
    'CONTINUOUS_AUTOMATIC_UPDATES',
    'UNLIMITED_MULTI_GYM_MANAGEMENT',
    'PRIORITY_SUPPORT_7_DAYS',
    'ADVANCED_INTEGRATIONS',
    'REAL_TIME_STATISTICS',
    'MEMBER_MOBILE_APP',
    // '🎁 Formation vidéo gratuite (2,500 DT)',
  ];
  trainingBenefits: TrainingBenefit[] = [
    {
      icon: 'trending_up', // <mat-icon>trending_up</mat-icon>
      text: 'Stratégies pour booster vos revenus x3',
    },
    {
      icon: 'group', // <mat-icon>group</mat-icon>
      text: 'Attirer plus de clients efficacement',
    },
    {
      icon: 'attach_money', // <mat-icon>attach_money</mat-icon>
      text: 'Faire revenir les anciens adhérents',
    },
    {
      icon: 'play_circle', // <mat-icon>play_circle</mat-icon>
      text: 'Grandir même dans les périodes difficiles',
    },
  ];
  @ViewChild('freeTrialSection') freeTrialSection!: ElementRef;

  freeTrialInView = false;

  freeTrialItems: FreeTrialItem[] = [
    {
      icon: '✨',
      text: 'INSTALLATION_IN_TWO_MINUTES',
    },
    {
      icon: '🔒',
      text: 'NO_COMMITMENT',
    },
    {
      icon: '🎯',
      text: 'DEDICATED_SUPPORT_INCLUDED',
    },
  ];
  @ViewChild('testimonialsSection') testimonialsSection!: ElementRef;

  testimonialsInView = false;

  testimonials: Testimonial[] = [
    {
      name: 'Salle de sport Vikings',
      role: '',
      image:
        'https://scontent.ftun4-2.fna.fbcdn.net/v/t39.30808-6/461525570_557498403457397_2420086670981672548_n.jpg?_nc_cat=111&ccb=1-7&_nc_sid=6ee11a&_nc_ohc=pqPWDX6z6ZgQ7kNvwE4qZ2y&_nc_oc=Adlx4y4-ac749sk1T3M_DnAUob8GWMmuHnRSkK5DzCTiPYepmjtVXWy0S0IniqbfeCg&_nc_zt=23&_nc_ht=scontent.ftun4-2.fna&_nc_gid=eumg83a7qdSZQ9aNVQWRrQ&oh=00_AfjmoN8ctvEnJ9C0sPQfupWE__sPOCVPz4N8oRyOZl0Ukg&oe=69283447',
      content: 'VIKINGS_TESTIMONIAL',
      rating: 5,
    },
    {
      name: 'Empire Gym ',
      role: '',
      image:
        'https://scontent.ftun4-2.fna.fbcdn.net/v/t39.30808-6/472316264_1401936111215501_7989131506461055218_n.jpg?_nc_cat=105&ccb=1-7&_nc_sid=6ee11a&_nc_ohc=SKyvay7kNPYQ7kNvwE8E3j8&_nc_oc=AdnMHjoenV27ALrhS-uwptn3U9qjxJuBWJ1VbUbcTrWOEU13kJ1OZzFsA7lLX2MS_8Y&_nc_zt=23&_nc_ht=scontent.ftun4-2.fna&_nc_gid=m0mrGATENVFENis8sHPaOQ&oh=00_AfgJiPH1cH3tBkHhigLCv5YDcRGmxlJqP-HWy6EwIVxfdw&oe=69283171',
      content: 'EMPIRE_GYM_TESTIMONIAL',
      rating: 5,
    }
  ];

  getStars(rating: number): number[] {
    return Array.from({ length: rating });
  }
  @ViewChild('faqSection') faqSection!: ElementRef;

  faqInView = false;
  openFaqIndex: number | null = 0;

  faqs: FAQItem[] = [
    {
      question: 'FREE_TRIAL_FAQ_QUESTION',
      answer: 'FREE_TRIAL_FAQ_ANSWER',
    },
    {
      question: 'DESKTOP_CLOUD_DIFFERENCE_QUESTION',
      answer: 'DESKTOP_CLOUD_DIFFERENCE_ANSWER',
    },

    {
      question: 'MULTIPLE_GYMS_ONE_ACCOUNT_QUESTION',
      answer: 'MULTIPLE_GYMS_ONE_ACCOUNT_ANSWER',
     },
    {
      question: 'CONTINUOUS_UPDATES_QUESTION',
      answer: 'CONTINUOUS_UPDATES_ANSWER',
    },
    {
      question: 'TRAINING_SUPPORT_QUESTION',
      answer: 'TRAINING_SUPPORT_ANSWER',
    },{
      question: 'RECOMMENDED_VERSION_QUESTION',
      answer: 'RECOMMENDED_VERSION_ANSWER'
    }


  ];
  toggleFaq(index: number): void {
    this.openFaqIndex = this.openFaqIndex === index ? null : index;
  }

  isMobileMenuOpen = false;

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
  }
  @ViewChild('easySection') easySection!: ElementRef<HTMLElement>;
  easyInView = false;

  easyToUsePoints: string[] = [
    'CLEAR_INTUITIVE_INTERFACE',
    'TRAINING_UNDER_30_MINUTES',
    'SUPPORT_AVAILABLE_7_DAYS',
    'NO_LEARNING_CURVE',
  ];

  private easyObserver?: IntersectionObserver;


  @ViewChild('multiLocationSection') multiLocationSection!: ElementRef<HTMLElement>;

  private observer?: IntersectionObserver;


  integrations: Integration[] = [
    {
      icon: 'wifi',
      title: "Contrôle d'accès intégré",
      description: 'Intégration directe avec pointeuses et tourniquets',
    },
    {
      icon: 'group',
      title: 'Multi-utilisateurs',
      description: "Gestion d'équipe avec rôles et permissions",
    },
    {
      icon: 'lock',
      title: 'Sécurité avancée',
      description: 'Données cryptées et sauvegardes automatiques',
    },
  ];

  // largeurs des barres (comme [60, 80, 45] dans le React)
  progressBars: number[] = [60, 80, 45];

  ngOnDestroy(): void {
    this.easyObserver?.disconnect();
    this.observer?.disconnect();   // 👈 ajouter ceci
  }


  getBarWidth(value: number): string {
    return this.inView ? `${value}%` : '0%';
  }

  // déjà définies au-dessus : interface Platform, interface Integration

  platforms: Platform[] = [
    {
      icon: 'desktop_windows',
      name: 'DESKTOP',
      description: 'WINDOWS_AND_MAC',
      details: 'Logiciel optimisé pour votre PC',
    },
    {
      icon: 'cloud',
      name: 'WEB',
      description: 'BROWSER_ACCESS',
      details: 'Aucune installation requise',
    },
    {
      icon: 'smartphone',
      name: 'MOBILE',
      description: 'IOS_AND_ANDROID',
      details: 'Gérez en déplacement',
    },
  ];

  capabilities: Integration[] = [
    {
      icon: 'wifi',
      title: 'INTEGRATED_ACCESS_CONTROL',
      description: 'INTEGRATED_ACCESS_CONTROL_DESCRIPTION',
    },
    {
      icon: 'group',
      title: 'MULTI_USER',
      description: 'MULTI_USER_DESCRIPTION',
    },
    {
      icon: 'lock',
      title: 'ADVANCED_SECURITY',
      description: 'ADVANCED_SECURITY_DESCRIPTION',
    },
  ];

  advantageStats = [
    { number: '1', text: 'SINGLE_SUBSCRIPTION' },
    { number: '∞', text: 'ACCESSIBLE_GYMS' },
    { number: '100%', text: 'CLIENT_SATISFACTION' },
  ];

}
