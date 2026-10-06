# Gestion des coachs — web

## Audit et réutilisation

La page Utilisateurs existante recherche et filtre les comptes par rôle et activation. Elle reste conservée. Son modèle de détail ne fournit pas le Trial, le plan courant et la limite de clients ; une vue coachs dédiée complète donc ce module.

Le compteur `UserRepository.countActiveClients` et `CoachSubscriptionStateService.stateOf` sont réutilisés. Les règles d'abonnement ne sont pas recopiées depuis l'ancienne collection CoachSubscription.

## Parcours

- Liste `/admin/coaches`, accessible dans Administration et depuis le dashboard.
- Recherche par nom, email ou ID ; filtres compte (actif, désactivé, banni), Trial (en cours, terminé, absent, indisponible) et plan.
- Pagination de 10 coachs ; filtres appliqués avant pagination ; inscriptions les plus récentes en premier.
- Détail `/admin/coaches/:id` : identité, ID, inscription, compte, Trial, plan, statut de l'abonnement, usage et limite. Le retour conserve les filtres et la page dans les paramètres du lien.
- Style partagé avec Custom Foods : pleine largeur, bouton retour, en-tête global et contenu avec marge intérieure de 24px ; responsive à 16px.

## Sources

YoCoach : `GET /api/admin/coaches` et `GET /api/admin/coaches/{id}`, protégés par ROLE_ADMIN. Coachs uniquement, démonstrations exclues. Clients actifs comptés selon la règle métier existante, hors démos et archivés.

YoSales : `GET /api/admin/dashboard/product/{productId}/coaches`, protégé par `access.productAdmin`. Appelé avec l'authentification de service existante et `yo-sales.product-id`. Le plan courant et sa limite proviennent du service d'état déjà utilisé par les coachs. Pendant le Trial, `maxActiveClients` est la limite de l'essai. Pour un abonnement connu, null signifie illimité.

Affichage : `8 / 10`, avec libellé Active Clients, ou `8 / Unlimited` en anglais (`8 / Illimité` en français). Un compte sans abonnement affiche Aucun abonnement. Une réponse manquante ou une panne affiche Indisponible, jamais Unlimited. Une panne conserve les données de comptes, mais les filtres Trial/plan dépendant de YoSales signalent une erreur au lieu de retourner des résultats trompeurs.

Le statut du Trial distingue l'essai courant, l'essai historique terminé et l'absence d'essai à partir de l'état YoSales et de `trialEndsAt` lorsqu'il existe. La date de création provient de l'audit User.

## Validation

- Compilations Angular, YoCoach et YoSales réussies.
- 3 tests Chrome Headless : recherche/filtres/liens, détail et limites, erreur/retry.
- 4 tests YoCoach : recherche/pagination/démos, absence de plan/illimité/panne, Trials et rôle coach, sécurité Spring des API Admin.
- 2 tests H2 YoSales : requêtes dashboard existantes et nouvelle liste des états, isolation produit et abonnement illimité.
- `git diff --check` réussi dans les trois projets.

La compilation globale des tests YoCoach est toujours bloquée par le test préexistant AssignmentClientsTest (ancien constructeur de ClientsController). Les tests ajoutés, compilés, ont été exécutés séparément par surefire:test.

Déployer YoSales, YoCoach et le web ensemble. Pas de migration de données. Le parcours avec une session admin et les données d'intégration reste à vérifier ; les tests web utilisent des réponses HTTP contrôlées et le test SQL utilise H2.

Limite de performance : l'agrégation des filtres d'abonnement charge actuellement les états du produit et les coachs avant de paginer. Pour un volume important, prévoir une agrégation paginée et une mesure du nombre de requêtes.

## Détail du coach — module 3

La vue existante propose désormais Overview, Subscription, Payments, Clients et Activity / History. Les filtres de liste sont conservés au retour. Les libellés sont disponibles en français et anglais ; BANNED apparaît comme Bloqué / Blocked, DISABLED comme Désactivé / Disabled.

