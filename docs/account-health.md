# Account Health et périodes offertes

La fiche `/admin/coaches/:id` propose l’onglet **État du compte / Account Health**. Il regroupe le compte et son blocage, le Trial, l’abonnement, la limite effective, le détail actifs/archivés/invitations, le dernier paiement, les écarts YoSales/YoCoach et les événements récents. Les badges Healthy/Warning/Error sont calculés à la lecture, sans nouveau statut d’abonnement.

## Période gratuite

« Offrir une période gratuite » demande un plan actif non archivé du produit, une durée en jours ou mois calendaires, une date de fin incluse, ou « jusqu’à nouvel ordre », un motif et une note libre privée. Le motif Other impose une note. La période commence immédiatement. Les échéances suivent le fuseau du customer YoSales ; un customer sans fuseau conserve le défaut YoSales existant.

L’offre est enregistrée dans `ComplimentaryAccess` dans YoSales, séparément du Trial et de la subscription payante. Les six états de subscription et l’absence de subscription sont acceptés. Si un coach réel n’a pas encore de customer YoSales, le relais crée seulement cette référence et la sauvegarde avec le contrôle de concurrence Mongo existant. Aucun abonnement payant ni facture n’est créé par l’offre.

Pendant l’offre, la règle d’état partagée YoSales fournit la limite du plan offert, `readOnly=false`, le branding et l’échéance de l’offre. Les champs et statuts de l’abonnement initial restent conservés. Le cache des droits YoCoach expire au plus tard à la fin de l’offre. L’offre peut être révoquée après confirmation ; à sa fin ou sa révocation, les droits de l’abonnement/Trial initial reprennent. Une seule offre peut être active pour un customer, avec verrou SQL pour les actions concurrentes.

**L’offre ne suspend pas la facturation d’un abonnement déjà existant, n’annule pas ses factures et ne débloque pas automatiquement un compte.** Cette règle apparaît dans la confirmation. Un coach bloqué ou désactivé peut recevoir une offre, mais une action de compte séparée reste nécessaire pour restaurer son accès. Les offres ne modifient pas la consommation historique du Trial.

Les notes et les auteurs des offres sont exposés uniquement par les APIs Admin ; l’état fourni au coach ne contient que les informations de plan et de période nécessaires à ses droits.

## Diagnostic et resync

`GET /api/admin/coaches/{id}/diagnostics` valide un coach réel hors démo et agrège les lectures ciblées de son état YoSales, du dernier paiement, des offres et de l’historique des actions d’abonnement. Il utilise les compteurs existants `countActiveClients`, `countArchivedByCoachId` et les invitations PENDING. Aucun nouveau calcul de client facturable n’est introduit.

Les lectures YoSales échouent indépendamment : une panne affiche « Données YoSales temporairement indisponibles » et conserve l’identité, le blocage et les compteurs locaux. Une limite inconnue n’est jamais présentée comme illimitée. Le montant et la référence proviennent du paiement/facture réels ; aucun motif de gateway absent n’est reconstruit. La réussite d’un ancien paiement d’un autre abonnement ne déclenche pas le warning « subscription pending ».

Le diagnostic détecte : référence payante sans abonnement trouvé, plan manquant, Trial expiré sans accès valide, abonnement expiré/annulé/en attente/en retard, période ACTIVE déjà terminée, paiement échoué, paiement réussi lié à une subscription PENDING, limite atteinte/dépassée, ancien blocage pour expiration malgré une subscription active ou une offre.

La comparaison des statuts et limites utilise **le cache réel des droits YoCoach**, lorsqu’il existe encore, et une lecture fraîche de YoSales. En l’absence de cache, elle affiche explicitement cette absence. La date du contrôle est distincte de la dernière resynchronisation Admin enregistrée ; aucune date de sync historique n’est inventée.

`POST /api/admin/coaches/{id}/diagnostics/resync` requiert une confirmation, relit YoSales puis recharge le cache YoCoach et enregistre RESYNC dans Admin Logs. Il ne modifie pas YoSales, les références historiques Mongo ou un blocage. Un échec de lecture conserve les droits en cache et ne prétend pas avoir réussi.

Les offres et révocations figurent dans Admin Logs avec l’admin issu du JWT, le plan, les dates, le motif et la note. Les actions existantes de compte, changement de plan et prolongation Trial conservent leur journalisation.

## Permissions et limites

- ROLE_ADMIN et ROLE_SUPER_ADMIN : consultation et actions existantes de compte/abonnement, offre, révocation et resync.
- ROLE_SUPPORT et ROLE_FINANCE : consultation de la fiche et des diagnostics. Aucun nouveau droit d’écriture n’est accordé à ces rôles ; les actions non autorisées sont cachées et refusées côté backend.
- ROLE_COACH et ROLE_CLIENT : APIs Admin refusées.
- Les écritures YoSales sont réservées au compte de service YoCoach et au produit du customer ; un appel humain direct ne peut pas choisir un faux auteur d’audit.

La dernière connexion et l’activité réelle affichent « Non disponible » : aucune source exploitable de login Keycloak ou d’historique central d’activité n’est raccordée dans ce projet. Aucune architecture d’activité supplémentaire n’est créée. Il n’existe pas de module de notes support général ou d’action Force Logout raccordée ; ces boutons ne sont donc pas ajoutés. La note privée de chaque offre apparaît dans les événements support.

Le chargement des diagnostics est déclenché à l’ouverture de l’onglet et utilise une requête navigateur agrégée. Les lectures de diagnostics ciblent un customer, sans charger tous les paiements du produit. Les lectures historiques de la fiche et de la liste conservent leur comportement antérieur.

## Déploiement et validation

Déployer YoSales, coach-empire et yo-coach-front ensemble. La configuration existante `ddl-auto:update` ajoute la table `complimentary_access` et son index par customer ; aucun ancien statut ni abonnement n’est migré. Mongo ajoute l’historique RESYNC aux documents concernés lors des actions.

Tests ciblés : tous les états de subscription, absence de subscription, Unlimited, jours calendaires et changement d’heure, mois, fin incluse, expiration exacte, révocation, concurrence par offre active, isolation produit/customer, identité d’admin, droits Support/Finance, compte bloqué, Trial actif/expiré, limites, paiement échoué, panne YoSales et écarts du cache. Les tests web vérifient le rendu, les confirmations, l’annulation, les erreurs et la navigation entre sections.

Les compilations et tests locaux ne remplacent pas la recette avec une session Admin authentifiée et les services déployés. Aucun compte réel n’a été modifié pour ces vérifications.

Validation locale finale : build Angular de développement et compilations Java réussis ; 23 tests Chrome Headless, 42 tests ciblés YoCoach et 61 tests YoSales (dont H2 et isolation des permissions) réussis. `git diff --check` passe dans les trois projets. Les fichiers de vérification et de cache créés pendant cette tâche ont été nettoyés après un manque d’espace disque.
