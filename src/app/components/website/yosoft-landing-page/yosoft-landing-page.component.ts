import { Component } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LanguageService } from 'app/service/language.service';
interface Service {
  title: string;
  description: string;
  icon: string; // simple emoji pour l'exemple
}

interface Product {
  name: string;
  description: string;
  icon: string;
}
@Component({
  selector: 'app-yosoft-landing-page',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './yosoft-landing-page.component.html',
  styleUrl: './yosoft-landing-page.component.scss'
})
export class YosoftLandingPageComponent {
  constructor(private translate: TranslateService, private languageService: LanguageService) {
    this.translate.use(this.languageService.getCurrentLanguage());
  }
  services: Service[] = [
    {
      icon: '💻',
      title: 'Software',
      description:
        'Des applications SaaS simples et modernes pour piloter votre activité.',
    },
    {
      icon: '💳',
      title: 'Payments',
      description:
        'Des solutions de paiement intégrées pour soutenir votre modèle économique.',
    },
    {
      icon: '💡',
      title: 'Solutions',
      description:
        'Un accompagnement et des outils adaptés à votre secteur pour vous aider à passer au niveau supérieur.',
    },
  ];

  products: Product[] = [
    {
      icon: '🏋️',
      name: 'YoGym',
      description: 'Solution SaaS pour la gestion des salles de sport.',
    },
    {
      icon: '📈',
      name: 'YoSales',
      description: "Outil pour structurer et suivre l'activité commerciale.",
    },
    {
      icon: '👥',
      name: 'YoCoach',
      description: 'Plateforme pour les coachs et indépendants.',
    },
  ];

  scrollTo(sectionId: string): void {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