- Overview : identité, email, ID, inscription, compte et Trial (début disponible, fin, statut, limite configurée du plan actuel, jours restants uniquement pendant un Trial).
- Subscription : plan, Monthly / Yearly, statut, début et fin de période, limite du plan, ID et annulation en fin de période.
- Clients : actifs / maximum actuellement autorisé ; la limite du Trial s’applique pendant le Trial, celle du plan autrement.
- Payments : factures YoSales, montant exact de facture, devise, dates et statut. Ces montants sont présentés comme montants facturés, sans assimiler toutes les factures à des paiements réussis.
- History : inscription et événements persistés des factures (paiement initié, échec, rejet, facture payée, annulation, etc.). Les dates des événements sont des heures locales YoSales Africa/Tunis. Aucun journal complet des actions du coach n’existe dans cette vue.

La nouvelle API `GET /api/admin/coaches/{id}/invoices` est protégée par ROLE_ADMIN et vérifie que l’ID appartient à un coach réel hors démo. Elle réutilise `SubscriptionOnboardingService.getInvoicesForCoach`, qui sélectionne le client YoSales lié à cet ID, et la protection customerAdmin existante côté YoSales. Une panne de facturation affiche une erreur dédiée et laisse accessibles les données du compte ; un rafraîchissement annule les requêtes précédentes.

YoSales expose quatre champs additionnels dans l’état partagé : trialStartedAt, trialMaxClients, planMaxClients et currentPeriodStart. Aucun changement de schéma ni migration. L’activation du premier paiement remplace historiquement startDate et trialEndsAt ; le début Trial n’est donc exposé que pour un essai non payé lorsque sa date source est disponible. Les dates non conservées restent explicitement non enregistrées. La limite Trial affichée est la configuration du plan actuel, pas une limite historique reconstruite.

Validation du module 3 : compilation Angular réussie ; 5 tests Chrome Headless (navigation des sections, dates/cycle/limites, factures/événements, erreurs et annulation des requêtes) ; 5 tests Admin YoCoach réussis par surefire:test ; 15 tests YoSales réussis, dont 2 H2. La compilation globale des tests YoCoach reste bloquée par AssignmentClientsTest. La session admin réelle reste à vérifier ; aucune validation visuelle authentifiée n’est revendiquée.

## Gestion du compte — module 4

Les règles locales existantes sont conservées : activation (activated=true), blocage (banned=true, activated=false), déblocage (banned=false, activated=true), désactivation (activated=false). Le statut de l’abonnement et les limites YoSales restent indépendants. Débloquer un compte dont l’abonnement est expiré ne renouvelle pas son abonnement.

Le détail propose uniquement les actions compatibles avec le statut courant. Chaque action ouvre une boîte de confirmation accessible, avec annulation et fermeture par Échap ; aucun PATCH n’est envoyé avant confirmation. Le bouton est verrouillé pendant l’envoi. Blocage : motif obligatoire parmi Manual Admin Block, Subscription Expired, Payment Problem et Other ; Other exige une précision. Les précisions sont limitées à 1000 caractères.

`PATCH /api/admin/coaches/{id}/account` est réservé à ROLE_ADMIN. Le corps comprend action, expectedStatus, reason et note. Le coach réel hors démo est vérifié, l’identité de l’auteur vient du token, les changements sur son propre compte sont refusés, et les transitions incompatibles/statuts modifiés renvoient 409. Une concurrence Mongo détectée par le champ version existant renvoie également 409 et exige une nouvelle confirmation.

L’audit coachAccountHistory est stocké dans le document User, dans le même save que les flags : action, ancien/nouveau statut, raison, commentaire, date UTC et ID de l’admin. Les données sont ignorées lors de la sérialisation générale du User et exposées explicitement par les API Admin coach. La raison courante s’affiche sur le détail bloqué et l’historique conserve les raisons après déblocage. Les anciens blocages sans audit restent « Non enregistrée », sans reconstruction. Mongo accepte le champ additionnel sans migration obligatoire.

