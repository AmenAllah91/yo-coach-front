import {Component, ElementRef, ViewChild} from '@angular/core';
import {CommonModule} from "@angular/common";
import {MatIcon} from "@angular/material/icon";
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
  imports: [CommonModule, MatIcon],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.scss'
})
export class LandingPageComponent {
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
      title: 'Gestion des adhérents',
      description:
        'Base de données complète avec historique, photos, et suivi personnalisé de chaque membre.',
      colorClass: 'gradient-blue',
    },
    {
      icon: '💳',
      title: 'Abonnements intelligents',
      description:
        'Gestion automatisée des paiements, renouvellements et relances pour maximiser vos revenus.',
      colorClass: 'gradient-green',
    },
    {
      icon: '📅',
      title: 'Planning & réservations',
      description:
        'Système de réservation en ligne avec notifications automatiques et gestion des capacités.',
      colorClass: 'gradient-purple',
    },
    {
      icon: '🔔',
      title: 'Marketing automation',
      description:
        'Campagnes SMS/Email automatiques pour fidéliser et réactiver vos membres inactifs.',
      colorClass: 'gradient-orange',
    },
    {
      icon: '📈',
      title: 'Statistiques avancées',
      description:
        'Tableaux de bord en temps réel pour piloter votre activité avec des données concrètes.',
      colorClass: 'gradient-pink',
    },
    {
      icon: '📊',
      title: 'Rapports financiers',
      description:
        'Suivi précis de vos revenus, dépenses et rentabilité avec exports comptables.',
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
    'Installation sur votre ordinateur',
    'Aucun frais mensuel',
    'Toutes les fonctionnalités essentielles',
    'Données stockées localement',
    'Support technique inclus',
    'Mises à jour gratuites à vie',
    // '🎁 Formation vidéo gratuite (2,500 DT)',
  ];

  cloudFeatures: string[] = [
    "Accès depuis n'importe où (web + mobile)",
    'Sauvegarde automatique dans le cloud',
    'Mises à jour automatiques en continu',
    'Gestion multi-salles illimitée',
    'Support prioritaire 7j/7',
    'Intégrations avancées (SMS, Email, etc.)',
    'Statistiques en temps réel',
    'Application mobile pour vos membres',
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
      text: 'Installation en 2 minutes',
    },
    {
      icon: '🔒',
      text: 'Aucun engagement',
    },
    {
      icon: '🎯',
      text: 'Support dédié inclus',
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
      content:
        "Depuis que nous avons migré vers l’application YoGym, la gestion de notre salle est devenue beaucoup plus simple et intuitive. La navigation ne demande presque aucun effort et toutes les fonctionnalités sont faciles à trouver.\n" +
"\n" + "Nos employés sont désormais beaucoup plus à l’aise : la passation entre collaborateurs se fait sans difficulté, ce qui garantit une continuité fluide et une meilleure organisation de la salle.",
      rating: 5,
    },
    {
      name: 'Empire Gym ',
      role: '',
      image:
        'https://scontent.ftun4-2.fna.fbcdn.net/v/t39.30808-6/472316264_1401936111215501_7989131506461055218_n.jpg?_nc_cat=105&ccb=1-7&_nc_sid=6ee11a&_nc_ohc=SKyvay7kNPYQ7kNvwE8E3j8&_nc_oc=AdnMHjoenV27ALrhS-uwptn3U9qjxJuBWJ1VbUbcTrWOEU13kJ1OZzFsA7lLX2MS_8Y&_nc_zt=23&_nc_ht=scontent.ftun4-2.fna&_nc_gid=m0mrGATENVFENis8sHPaOQ&oh=00_AfgJiPH1cH3tBkHhigLCv5YDcRGmxlJqP-HWy6EwIVxfdw&oe=69283171',
      content:
        'Avec YoGym, la gestion d’Empire Gym est devenue simple, rapide et efficace.\n' +
        'Les statistiques détaillées nous permettent de suivre nos performances et de comparer facilement chaque période.\n' +
        'Grâce au suivi à distance depuis le téléphone ou n’importe quel appareil, on reste connecté à la salle même en étant loin.\n' +
        'Et surtout, l’interface est claire et agréable, ce qui rend l’utilisation très confortable au quotidien.',
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
      question: "Comment fonctionne la période d'essai gratuite ?",
      answer:
        "Vous bénéficiez de 30 jours d'accès complet à toutes les fonctionnalités de YoGym, sans limitation et sans engagement. Aucune carte bancaire n'est requise pour démarrer. À la fin de la période, vous pouvez choisir l'offre qui vous convient ou arrêter sans frais.",
    },
    {
      question: 'Quelle différence entre la version Desktop et Cloud ?',
      answer:
        'La version Desktop ( paiement unique) est installée sur votre ordinateur, idéale pour les petites et nouvelles salles. La version Cloud (paiement mensuel ou annuel ) est accessible partout via internet, inclut des mises à jour automatiques, la gestion multi-salles et une application mobile pour vos membres.',
    },

    {
      question: 'Puis-je gérer plusieurs salles avec un seul compte ?',
      answer:
        'Oui, avec la version Cloud. Vous pouvez gérer un nombre illimité de salles depuis un seul compte, avec des statistiques séparées pour chaque établissement et la possibilité de créer des abonnements valables dans plusieurs salles : un même adhérent peut ainsi accéder à plusieurs salles avec un seul abonnement, ce qui représente un atout majeur pour votre salle et une raison forte pour que les clients vous choisissent plutôt que vos concurrents.',
     },
    {
      question: 'Est-ce que YoGym continue d’ajouter de nouvelles fonctionnalités et des mises à jour?',
      answer:
        "Oui. YoGym évolue en continu.Notre équipe ajoute régulièrement de nouvelles fonctionnalités et améliore l’existant, aussi bien sur la version desktop que sur la version web.",
    },
    {
      question: 'Comment choisir entre la version desktop et la version web de YoGym ?',
      answer:
        "Oui, nous offrons une formation complète gratuite lors de l'installation. De plus, notre support technique est disponible 7j/7 pour répondre à toutes vos questions. L'interface est conçue pour être intuitive et facile à prendre en main.",
    },{
      question: 'Quelle version de YoGym me conseillez-vous, desktop ou Cloud ?',
      answer:
        "Pour les nouvelles salles et les petites structures, nous recommandons de commencer avec la version desktop : vous limitez vos charges fixes tout en profitant d’un logiciel complet (abonnements, adhérents, caisse, statistiques financières et générales).\n" +
        "Quand votre salle grandit, que vos adhérents augmentent et que vous pouvez assumer une mensualité supplémentaire, vous pourrez évoluer vers la version Cloud (web) pour une gestion plus flexible, un accès à distance multiplier vos chiffres et garder un accès à votre salle à distance sans perdre vos données et être prêt à ouvrir d’autres points reliés entre eux"
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
    'Interface claire et intuitive',
    'Formation en moins de 30 minutes',
    'Support disponible 7j/7',
    "Pas de courbe d'apprentissage",
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
      name: 'Desktop',
      description: 'Windows & Mac',
      details: 'Logiciel optimisé pour votre PC',
    },
    {
      icon: 'cloud',
      name: 'Web',
      description: 'Accès navigateur',
      details: 'Aucune installation requise',
    },
    {
      icon: 'smartphone',
      name: 'Mobile',
      description: 'iOS & Android',
      details: 'Gérez en déplacement',
    },
  ];

  capabilities: Integration[] = [
    {
      icon: 'wifi',
      title: "Contrôle d'accès intégré",
      description:
        'Intégration directe avec vos pointeuses et tourniquets pour un accès fluide et sécurisé.',
    },
    {
      icon: 'group',
      title: 'Multi-utilisateurs',
      description:
        'Gérez votre équipe avec des rôles et permissions personnalisés pour chaque membre.',
    },
    {
      icon: 'lock',
      title: 'Sécurité avancée',
      description:
        'Données cryptées et sauvegardes automatiques pour une protection maximale.',
    },
  ];

  advantageStats = [
    { number: '1', text: 'Abonnement unique' },
    { number: '∞', text: 'Salles accessibles' },
    { number: '100%', text: 'Satisfaction client' },
  ];

}
