# Dashboard Admin YoCoach (web)

Route : `/admin/dashboard`. Entrée Dashboard Admin dans le menu Administration. Angular uniquement ; aucun fichier Flutter modifié.

## Audit et périmètre

- Les pages Utilisateurs et Abonnements/Revenus existaient déjà : elles sont conservées.
- L'ancien `/api/subscriptions/stats` compte les lignes `CoachSubscription` comme des coachs et présente une moyenne annuelle comme revenu mensuel. Ses contrôleurs sont explicitement marqués obsolètes. Le nouveau dashboard ne l'utilise pas.
- Les abonnements et essais actuels sont dans YoSales. Le dashboard passe par le backend YoCoach et son authentification de service existante, sans exposer de secret au navigateur.

## Sources et définitions

`GET /api/admin/dashboard/users` (YoCoach, ROLE_ADMIN) : utilisateurs MongoDB. Coachs et clients comptés par rôle ; comptes de démonstration exclus. Nouveaux coachs = date de création comprise entre maintenant moins 30 jours et maintenant. Clients = tous les comptes clients, y compris archivés.

`GET /api/admin/dashboard/billing` (YoCoach, ROLE_ADMIN) appelle `GET /api/admin/dashboard/product/{productId}` (YoSales, politique `access.productAdmin`). Le produit est celui de `yo-sales.product-id`, déjà configuré pour l'onboarding.

- Un abonnement courant par client YoSales, selon la même sélection que `CoachSubscriptionStateService.current` (dernier abonnement encore courant, sinon dernier historique).
- Free Trial : statut TRIAL, date de fin non atteinte lorsqu'elle est renseignée. Les anciens essais sans `trialEndsAt` utilisent `endDate` et la date métier Africa/Tunis, comme le job d'expiration historique.
- Actifs : statut ACTIVE. PAST_DUE n'est pas inclus dans les actifs.
- Expirés : statut EXPIRED ou essai arrivé à sa date de fin, même avant l'exécution du job d'expiration.
- Bloqués : union des coachs bannis/désactivés et des coachs liés à un client YoSales en lecture seule (EXPIRED, CANCELLED, PENDING, statut inconnu ou essai terminé). Un coach ne compte qu'une fois.
- Revenus : paiements SUCCESS uniquement, montants exacts des factures associées (le champ historique Payment.amount arrondit les décimales). Pas de somme entre devises. FLOUCI = TND ; autres passerelles = devise du produit ; devise absente = UNKNOWN. Paiements FAILED, PENDING, TO_REFUND, REFUNDED et CANCELLED exclus.
- Mois courant : mois UTC. Date du règlement issue de l'événement d'audit PAID (stocké en heure métier Africa/Tunis), sinon date historique du paiement. Cette dernière peut représenter la création de la tentative pour les anciennes factures sans audit.

## Parcours et exploitation

Chargements indépendants Utilisateurs/YoSales, actualisation manuelle, état vide pour les paiements, erreur explicite et tiret pour les indicateurs indisponibles. Aucun chiffre simulé en cas de panne. Libellés français et anglais, tableau responsive.

Déployer les changements YoSales et YoCoach avec le web. La configuration et les autorisations du compte de service existant doivent permettre l'accès au produit YoCoach. Aucun schéma ni migration de données nécessaire.

Tests ajoutés : agrégats backend, fenêtre de création, démos, blocages, expiration des essais, précision monétaire, date de règlement, restriction admin côté backend et frontend, panne YoSales puis actualisation dans le composant Angular.

La vérification contre une base réelle et une session admin reste nécessaire en environnement d'intégration. Les tests du composant utilisent des réponses HTTP contrôlées et ne prouvent pas l'état des données déployées.

## Validation effectuée

- Build Angular development : réussi.
- 2 tests web : composant (panne puis actualisation) et guard admin, réussis dans Chrome Headless.
- 4 tests YoCoach : compteurs, blocages, panne YoSales, sécurité de méthode Spring, réussis.
- 5 tests YoSales : 4 tests de calcul et un test d'intégration H2 des requêtes réelles, réussis.
- La compilation générale des tests YoCoach reste bloquée par un test préexistant `AssignmentClientsTest`, qui appelle l'ancien constructeur de `ClientsController` avec deux arguments au lieu de trois. Les nouveaux tests compilés ont été exécutés avec `surefire:test`.