CoachAccountTransitions partage ces règles avec les anciennes actions UserService (ban/unban/status/édition admin) ; les blocages par l’ancien écran enregistrent Manual Admin Block. Les anciens endpoints status/ban/unban sont désormais réservés à ROLE_ADMIN. Le PUT de profil est autorisé à l’admin ou au propriétaire identifié par le subject JWT ; l’édition personnelle conserve les flags, rôles et l’audit, et ne permet pas de s’activer ou se débloquer.

CoachAccountAccessFilter est placé après l’authentification Bearer dans la chaîne Spring Security, sans seconde inscription comme filtre servlet. Pour un coach local bloqué ou désactivé, les nouvelles requêtes privées sont refusées en 403 même avec un JWT toujours valide ; les routes publiques restent accessibles. L’autorisation Keycloak et les sessions WebSocket déjà ouvertes ne sont pas modifiées par cette action locale.

Validation : compilation Angular et sources Java réussies ; 8 tests Chrome Headless, incluant confirmation/annulation, Other requis, les quatre actions, erreurs et conflit ; 11 tests backend ciblés des transitions, audit, ancien écran, identité JWT, permissions et refus d’accès avec un JWT existant. La compilation globale des tests reste bloquée par AssignmentClientsTest ; les tests Admin compilés sont exécutés par surefire:test. Les changements sur un compte réel et la vérification visuelle authentifiée restent à effectuer après redémarrage du backend.

## Correction du blocage Admin par l’écran client archivé

Le contrôle d’archivage client ne s’applique qu’aux sessions ROLE_CLIENT sans ROLE_ADMIN ni ROLE_COACH. CoachingAccessService efface l’état bloqué lorsqu’il quitte cette portée, y compris après déconnexion, et ignore les réponses tardives d’un ancien contrôle. AuthInterceptor ne publie plus CLIENT_ARCHIVED comme blocage global du visiteur sans vérifier cette portée. Les erreurs HTTP restent transmises à la page appelante.

ArchivedClientAccessConfig applique la restriction d’archivage au même rôle client exclusif. Un clientStatus historique ARCHIVED sur un admin ou un coach ne bloque plus leur session. Les vérifications métier sur un client cible restent en place. CoachAccountAccessFilter réserve également le blocage du compte coach aux utilisateurs sans ROLE_ADMIN afin de préserver les comptes Admin qui possèdent aussi le rôle coach.

Validation : compilation web réussie, 14 tests Chrome Headless (accès client, intercepteur, détail Admin et garde Admin), 11 tests backend ciblés (archivage HTTP, gestion des comptes et sécurité). Les clients réellement archivés restent refusés ; les Admins à rôles multiples, les coachs et les anciennes réponses client ne déclenchent plus l’écran global d’archivage. Tests backend lancés via surefire:test après compilation ; AssignmentClientsTest bloque toujours la compilation globale. Vérification de la session réelle après rechargement web et redémarrage de coach-empire encore nécessaire.

## Connexion d’un coach bloqué ou désactivé — web et Flutter

`GET /api/account/access`, authentifié, dérive l’identité du JWT et reste lisible même lorsque le compte est bloqué. Il renvoie ACTIVE, BLOCKED ou DISABLED, avec uniquement la catégorie de motif connue. Les notes privées et l’identité de l’admin ne sont pas exposées. Le filtre de refus des routes privées renvoie le même statut dans son 403 COACH_ACCOUNT_UNAVAILABLE. Les sessions ADMIN sont exemptées.

Le web vérifie le statut avant les routes privées, au retour sur la fenêtre et périodiquement. Un refus reçu en cours de session affiche également l’écran global dédié. Les messages sont distincts en français/anglais, avec le motif connu, Vérifier à nouveau et Se déconnecter. Une panne affiche Impossible de vérifier l’accès ; elle n’est pas présentée comme un blocage. Les autres erreurs 403 gardent leur traitement normal.

La même prise en charge est implémentée dans `yo-coach-mobile` : vérification avant ouverture des pages privées, reprise de l’app, contrôle périodique, redirection globale en cas de refus. Le dossier `yo_coach_mobile` n’est pas modifié.

Redémarrer coach-empire, actualiser le web et faire un hot restart Flutter pour charger ces changements. Les tests utilisent des réponses contrôlées ; la session réelle sur l’émulateur et dans Chrome reste à vérifier.

Validation : compilation Angular réussie ; 18 tests web Chrome Headless, 10 tests Flutter et 13 tests backend ciblés réussis, dont un test HTTP du endpoint de statut avec principal JWT. Analyse des nouveaux fichiers Flutter et d’AuthState sans problème. Les fichiers Flutter existants API/router conservent des avertissements préexistants ; la suite Maven complète reste bloquée par AssignmentClientsTest, les tests ciblés compilés ayant été exécutés via surefire:test.

## Subscriptions — module 5

`/admin/subscriptions` remplace le parcours de l’ancien écran `/subscriptions`, qui est redirigé. Cet écran ancien lisait les collections locales obsolètes de YoCoach ; le nouveau parcours lit uniquement YoSales via `GET /api/admin/subscriptions` côté YoCoach et `GET /api/admin/subscriptions/product/{productId}` côté YoSales. Les anciens fichiers et API locaux sont conservés pour les éventuels consommateurs legacy, sans être utilisés par ces nouvelles pages.

La liste présente tous les abonnements des coachs réels liés par yoSalesCustomerId, y compris les abonnements historiques : coach, email, ID d’abonnement, plan, Monthly/Yearly, début, fin, statut et annulation prévue en fin de période. Le nom ouvre le détail du coach. Recherche par identité/ID, filtres de statut/plan/compte et pagination disponibles. Une panne remonte une erreur avec réessai, sans inventer une liste vide.

Les six statuts natifs restent TRIAL, ACTIVE, EXPIRED, CANCELLED, PENDING et PAST_DUE. Aucun BLOCKED/SUSPENDED ajouté à YoSales : Bloqué/Désactivé sont les statuts du compte YoCoach, affichés dans une colonne et un filtre distincts. Les dates privilégient les périodes/trials persistés, avec les dates legacy converties dans le fuseau du customer si nécessaire. La consultation ne force aucune transition de cycle de vie ; les jobs YoSales existants restent responsables des statuts.

Le relais YoCoach est réservé à ROLE_ADMIN. YoSales applique productAdmin et filtre simultanément le produit du plan et du customer. Les démos et clients non-coachs sont exclus du rapprochement. L’agrégation filtre/pagine actuellement en mémoire après lecture des abonnements du produit ; pour de gros volumes, prévoir une pagination jointe ou une projection des identités.

## Plans — module 6

`/admin/plans` consulte, crée, modifie et active/désactive les plans du produit YoCoach. Le relais `/api/admin/plans` réutilise les API Plan existantes de YoSales ; il impose le productId configuré et vérifie le produit d’un plan avant chaque modification. Aucune copie de plan/subscription n’est sauvegardée dans Mongo.

YoSales a un prix et un billingCycle par plan. Les tarifs mensuels et annuels sont donc des plans distincts, visibles dans deux colonnes tarifaires et créés via le sélecteur Monthly/Yearly. Aucun prix annuel extrapolé, aucun regroupement par nom pouvant fusionner des plans différents. La devise vient du produit YoSales. Le formulaire conserve nom, planCode unique, description, pricingModel existant, fromUnits, toUnits/maxClients, Unlimited (Integer.MAX_VALUE), freeTrialDays, trialMaxClients et extraFeePerUnit. Les addons/coupons/billingRules existants sont préservés par la modification du plan ; leur administration avancée reste dans YoSales.

Le modèle Plan ne possédait aucun flag d’activation. Ajout du booléen nullable `active` dans YoSales uniquement, avec défaut SQL true et interprétation des anciennes valeurs null comme actives. Le ddl-auto:update déjà configuré ajoute la colonne au redémarrage. L’API YoSales `PUT /api/plans/{id}/active` met à jour uniquement ce flag dans une transaction ; le relais web expose un PATCH. Aucun DELETE depuis cette page : la désactivation conserve abonnements et règles de renouvellement. Les plans inactifs sont retirés de la sélection YoCoach et refusés pour nouveaux abonnements, checkout, nouveaux changements de plan et upgrades automatiques. Les renouvellements et paiements déjà engagés gardent leurs règles existantes.

Création/édition et changement d’activation passent par une boîte de confirmation, avec annulation/Échap et verrouillage pendant la requête. Prix négatifs/non finis, limites incohérentes et Trials invalides sont refusés côté serveur. Les conflits de planCode permettent de corriger le formulaire sans perdre sa saisie.

Validation modules 5–6 : build Angular et compilation Java réussis ; 15 tests Chrome Headless du billing, détail coach et garde Admin ; 14 tests YoCoach ciblés ; 24 tests YoSales incluant H2/persistance et 58 tests de régression checkout/upgrade/renouvellement/contrôleur/mapper. AssignmentClientsTest bloque toujours la compilation globale des tests YoCoach ; les tests ciblés compilés sont exécutés via surefire:test. Redémarrer YoSales et coach-empire, puis actualiser le web. Les parcours avec session admin réelle restent à vérifier ; aucune modification de données réelles ni validation visuelle authentifiée n’est revendiquée.

## Affectation manuelle et prolongation Trial — modules 7–8

Le détail d’un coach propose « Affecter un plan manuellement » pour un abonnement YoSales existant. La confirmation montre le plan actuel et le nouveau plan sélectionné, avec un motif obligatoire. L’affectation remplace le plan dans YoSales et conserve le statut, les dates et les paiements existants ; elle ne crée pas de facture ni de nouvelle activation. Les plans inactifs ou d’un autre produit et les limites inférieures au nombre réel de clients actifs sont refusés. Un Trial exige un plan proposant un Trial. Pour une période déjà payée, le cycle de facturation doit rester identique. Les factures ouvertes, changements programmés, addons, coupons et PAST_DUE doivent être résolus dans YoSales avant cette correction exceptionnelle.

Les informations Trial existantes affichent début, fin, statut, limite et jours restants. « Prolonger le Trial » propose +7, +15 ou +30 jours et montre la nouvelle date avant confirmation. Le calcul ajoute des jours calendaires dans le fuseau du customer, y compris lors d’un changement d’heure. Seuls les abonnements non payés encore au statut TRIAL avec une date de fin connue sont éligibles ; les statuts EXPIRED/CANCELLED ne sont pas réouverts. La nouvelle fin doit être future. La date de début, le plan et la limite restent conservés.

Les deux actions passent par POST `/api/admin/coaches/{id}/subscription/{ASSIGN_PLAN|EXTEND_TRIAL}`, réservé à ROLE_ADMIN et aux coachs réels hors démo. YoCoach fournit lui-même le nombre de clients actifs et l’identité JWT de l’admin, puis relaie vers YoSales avec son compte de service. YoSales réserve l’écriture à ce compte de service et applique sa protection customerAdmin. Le navigateur ne choisit ni l’identité d’audit ni le compteur de clients.

Chaque modification et son événement `SubscriptionAdminEvent` sont enregistrés dans la même transaction SQL : auteur, motif, date UTC, abonnement, statut et ancien/nouveau plan ou ancienne/nouvelle fin Trial. Les événements se consultent dans Activity / History, indépendamment du chargement des factures. Le plan/statut/fin vus avant confirmation sont revérifiés côté serveur ; un conflit 409 impose une actualisation et une nouvelle confirmation. Le champ SQL `Subscription.version` protège aussi les écritures concurrentes des jobs et actions Admin. Le ddl-auto:update configuré ajoute cette colonne et la table d’audit au redémarrage de YoSales.

Validation : 11 tests web Chrome Headless et 13 tests YoCoach ciblés réussis ; 60 tests YoSales réussis, incluant les transactions H2, les refus et les jobs Trial/renouvellement, puis 41 tests de régression checkout, upgrade, factures de renouvellement et contrôleur. La compilation globale des tests YoCoach reste bloquée par le test préexistant AssignmentClientsTest ; les tests ciblés compilés sont exécutés par surefire:test. Redémarrer YoSales et coach-empire puis actualiser le web. Le parcours avec session admin réelle reste à vérifier ; aucun abonnement réel n’a été modifié.

## Paiements et limites clients — modules 9–10

Sidebar Admin → Paiements (`/admin/payments`) consulte les tentatives de paiement YoSales : coach et lien vers son détail, montant, devise, plan de la facture, cycle, moyen, date et statut. Recherche par nom/email/ID du coach, paiement/facture et plan ; filtres statut, moyen, devise, Monthly/Yearly ; pagination. Les six statuts natifs SUCCESS, PENDING, FAILED, REFUNDED, TO_REFUND et CANCELLED sont conservés. Une facture sans tentative n’est pas créée comme paiement fictif. Une panne affiche une erreur avec réessai ; les requêtes remplacées sont annulées.

YoCoach expose GET `/api/admin/payments`, réservé à ROLE_ADMIN, et rapproche uniquement les coachs réels hors démo par leur yoSalesCustomerId. Son relais de service lit GET `/api/admin/payments/product/{productId}` dans YoSales, protégé par productAdmin et limité simultanément au produit du customer et de la subscription. La consultation ne change aucun statut et ne déclenche ni paiement ni remboursement.

Le montant provient de la facture : Payment.amount est historiquement un Long tronqué, alors que la passerelle et la confirmation utilisent le montant exact de la facture. Flouci utilise TND ; les autres moyens utilisent la devise du produit, suivant la logique existante. Les montants/date/moyen manquants restent indisponibles. Pour SUCCESS, la date PAID de l’audit est préférée lorsqu’elle existe, convertie depuis le fuseau métier Africa/Tunis ; sinon la date de tentative enregistrée est affichée explicitement comme telle. La date de tentative ne prétend pas représenter une date de remboursement. Le planId de la facture permet de retrouver le plan payé malgré une affectation ultérieure. Les anciennes factures sans planId affichent leur planSnapshot, avec cycle non enregistré ; aucun cycle historique n’est reconstruit depuis l’abonnement actuel. Les noms/cycles des plans et devises ne disposent pas d’un snapshot immuable structuré dans le schéma existant.

Sidebar Admin → Gestion des coachs (`/admin/coaches`) ajoute le filtre Limite clients et les badges Proche (au moins 80 %, strictement sous la limite), Atteinte (égalité), Dépassée (supérieure). Le statut s’affiche aussi dans l’onglet Clients du détail. Unlimited reste distinct des limites inconnues et de l’absence d’abonnement. Une panne de YoSales ne classe jamais un coach comme illimité ; les filtres de limite nécessitant YoSales renvoient une indisponibilité.

Le nombre de clients utilise exclusivement UserRepository.countActiveClients : coachId actuel, hors démos et archivés, statuts ACTIVE ou anciens statuts vide/null/absent. La capacité vient du maxActiveClients effectif de l’état YoSales existant, donc de la limite Trial pendant un Trial et de la limite du plan suivant le statut actuel. Aucun changement de règle de comptage, d’invitation ou d’archivage. Le filtre s’applique avant pagination, et reste dans le lien du détail pour le retour à la liste.

Validation : build Angular et compilation Java réussis, 16 tests Chrome Headless (Payments, coachs et garde Admin), 9 tests YoCoach ciblés (permissions, rapprochement, filtres, limites et erreurs), 2 tests SQL H2 YoSales (produit, tous les statuts, montant précis, date, ancien plan et données manquantes). Le test préexistant AssignmentClientsTest bloque encore la compilation globale des tests YoCoach ; les tests ciblés compilés ont été exécutés via surefire:test. Redémarrer YoSales et coach-empire, puis actualiser le web. Les tests utilisent des données contrôlées ; la session Admin réelle reste à vérifier.

## Base des aliments et support — modules 11–12

Sidebar Nutrition → Aliments (`/nutrition/custom-foods`) reste l’unique accès au catalogue et réutilise CustomFoodsComponent et les API FoodRef existantes. L’Admin voit la base globale et ses actions complètes dans cette même page ; le Coach conserve son accès et ses droits existants. Aucun second catalogue ni éditeur de servings n’est créé. L’accès ajouté dans Administrateur a été retiré ; `/admin/foods` redirige vers la page Nutrition pour les anciens liens.

L’Admin recherche, crée et modifie les aliments globaux avec leurs valeurs nutritionnelles et servings multiples (par exemple 100 g / 1 egg / 2 eggs ou 100 ml / 1 cup), et choisit le serving principal. Les IDs des servings sont conservés lors de l’édition ; les nutriments déjà présents mais absents du formulaire ne sont pas supprimés. L’import Excel existant reste disponible. Les règles FoodServings existantes, dont la limite de 20 servings et la validation des unités/macros, sont conservées.

L’Admin gère le catalogue global ; les coachs le consultent sans pouvoir le modifier, et gardent leurs droits sur leurs aliments privés. La suppression d’un aliment global est déjà un archivage : la confirmation et le bouton indiquent maintenant « Archiver », le document et les références des plans restent conservés, et l’aliment sort des recherches actives. Une erreur d’archivage/suppression reste visible dans la confirmation avec possibilité de réessai ; les doubles envois sont verrouillés. Les erreurs de chargement ne sont plus présentées comme une liste vide, et les recherches remplacées sont annulées.

Côté FoodRefServiceImpl, POST ignore désormais tout ID fourni afin de ne jamais écraser un document existant. Les noms sont requis et limités à 100 caractères lors de création/édition. La recherche applique Pattern.quote avant les requêtes Mongo regex : les parenthèses et autres caractères spéciaux sont recherchés littéralement. Aucun changement de schéma ni de source de données.

Support : Sidebar Administrateur → Gestion des coachs → recherche par nom complet, email ou Coach ID → nom/bouton Ouvrir pour accéder à la fiche complète. Ce parcours déjà fonctionnel est conservé sans écran ni entrée de menu supplémentaire. La recherche ne dépend pas de la disponibilité de YoSales et garde les identités locales ; les filtres de subscription/limite nécessitant YoSales gardent leur gestion d’erreur existante.

Validation : 37 tests web Chrome Headless (aliments, servings et détail coach), 31 tests backend ciblés (catalogue, droits, archivage, nutrition/servings, import et recherche support), compilation Java et build Angular. La compilation globale des tests backend reste bloquée par AssignmentClientsTest préexistant ; les tests ciblés compilés passent via surefire:test. Redémarrer coach-empire puis actualiser le web. Aucune donnée réelle n’a été modifiée ; la session Admin réelle reste à vérifier.

## Historique Admin — module 13

Sidebar Administrateur → Historique Admin (`/admin/history`). Recherche par admin, identité du coach, plan ou motif ; filtre par action ; pagination ; lien direct vers le détail du coach. Chaque ligne présente date/heure locale, admin (nom si l’identité est connue, sinon ID), cible, motif et uniquement les valeurs qui ont changé. Une identité ou une ancienne valeur absente reste signalée comme non enregistrée ; aucun historique passé n’est inventé.

`GET /api/admin/history` est réservé à ROLE_ADMIN. Il agrège les événements coachAccountHistory Mongo existants et les événements SubscriptionAdminEvent YoSales existants : activation, blocage, déblocage, désactivation, affectation manuelle du plan et prolongation Trial. Les coachs de démonstration et les customers sans coach réel associé sont exclus. Les événements ne sont pas copiés dans une nouvelle collection YoCoach.

Les endpoints Plan existants de YoSales enregistrent désormais création, modification, activation/désactivation et suppression dans PlanAdminEvent. Les snapshots contiennent les propriétés utilisées du plan : prix, cycle, limites, Trial, code, nom, modèle tarifaire, description et activation. L’écriture du plan et de son événement est transactionnelle ; une opération identique sans changement ne produit pas de log. Le relais YoCoach transmet l’identité issue du JWT via X-Admin-Actor ; YoSales accepte ce header uniquement pour le client de service coach autorisé. Les autres appelants sont identifiés par leur propre JWT.

`GET /api/admin/history/product/{productId}` YoSales exige productAdmin et conserve l’isolation des produits. Si YoSales est indisponible, les actions de compte restent consultables avec un avertissement explicite « historique partiel ». Un filtre portant exclusivement sur une action de facturation renvoie une erreur réessayable, pas un faux résultat vide. L’agrégation filtre et pagine en mémoire, comme les autres listes Admin ; une projection/pagination serveur sera nécessaire pour des volumes importants.

Redémarrer YoSales et coach-empire, puis actualiser le web. Le ddl-auto:update configuré crée la table plan_admin_event au redémarrage. Les anciens événements de compte/Trial/subscription sont conservés ; l’audit des changements de plans démarre à partir de cette mise à jour.

## Design et vérification — modules 14–15

L’historique réutilise les composants Angular et styles de Gestion des coachs : en-tête pleine largeur, bouton retour, tableau, recherche, filtres, bouton Réinitialiser en dernier et pagination. Les libellés sont français/anglais. La gestion des aliments reste uniquement dans Nutrition → Aliments, avec le composant existant ; `/admin/foods` est une redirection sans canActivate, vérifiée par initialisation réelle du routeur pour éviter la régression NG04014 / écran blanc.

Les pages Admin actives et leurs services utilisent les API réelles YoCoach/YoSales. Aucune donnée mock n’a été introduite dans ces écrans. Les fixtures restent dans les tests. L’ancien composant RevenueSubscriptions, absent des routes et du module applicatif, reste conservé pour éviter une suppression hors périmètre.

Validation finale ciblée : build Angular réussi ; 40 tests Chrome Headless réussis (dashboard, coachs, abonnements/plans, paiements, historique, catalogue, garde et routeur) ; 45 tests coach-empire réussis ; 35 tests YoSales réussis, dont persistance H2, audit création/édition, refus d’un prix invalide sans log, rollback conjoint plan/log, identité non falsifiable, absence de logs pour les changements identiques et isolation des produits. Pour les tests d’historique, H2 utilise son dialecte natif afin de vérifier exactement la conservation des instants après relecture.

Limites de la validation globale : AssignmentClientsTest préexistant bloque testCompile côté coach-empire ; les classes ciblées compilées passent via surefire:test. Deux anciens tests Angular de scaffolding (UsersComponent et RevenueSubscriptionsComponent) échouent faute de HttpClient dans leur configuration ; les 40 tests des modules actifs passent. Aucune session Admin authentifiée ni donnée réelle modifiée pendant cette validation.

Parcours de recette à exécuter sur comptes de test après redémarrage :

| Parcours | Vérification attendue |
| --- | --- |
| Dashboard → coachs → détail → paiements | Données réelles, erreurs explicites si YoSales indisponible |
| Blocage avec motif → connexion coach → déblocage | Confirmation, accès refusé clairement, statut restauré, deux logs identifiant l’admin |
| Désactivation → activation | Confirmation et valeurs avant/après dans l’historique |
| Affectation manuelle | Ancien/nouveau plan confirmés, règles YoSales respectées, événement visible |
| Prolongation Trial | Date mise à jour et anciennes/nouvelles dates visibles dans l’historique |
| Création/édition/activation de plan | Plan relu depuis YoSales et événement correspondant ; aucun double log sur action identique |
| Limite clients et Unlimited | Comptage actif existant, filtres proche/atteinte/dépassée cohérents |
| Nutrition → Aliments | Création, édition multi-servings, archivage sans second catalogue |
| Support → recherche nom/email/ID | Accès direct à la fiche et conservation des identités si YoSales indisponible |

Ces parcours avec session réelle restent requis avant de déclarer la recette du ticket terminée.
