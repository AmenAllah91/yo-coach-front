# Backlog — Abonnements, essai gratuit et paiement Flouci

Ce document sert de guide pour un développeur qui n'a pas travaillé sur ce sujet. Chaque ticket contient assez d'informations pour être fait sans poser de question. Si une information manque, ajoute-la dans le ticket.

**Point de départ (aujourd'hui)**
- L'essai ne se termine jamais.
- Une facture est créée dès le jour 0 de l'essai.
- Le passage en « payé » dépend de la page de retour du navigateur.
- Il n'y a pas de limite pendant l'essai, pas de lecture seule.
- Le plan peut changer automatiquement.

**Point d'arrivée**
- Le cycle de vie décrit dans la partie « Règles validées ».
- Flouci seul pour l'instant, Stripe préparé sans contradiction.

---

## 1. Vocabulaire

| Mot | Sens |
|---|---|
| Coach | Utilisateur qui paie l'abonnement. |
| Client | Personne suivie par le coach. Seuls les clients **actifs** comptent dans les limites. |
| Essai | 30 jours gratuits, sans carte, sur le plan choisi sur le site. |
| Période | Temps payé : 1 mois ou 1 an. `currentPeriodEnd` est le jour où la période suivante commence. |
| Grâce | Jours après la fin d'une période payée où le coach peut encore payer sans être bloqué. Valeur : `BillingRules.paymentGraceDays` du plan. **Pas de grâce après un essai.** |
| Lecture seule | Le coach voit ses données, mais ne peut rien ajouter ni modifier. Ses clients voient encore leurs programmes. |
| Prorata | Montant calculé selon les jours restants. Mensuel = 30 jours, annuel = 365 jours. |
| Flouci | Paiement tunisien, en TND, sans carte enregistrée. Le coach paie lui-même à chaque période. |

## 2. Les 4 projets

| Sigle | Dépôt (branche `integration`) | Rôle |
|---|---|---|
| **YS** | `yo-sales` (Spring Boot) | Le cerveau : abonnements, factures, paiements, plans. Source de vérité. |
| **CE** | `coach-empire` (Spring Boot) | Backend de l'application coach. Il vérifie les droits du coach et appelle YS. |
| **FR** | `yo-coach-front` (Angular) | Ce que voit le coach. |
| **WEB** | `yocoach-website` (Angular) | Vitrine : plans, prix, lancement de l'essai. |
| **PAY** | microservice de paiement (pas dans ces dépôts) | Parle à Flouci. Appelé par YS avec `PaymentMsFeign`. |

**Chemin d'une inscription avec essai, aujourd'hui :**
`WEB (bouton « Start free trial » → /register?planId=X)` → `FR (register)` → `CE SubscriptionOnboardingService` → `YS POST /api/subscriptions/subscriptions` (`SubscriptionController.createSubscription`).

**Chemin d'un paiement de facture, aujourd'hui :**
`FR CoachBillingService` → `CE CoachBillingController (/api/billing/invoices/{id}/pay)` → `YS InvoiceController (POST /api/invoices/initiate-payment/{invoiceId}/{gateway})` → `InvoiceServiceImpl.payInvoice` → `PAY` → Flouci. Le retour passe ensuite par `POST /api/invoices/{invoiceId}/mark-payed`.

## 3. Statuts d'abonnement (YS : `SubscriptionStatus`)

| Statut | Sens | Accès du coach |
|---|---|---|
| `TRIAL` | Essai en cours | Complet, avec 5 clients actifs max et branding verrouillé |
| `ACTIVE` | Période payée en cours | Complet, selon les limites du plan |
| `PAST_DUE` | Période finie, facture de renouvellement non payée, dans la grâce | Complet, avec bandeau « paiement en retard » |
| `EXPIRED` | Essai fini sans paiement, ou grâce finie | Lecture seule |
| `CANCELLED` | Le coach a annulé et la période payée est finie | Lecture seule |
| `PENDING` | Plan sans essai, en attente du premier paiement | Lecture seule |

**Statuts de facture** (`InvoiceStatus`) : `DRAFT, PENDING, PAID, UNPAID, OVERDUE`. On ajoute `VOID` (annulée) au ticket SUB-08.

## 4. Règles validées

1. Essai de 30 jours sur le plan choisi sur le site, sans carte, sans facture. **Un seul essai par coach.**
2. Pendant l'essai : **5 clients actifs maximum**, branding verrouillé, bouton « Passer au plan payant » dans le menu.
3. Fin d'essai sans paiement : **blocage immédiat**, pas de grâce, lecture seule.
4. Les données du coach ne sont jamais supprimées.
5. Premier paiement ou réactivation : l'abonnement commence **le jour du paiement**. On ne facture pas les mois d'absence.
6. Renouvellement : **les dates ne bougent jamais**, même si le coach paie en avance ou pendant la grâce.
7. Facture de renouvellement créée **5 jours avant** la fin de période (**15 jours** pour l'annuel).
8. Changement de plan : prorata, payé **avant** l'accès. Jamais de changement de plan sans confirmation du coach.
9. Moins de clients (downgrade) : au prochain renouvellement, si les clients actifs rentrent dans le nouveau plan.
10. Mensuel → annuel : le coach paie le prix annuel moins ce qu'il a payé pour la période en cours. L'année commence au début de cette période. Annuel → mensuel : à la fin de l'année.
11. Prix d'un plan modifié : les abonnés gardent leur prix jusqu'à la fin de leur période.
12. La méthode de paiement n'est pas choisie par le coach. Pour l'instant : Flouci. Plus tard : Flouci pour la Tunisie, Stripe pour l'étranger.

**Exemple de référence :** essai le 1er octobre, paiement le 15 octobre → l'essai s'arrête le 15 octobre, l'abonnement mensuel va du 15 octobre au 15 novembre, la facture suivante est créée le 10 novembre.

## 5. Règles pour tous les tickets

- Toutes les dates de coupure utilisent le fuseau `Africa/Tunis`.
- Tous les montants sont en TND.
- Chaque ticket ajoute des tests automatiques pour ses critères d'acceptation.
- Une tâche automatique doit pouvoir tourner deux fois sans créer de doublon (idempotent).
- Ne jamais supprimer de données de coach. Pour une facture à annuler, utiliser `VOID`.
- Taille : S (≈ ½ jour), M (≈ 1–2 jours), L (≈ 3 jours ou plus).

---

# Phase 0 — Vérifications

Ces tickets ne changent pas le code. Ils produisent une note écrite dans le ticket. Ils peuvent changer le contenu des tickets suivants.

## SUB-01 — Comprendre le flux de confirmation Flouci
**Projet :** YS, PAY · **Dépend de :** – · **Taille :** M

**Pourquoi :** Aujourd'hui, la facture passe en « payée » par `POST /api/invoices/{id}/mark-payed`. On ne sait pas qui appelle cet endpoint. Tout le reste du chantier dépend de la confirmation de paiement.

**À faire :**
- Suivre un paiement de bout en bout : `payInvoice` → `PaymentMsFeign.initiatePayment` → Flouci → retour. Noter qui appelle `mark-payed` et quand.
- Lire `FlouciPaymentRequestMapper`, `PaymentMsFeign`, et noter les URL de succès et d'échec.
- Vérifier l'unité des montants : `Payment.amount` est un `long` (`invoice.getAmount().longValue()`). Écrire comment Flouci reçoit un montant comme 6,67 TND (millimes ou dinars).
- Noter si PAY envoie un callback signé (webhook).

**Critères d'acceptation :**
- [ ] Un schéma écrit (étapes + qui appelle quoi) est dans le ticket.
- [ ] La réponse à « que se passe-t-il si le coach ferme la page de retour ? » est écrite.
- [ ] L'unité des montants et le traitement des décimales sont écrits.
- [ ] La liste des changements à faire dans PAY est écrite pour SUB-10.

## SUB-02 — Auditer la sécurité des endpoints de paiement et de facture
**Projet :** YS, CE · **Dépend de :** – · **Taille :** S

**Pourquoi :** Si un coach peut appeler `mark-payed` lui-même, il peut marquer une facture payée sans payer.

**À faire :**
- Lister chaque endpoint qui change le statut d'une facture, d'un abonnement ou d'un paiement (`InvoiceController`, `PaymentController`, `SubscriptionController`, `CoachBillingController`).
- Pour chacun : qui peut l'appeler (rôle, token) ?
- Tester avec un token de coach : peut-il appeler `mark-payed`, `PUT /invoices/{id}`, `PUT /subscriptions/{id}` ?

**Critères d'acceptation :**
- [ ] Un tableau « endpoint, qui peut l'appeler, risque » est dans le ticket.
- [ ] La liste des endpoints à fermer ou à protéger est écrite pour SUB-10 et SUB-26.

## SUB-03 — Auditer les clients actifs, archivés, démo, et le branding
**Projet :** CE, FR · **Dépend de :** – · **Taille :** M

**Pourquoi :** On doit limiter à 5 clients actifs, verrouiller le branding, et mettre en lecture seule. Il faut savoir où.

**À faire :**
- Clients actifs ou archivés : champ `User.clientStatus` et `ClientCoachingAccess.status` (valeur `ACTIVE` ou `ARCHIVED`). Trouver les requêtes qui comptent les clients (`UserRepository`, `ClientServiceImpl`).
- Trouver où un client est **ajouté** à un coach (`InvitationService.acceptInvitation` et `acceptByToken`, création directe éventuelle) et où un client est **désarchivé**.
- Trouver comment les clients de démonstration sont créés (`DemoWorkspaceService`) et comment les reconnaître.
- Définir ce qu'est le « branding » : vérifier `CoachWebsite`, `ThemeColors`, `AppThemeColors`, `CoachSettings`, les routes `theme` et `websites/create` du front. Écrire la liste exacte des actions à verrouiller.
- Lire `ArchivedClientAccessConfig` : c'est un intercepteur qui bloque les écritures pour un client archivé. On l'imitera pour la lecture seule du coach.

**Critères d'acceptation :**
- [ ] La liste des points d'ajout et de désarchivage de client est écrite.
- [ ] Le moyen de reconnaître un client de démonstration est écrit.
- [ ] La liste des actions « branding » à verrouiller est écrite et validée par le product owner.

## SUB-04 — Relever les données réelles des plans et des abonnements
**Projet :** YS · **Dépend de :** – · **Taille :** S

**Pourquoi :** La migration (SUB-07) et les règles de grâce dépendent des vrais chiffres.

**À faire :**
- Pour chaque plan : `price`, `billingCycle`, `fromUnits`, `toUnits`, `freeTrialDays`, `pricingModel`, et ses `BillingRules` (`paymentGraceDays`, `upgradePolicy`, `downgradePolicy`, `adjustmentTiming`, `extraClientMode`, `cancelAfterGrace`).
- Compter les abonnements par statut, et lister ceux qui sont incohérents (essai sans date de fin, `endDate` dans le passé avec `ACTIVE`, plusieurs abonnements pour un même customer).
- Compter les factures `UNPAID` ou `OVERDUE` liées à un essai.
- Vérifier si `Product.reactivationPolicy` (`ALLOW_REACTIVATION` ou `ALLOW_ONLY_ON_PAYMENT`) est utilisé.

**Critères d'acceptation :**
- [ ] Un tableau des plans avec leurs règles est dans le ticket.
- [ ] Un tableau « statut → nombre d'abonnements » est dans le ticket.
- [ ] La liste des cas incohérents est donnée pour SUB-07.

## SUB-05 — Décider du sort de l'ancien modèle d'abonnement de coach-empire
**Projet :** CE · **Dépend de :** – · **Taille :** S

**Pourquoi :** CE a ses propres objets `CoachSubscription` (Mongo, statuts `ACTIF, EXPIRE, ANNULE, SUSPENDU`) et `SystemSubscriptionPlan` (avec `activeClientsLimit` et `freeTrialDuration`), avec `SubscriptionController` (`/api/subscriptions`) et `SubscriptionServiceImpl`. C'est un deuxième système, différent de YS. Si on les laisse, deux sources de vérité vont se contredire.

**À faire :**
- Chercher qui utilise ces classes (code CE, écran admin front `revenue-subscriptions`, route front `subscriptions`).
- Proposer : **YS est la seule source de vérité** pour l'état d'un abonnement de coach. Les anciennes classes sont marquées « obsolètes » et ne servent jamais à décider un droit d'accès.
- Écrire ce qui doit être déplacé ou gardé (par exemple les écrans de revenus de l'admin).

**Critères d'acceptation :**
- [ ] La décision est écrite et validée.
- [ ] La liste des écrans et appels qui utilisent l'ancien modèle est écrite.
- [ ] Si besoin, un ticket de suivi est créé pour migrer les écrans admin.

---

# Phase 1 — La base (yo-sales)

## SUB-06 — Fuseau Tunisie et verrou des tâches automatiques
**Projet :** YS · **Dépend de :** SUB-04 · **Taille :** S

**Pourquoi :** Le code utilise `ZoneId.systemDefault()` et `java.sql.Date`. Le résultat change selon le serveur. Les tâches `@Scheduled` peuvent aussi tourner deux fois si deux instances tournent.

**À faire :**
- Définir un `Clock` unique avec `Africa/Tunis` et l'utiliser partout dans `SubscriptionService` (il injecte déjà un `Clock`).
- Remplacer `ZoneId.systemDefault()` par ce fuseau dans les calculs de dates d'abonnement.
- Ajouter un verrou de tâche (par exemple ShedLock) sur `processDailyBilling`, `monitorGracePeriods` et sur les futures tâches.

**Critères d'acceptation :**
- [ ] Avec une horloge de test réglée à 23:59 puis 00:01 à Tunis, le « jour » change à minuit de Tunis.
- [ ] Avec deux instances lancées en même temps, la tâche ne s'exécute qu'une fois.

## SUB-07 — Ajouter les champs d'abonnement et migrer les abonnements existants
**Projet :** YS · **Dépend de :** SUB-04 · **Taille :** M

**Pourquoi :** Aujourd'hui, `Subscription` n'a que `startDate` et `endDate`, utilisées pour l'essai **et** pour la période payée.

**À faire :**
- Ajouter à `Subscription` : `trialEndsAt` (date), `currentPeriodStart`, `currentPeriodEnd` (dates), `paymentGateway` (valeur `FLOUCI` par défaut), `periodPaidAmount` (montant réellement payé pour la période en cours), `pendingPlanId` et `pendingPlanEffectiveDate` (changement planifié, null par défaut).
- Écrire la migration des données existantes : essai → `trialEndsAt = endDate`; `ACTIVE` → `currentPeriodStart = startDate` et `currentPeriodEnd = endDate`. Gérer les cas incohérents listés en SUB-04.
- Exposer les champs dans `SubscriptionDto` et le mapper.

**Critères d'acceptation :**
- [ ] Après la migration, tous les abonnements ont des champs cohérents (pas de période vide pour un `ACTIVE`).
- [ ] Une copie de la base avant migration est conservée, avec un script de retour en arrière.
- [ ] Les nouveaux champs apparaissent dans l'API.

## SUB-08 — Définir les statuts, les transitions et le statut `VOID`
**Projet :** YS · **Dépend de :** SUB-07 · **Taille :** M

**Pourquoi :** Les changements de statut sont dispersés dans le code (`setStatus` appelé à plusieurs endroits). Il faut un seul endroit qui contrôle.

**À faire :**
- Créer un service `SubscriptionLifecycleService` avec des méthodes claires : `startTrial`, `blockExpiredTrial`, `activateAfterPayment`, `markPastDue`, `expire`, `cancel`, `reactivate`.
- Autoriser seulement ces transitions : `TRIAL→ACTIVE`, `TRIAL→EXPIRED`, `ACTIVE→PAST_DUE`, `ACTIVE→CANCELLED`, `PAST_DUE→ACTIVE`, `PAST_DUE→EXPIRED`, `EXPIRED→ACTIVE`, `CANCELLED→ACTIVE`, `PENDING→ACTIVE`. Toute autre transition lance une erreur.
- Chaque méthode met aussi à jour `Customer.statutCustomer` (`ACTIF` ou `INACTIF`) : `INACTIF` seulement pour `EXPIRED`, `CANCELLED` et `PENDING`. **`PAST_DUE` reste `ACTIF`** (le code actuel le met `INACTIF`, c'est à corriger).
- Ajouter `VOID` à `InvoiceStatus`.

**Critères d'acceptation :**
- [ ] Un test par transition autorisée et par transition refusée.
- [ ] Après `PAST_DUE`, le customer est toujours `ACTIF`.
- [ ] Les autres tickets appellent ce service et non `setStatus` directement.

## SUB-09 — Limite de clients d'essai sur le plan
**Projet :** YS · **Dépend de :** SUB-07 · **Taille :** S

**Pourquoi :** Le plan a `fromUnits` et `toUnits` (limites du plan payant), mais rien pour l'essai.

**À faire :**
- Ajouter `trialMaxClients` (entier, null = pas de limite) sur `Plan`, dans `PlanDto` et dans les écrans/API d'administration des plans.
- Valeur 5 pour tous les plans qui ont `freeTrialDays > 0`.
- L'exposer dans l'API publique des plans (utilisée par le site).

**Critères d'acceptation :**
- [ ] L'API `GET` des plans renvoie `trialMaxClients`.
- [ ] Un administrateur peut changer la valeur.
- [ ] Tous les plans avec essai existants ont la valeur 5 après la migration.

## SUB-10 — Sécuriser la confirmation de paiement
**Projet :** YS, PAY · **Dépend de :** SUB-01, SUB-02 · **Taille :** L

**Pourquoi :** La confirmation de paiement doit venir de la banque (Flouci), pas du navigateur du coach.

**À faire :**
- Créer un endpoint de confirmation appelé **par PAY** (service à service), avec une signature ou un token de service. Il donne : identifiant de paiement, statut, montant.
- Vérifier que le montant et la devise correspondent à la facture.
- Marquer la facture `PAID` et le `Payment` `SUCCESS` (logique de `markInvoicePayed`), puis appeler `SubscriptionLifecycleService` (SUB-16 la complète).
- Rendre l'appel idempotent : une confirmation reçue deux fois ne fait rien de plus.
- Fermer l'ancien `POST /api/invoices/{id}/mark-payed` : plus accessible à un coach (rôle de service seulement).
- Garder `GET /{invoiceId}/payment-status` pour que le front puisse lire l'état.

**Critères d'acceptation :**
- [ ] Un appel sans signature valide est refusé (401 ou 403).
- [ ] Un appel avec un montant différent de la facture est refusé et journalisé.
- [ ] Une confirmation envoyée deux fois donne un seul changement et pas d'erreur.
- [ ] Un token de coach ne peut plus appeler `mark-payed`.

## SUB-11 — Ne plus créer de facture au démarrage de l'essai
**Projet :** YS, CE · **Dépend de :** SUB-08 · **Taille :** S

**Pourquoi :** Aujourd'hui, `SubscriptionController.createSubscription` appelle `subscriptionService.createNewInvoice` tout de suite. Le coach a une facture impayée dès le jour 0.

**À faire :**
- Dans `createSubscription` : si le plan a un essai, créer l'abonnement `TRIAL` avec `trialEndsAt = jour de début + freeTrialDays` et **ne pas** créer de facture.
- Si le plan n'a pas d'essai : statut `PENDING`, sans facture non plus (la facture est créée au clic « payer », SUB-15).
- Dans CE, `SubscriptionOnboardingService.buildSubscription` : envoyer les bonnes dates (fin d'essai en `trialEndsAt`).
- Supprimer ou adapter le paramètre `trialDays` de `createNewInvoiceWithCalculations` (il ne sert plus).

**Critères d'acceptation :**
- [ ] Une inscription avec essai crée un abonnement `TRIAL` et **aucune** facture.
- [ ] Une inscription sans essai crée un abonnement `PENDING` et aucune facture.
- [ ] `trialEndsAt` = date de début + nombre de jours d'essai du plan.

## SUB-12 — Bloquer automatiquement à la fin de l'essai
**Projet :** YS · **Dépend de :** SUB-06, SUB-07, SUB-08 · **Taille :** M

**Pourquoi :** Aujourd'hui, `findSubscriptionsNeedingBilling` ne prend pas les abonnements `TRIAL`. Un essai ne se termine jamais.

**À faire :**
- Ajouter une tâche automatique (chaque nuit, juste après minuit Tunis) qui prend tous les abonnements `TRIAL` dont `trialEndsAt <= aujourd'hui` et appelle `blockExpiredTrial` (statut `EXPIRED`, customer `INACTIF`).
- Convention : `trialEndsAt` est le **premier jour sans accès**. Essai commencé le 1er octobre avec 30 jours : `trialEndsAt` = 31 octobre, accès jusqu'au 30 octobre inclus.
- Ne pas créer de facture.
- Écrire une journalisation claire (nombre traité).

**Critères d'acceptation :**
- [ ] Un essai dont la date est passée devient `EXPIRED` à la prochaine exécution.
- [ ] Un essai dont la date n'est pas passée ne change pas.
- [ ] Exécuter la tâche deux fois donne le même résultat.
- [ ] Un essai payé avant (statut `ACTIVE`) n'est pas touché.

## SUB-13 — Endpoint « état de l'abonnement du coach »
**Projet :** YS · **Dépend de :** SUB-07, SUB-08, SUB-09 · **Taille :** M

**Pourquoi :** CE et FR ont besoin d'une réponse simple pour décider quoi autoriser et quoi afficher.

**À faire :**
- Créer `GET /api/subscriptions/coach/{customerId}/state` (ou équivalent), qui renvoie : `status`, `isReadOnly`, `trialEndsAt`, `trialDaysLeft`, `currentPeriodEnd`, `planId`, `planName`, `billingCycle`, `maxActiveClients` (limite d'essai ou `toUnits` du plan), `brandingAllowed` (faux pendant l'essai et en lecture seule), `openInvoiceId` (facture en attente s'il y en a une), `pendingPlanChange`.
- Accès : service à service (CE) et coach pour lui-même.

**Critères d'acceptation :**
- [ ] Pour chaque statut du tableau de la partie 3, la réponse est correcte (tests).
- [ ] `isReadOnly` est vrai pour `EXPIRED`, `CANCELLED`, `PENDING`.
- [ ] Un coach ne peut pas lire l'état d'un autre coach.

## SUB-14 — Un seul essai par coach
**Projet :** CE, WEB · **Dépend de :** SUB-07 · **Taille :** M

**Pourquoi :** `Customer.isTrialUsed` est mis à vrai à la création, mais il n'est pas contrôlé à l'inscription.

**À faire :**
- Dans `SubscriptionOnboardingService`, avant de créer le coach : chercher un compte existant avec le même email (ou téléphone). S'il existe, refuser avec un code d'erreur clair (`ACCOUNT_ALREADY_EXISTS`).
- Garder `isTrialUsed` à vrai pour tout coach qui a eu un essai. Ne jamais lui donner un second essai, même s'il revient avec un autre plan.
- Dans FR (écran d'inscription) : afficher « Vous avez déjà un compte, connectez-vous » avec un lien de connexion.

**Critères d'acceptation :**
- [ ] Une seconde inscription avec le même email ne crée ni compte ni abonnement.
- [ ] Le message d'erreur est affiché dans l'écran d'inscription.
- [ ] Un coach qui a déjà eu un essai n'en reçoit pas un nouveau quand il se réactive (SUB-18).

---

# Phase 2 — Premier paiement et réactivation

## SUB-15 — Créer la facture de premier paiement à la demande
**Projet :** YS · **Dépend de :** SUB-08, SUB-11 · **Taille :** M

**Pourquoi :** Il n'y a plus de facture au jour 0. Elle est créée quand le coach clique sur « Passer au plan payant ».

**À faire :**
- Endpoint `POST /api/subscriptions/{id}/checkout` avec le plan choisi. Il crée une facture `UNPAID`, type `SUBSCRIPTION`, raison `SUBSCRIPTION_START`, avec le prix du plan, les addons et les coupons valides (calcul existant `calculateInvoiceAmount`).
- Si une facture de premier paiement `UNPAID` existe déjà pour ce plan, la renvoyer (pas de doublon). Si le plan est différent, mettre l'ancienne en `VOID` et en créer une nouvelle (voir SUB-17).
- Date d'échéance = jour de création.
- Autorisé pour les statuts `TRIAL`, `PENDING`, `EXPIRED`, `CANCELLED`.

**Critères d'acceptation :**
- [ ] Deux appels avec le même plan renvoient la même facture.
- [ ] Un appel pour un abonnement `ACTIVE` est refusé.
- [ ] Le montant correspond au prix du plan moins les coupons valides.
- [ ] Un code promo expiré n'est pas appliqué.

## SUB-16 — Activer l'abonnement à la confirmation du premier paiement
**Projet :** YS · **Dépend de :** SUB-10, SUB-15 · **Taille :** M

**Pourquoi :** `markInvoicePayed` met `ACTIVE` mais ne change pas les dates : `endDate` reste celle de l'essai.

**À faire :**
- Quand une facture `SUBSCRIPTION_START` passe à `PAID` : `activateAfterPayment` avec `currentPeriodStart = aujourd'hui`, `currentPeriodEnd` = +1 mois (mensuel) ou +1 an (annuel), `periodPaidAmount` = montant payé, `trialEndsAt` = aujourd'hui si l'essai était encore en cours, statut `ACTIVE`, customer `ACTIF`.
- Si un changement de plan a été choisi au paiement (SUB-17), le plan de l'abonnement devient ce plan.
- Écrire dans le journal (SUB-51).

**Critères d'acceptation :**
- [ ] Paiement le 15 octobre pendant l'essai → période du 15 octobre au 15 novembre, statut `ACTIVE`.
- [ ] Même règle pour un paiement après la fin de l'essai.
- [ ] Plan annuel → fin de période = +1 an.
- [ ] Une seconde confirmation du même paiement ne change pas les dates.

## SUB-17 — Choisir ou changer de plan avant le premier paiement
**Projet :** YS · **Dépend de :** SUB-15 · **Taille :** S

**Pourquoi :** Le coach a un plan choisi sur le site, mais peut en prendre un autre en payant. Il n'a rien payé avant, donc pas de calcul de différence.

**À faire :**
- Dans `checkout`, accepter un `planId` différent de celui de l'abonnement. Annuler la facture ouverte précédente (`VOID`) et créer la nouvelle au prix du nouveau plan.
- Vérifier que le nombre de clients actifs du coach est inférieur ou égal à `toUnits` du plan choisi. Sinon : refus avec le code `PLAN_TOO_SMALL` et le nombre de clients.
- Autoriser un plan avec un minimum (`fromUnits`) plus haut que le nombre de clients (il paie le plan quand même).

**Critères d'acceptation :**
- [ ] Changer de plan avant de payer annule la facture précédente et crée la bonne.
- [ ] Un plan trop petit est refusé avec un message clair.
- [ ] Changer mensuel ↔ annuel avant le premier paiement ne demande aucun calcul de crédit.

## SUB-18 — Réactiver un compte bloqué ou annulé
**Projet :** YS · **Dépend de :** SUB-16, SUB-08 · **Taille :** M

**Pourquoi :** Aujourd'hui, `handleMissedBillingCycle` crée des factures rétroactives (`createBackdatedInvoice`) pour les périodes manquées. On ne veut jamais facturer les mois d'absence.

**À faire :**
- Un coach `EXPIRED` ou `CANCELLED` utilise `checkout` (SUB-15). Au paiement, `reactivate` : nouvelle période à partir du jour du paiement, statut `ACTIVE`. Pas de nouvel essai.
- Passer en `VOID` toutes les factures ouvertes (`UNPAID` ou `OVERDUE`) liées aux périodes manquées.
- Supprimer l'appel à `createBackdatedInvoice` quand le retard dépasse la grâce. La récupération rétroactive est seulement possible dans la grâce (SUB-33).
- Respecter `Product.reactivationPolicy` : la réactivation ne se fait qu'à la suite d'un paiement (`ALLOW_ONLY_ON_PAYMENT`).

**Critères d'acceptation :**
- [ ] Un coach bloqué depuis 3 mois paie une seule facture, et sa nouvelle période commence le jour du paiement.
- [ ] Aucune facture n'est créée pour les mois d'absence.
- [ ] Les anciennes factures ouvertes sont `VOID` et ne bloquent plus rien.
- [ ] Un coach qui a utilisé son essai ne peut pas repasser en `TRIAL`.

## SUB-19 — Gérer double paiement et paiement refusé
**Projet :** YS · **Dépend de :** SUB-10 · **Taille :** M

**À faire :**
- Si une confirmation arrive pour une facture déjà `PAID` avec un **autre** identifiant de paiement : ne pas changer les dates, créer un `Payment` marqué « à rembourser » et un événement dans le journal.
- Si Flouci refuse ou annule : `Payment` passe en `FAILED`, la facture reste `UNPAID`, le coach peut réessayer avec la même facture (nouvelle tentative de paiement, nouvel identifiant).
- Si le coach relance un paiement alors qu'un paiement est encore `PENDING` pour cette facture : réutiliser le lien existant ou annuler l'ancien avant d'en créer un.

**Critères d'acceptation :**
- [ ] Deux paiements différents sur une même facture donnent une seule période et un paiement marqué « à rembourser ».
- [ ] Un paiement refusé laisse la facture payable.
- [ ] Il n'existe jamais deux paiements `PENDING` pour une même facture.

## SUB-20 — La méthode de paiement est choisie par le système (Flouci seul)
**Projet :** CE, FR · **Dépend de :** SUB-07 · **Taille :** S

**Pourquoi :** Aujourd'hui, `CoachBillingService.getInvoicePaymentGateways` laisse le coach choisir. La règle est : le système choisit. Stripe viendra plus tard.

**À faire :**
- Dans CE `CoachBillingController` : l'endpoint `payment-gateways` renvoie la méthode de l'abonnement (`Subscription.paymentGateway`), donc `FLOUCI` seulement. `pay` utilise cette méthode, et ignore le paramètre `gateway` de l'appel.
- Dans FR : retirer le choix de méthode. Un seul bouton « Payer avec Flouci ».
- Garder le champ et l'interface pour pouvoir ajouter `STRIPE` plus tard sans changer les règles.

**Critères d'acceptation :**
- [ ] Le coach ne voit aucun choix de méthode.
- [ ] Un appel avec `gateway=STRIPE` est ignoré et utilise `FLOUCI`.
- [ ] La devise est toujours TND (comme le fait déjà `payInvoice` pour Flouci).

## SUB-21 — Bouton « Passer au plan payant » dans le menu
**Projet :** FR · **Dépend de :** SUB-13 · **Taille :** S

**À faire :**
- Dans `src/app/template/layout/sidebar/sidebar-items.ts` : ajouter un bouton « Passer au plan payant » avec le nombre de jours d'essai restants, visible seulement quand `status = TRIAL`.
- Lire l'état via l'endpoint de SUB-13 (service Angular dédié, mis en cache pour la session).
- Le bouton ouvre l'écran de paiement (SUB-22).

**Critères d'acceptation :**
- [ ] Le bouton est visible pour un coach `TRIAL`, avec « X jours restants ».
- [ ] Il n'est pas visible pour `ACTIVE`, `PAST_DUE`, `EXPIRED`.
- [ ] Il est visible aussi sur mobile.

## SUB-22 — Écran de paiement
**Projet :** FR · **Dépend de :** SUB-15, SUB-17, SUB-20 · **Taille :** M

**À faire :**
- Nouvelle page (par exemple `/subscription/checkout`) : plan déjà choisi (nom, limite de clients, prix, mensuel ou annuel), liste des autres plans pour changer, code promo.
- Message avant le paiement, **si l'essai est encore en cours** : « Votre essai s'arrête aujourd'hui et votre abonnement commence aujourd'hui. »
- Si un plan est trop petit pour le nombre de clients actifs, le griser avec l'explication.
- Bouton « Payer avec Flouci » : appelle `checkout` (SUB-15) puis `pay` (CE `CoachBillingService.initiateInvoicePayment`) et redirige vers l'URL de Flouci.

**Critères d'acceptation :**
- [ ] Un coach en essai arrive sur l'écran avec son plan présélectionné.
- [ ] Changer de plan met à jour le prix affiché.
- [ ] Un plan trop petit n'est pas sélectionnable.
- [ ] Le clic sur « Payer » mène à la page Flouci.

## SUB-23 — Retour de paiement et « vérification en cours »
**Projet :** FR · **Dépend de :** SUB-10, SUB-22 · **Taille :** M

**À faire :**
- Page de retour (succès et échec) : afficher « Paiement en cours de vérification » et interroger `payment-status` toutes les quelques secondes pendant 1 à 2 minutes.
- Quand le paiement est confirmé : message de succès, rechargement de l'état d'abonnement, redirection vers le tableau de bord.
- Si le coach abandonne ou ferme la page : la facture reste visible dans « Mes factures » avec le bouton « Payer ». Le retour sur cette page ne crée jamais une deuxième facture.
- Si la vérification dépasse le temps : message « Nous vérifions votre paiement, vous recevrez un email ».

**Critères d'acceptation :**
- [ ] Après un vrai paiement, le coach voit le succès sans recharger la page.
- [ ] Un paiement refusé affiche un message et un bouton pour réessayer.
- [ ] Fermer la page avant le retour n'empêche pas l'activation (elle vient de SUB-10).

---

# Phase 3 — Restrictions

## SUB-24 — coach-empire : lire l'état d'abonnement et décider les droits
**Projet :** CE · **Dépend de :** SUB-13 · **Taille :** M

**À faire :**
- Ajouter un client `YoSalesClient.getCoachSubscriptionState` (le client Feign existe déjà dans `client/feign/YoSalesClient.java`).
- Créer un service `CoachEntitlementService` avec des méthodes simples : `canAddActiveClient(coachId)`, `canUseBranding(coachId)`, `isReadOnly(coachId)`, `maxActiveClients(coachId)`.
- Garder la réponse en cache pour 1 à 5 minutes. Vider le cache quand un paiement ou un changement d'abonnement est connu (voir SUB-10).
- Si YS ne répond pas : politique claire et écrite (recommandé : ne pas bloquer le coach, journaliser).

**Critères d'acceptation :**
- [ ] Les trois méthodes retournent la bonne valeur pour chaque statut (tests avec un faux YS).
- [ ] Une panne de YS ne bloque pas un coach qui travaille.
- [ ] Un changement d'état est visible en moins de 5 minutes.

## SUB-25 — Compter uniquement les clients actifs
**Projet :** CE · **Dépend de :** SUB-03 · **Taille :** S

**À faire :**
- Créer une méthode unique `countActiveClients(coachId)` : compte les clients dont le statut est `ACTIVE` (voir `ClientCoachingAccess.status`), sans compter les clients de démonstration (règle trouvée en SUB-03).
- Utiliser cette méthode partout où une limite est contrôlée.

**Critères d'acceptation :**
- [ ] Archiver un client baisse le compte de 1 immédiatement.
- [ ] Les clients de démonstration ne sont pas comptés.
- [ ] Un client archivé pour un autre coach n'est pas compté pour ce coach.

## SUB-26 — Limiter les clients actifs (essai : 5, puis limite du plan)
**Projet :** CE · **Dépend de :** SUB-24, SUB-25 · **Taille :** M

**À faire :**
- Aux points d'ajout (SUB-03 : acceptation d'invitation, création directe) **et** de désarchivage : si `compteActifs + 1 > maxActiveClients`, refuser.
- Réponse : HTTP 403 avec le code `CLIENT_LIMIT_REACHED` et `{ limit, current, reason: "TRIAL" | "PLAN", suggestedPlan }`. Pour `PLAN`, `suggestedPlan` vient de SUB-40.
- Pendant l'essai, `maxActiveClients` = `Plan.trialMaxClients` (5). Après paiement, c'est `Plan.toUnits`.

**Critères d'acceptation :**
- [ ] Pendant l'essai, l'ajout du 6e client actif est refusé avec `reason: "TRIAL"`.
- [ ] Désarchiver un client quand la limite est atteinte est refusé de la même façon.
- [ ] Après paiement d'un plan de 20 clients, le coach peut aller jusqu'à 20.
- [ ] Archiver un client libère immédiatement une place.

## SUB-27 — Verrouiller le branding pendant l'essai
**Projet :** CE · **Dépend de :** SUB-03, SUB-24 · **Taille :** S

**À faire :**
- Pour chaque action « branding » listée en SUB-03 : si `canUseBranding` est faux, refuser avec 403 et le code `FEATURE_LOCKED`.
- La lecture reste permise : le coach peut voir la page et ce qui est verrouillé.

**Critères d'acceptation :**
- [ ] Un coach en essai ne peut pas enregistrer de branding (403 `FEATURE_LOCKED`).
- [ ] Un coach avec un abonnement `ACTIVE` ou `PAST_DUE` le peut.
- [ ] Un coach qui avait du branding avant de passer en lecture seule garde ses données, mais ne peut plus les modifier.

## SUB-28 — Lecture seule quand le compte est bloqué
**Projet :** CE · **Dépend de :** SUB-02, SUB-24 · **Taille :** M

**À faire :**
- Créer un intercepteur (comme `ArchivedClientAccessConfig`) : si l'utilisateur est un coach et `isReadOnly` est vrai, refuser les appels `POST`, `PUT`, `PATCH`, `DELETE` avec 403 et le code `SUBSCRIPTION_READ_ONLY`.
- Exceptions autorisées : connexion, lecture de l'état d'abonnement, appels de facturation (`/api/billing/**`), changement de profil minimum si nécessaire, déconnexion.
- **Les clients du coach (rôle client) ne sont pas touchés** : ils continuent à voir leurs programmes.

**Critères d'acceptation :**
- [ ] Un coach `EXPIRED` ne peut rien créer ni modifier (403 `SUBSCRIPTION_READ_ONLY`).
- [ ] Il peut lire toutes ses données et payer.
- [ ] Les clients du coach voient encore leurs programmes et peuvent faire leurs actions normales.
- [ ] Un coach `ACTIVE`, `TRIAL` ou `PAST_DUE` n'est pas affecté.

## SUB-29 — Messages de limite et cadenas du branding
**Projet :** FR · **Dépend de :** SUB-26, SUB-27 · **Taille :** S

**À faire :**
- Quand l'API renvoie `CLIENT_LIMIT_REACHED` : fenêtre « Limite atteinte (X clients actifs). » Si `reason = TRIAL` : « Passez à un plan payant pour continuer », bouton vers l'écran de paiement. Si `reason = PLAN` : « Passez au plan Y pour Z TND », bouton vers SUB-46.
- Quand l'API renvoie `FEATURE_LOCKED` ou quand `brandingAllowed` est faux : icône cadenas et « Disponible avec un plan payant » sur les écrans de branding. La page reste visible.

**Critères d'acceptation :**
- [ ] Les deux messages s'affichent à la place d'une erreur technique.
- [ ] Les boutons mènent aux bons écrans.
- [ ] Le cadenas n'apparaît pas pour un abonnement payé.

## SUB-30 — Bandeaux et mode lecture seule
**Projet :** FR · **Dépend de :** SUB-13, SUB-28 · **Taille :** M

**À faire :**
- Bandeau en haut de l'application selon l'état : essai (jours restants, quand ≤ 7), essai terminé, paiement en retard (« payez avant le … »), compte en lecture seule avec bouton « Payer » ou « Réactiver ».
- En lecture seule : masquer ou désactiver les boutons d'ajout et de modification. Si un appel renvoie `SUBSCRIPTION_READ_ONLY`, afficher le bandeau et pas une erreur technique.

**Critères d'acceptation :**
- [ ] Chaque statut a un bandeau correct (`TRIAL`, `PAST_DUE`, `EXPIRED`, `CANCELLED`).
- [ ] En lecture seule, aucun bouton d'écriture n'est actif.
- [ ] Le bouton du bandeau mène à l'écran de paiement ou de réactivation.

## SUB-31 — Emails d'essai
**Projet :** YS · **Dépend de :** SUB-12 · **Taille :** M

**Pourquoi :** `EmailService` n'a pas de méthode pour cela (seulement `sendHtmlEmail` et des invitations).

**À faire :**
- Créer des modèles d'email : bienvenue (début d'essai), fin d'essai dans 7 jours, 3 jours, 1 jour, essai terminé (compte en lecture seule).
- Une tâche automatique les envoie. Chaque email n'est envoyé qu'une fois (champ ou table de suivi).
- Chaque email contient un lien vers l'écran de paiement.

**Critères d'acceptation :**
- [ ] Les quatre emails de rappel partent aux bons jours.
- [ ] Aucun coach ne reçoit deux fois le même email.
- [ ] Un coach qui a déjà payé ne reçoit plus de rappel d'essai.

---

# Phase 4 — Renouvellements

## SUB-32 — Créer la facture de renouvellement à l'avance
**Projet :** YS · **Dépend de :** SUB-16, SUB-06 · **Taille :** L

**Pourquoi :** Aujourd'hui, la facture est créée le jour de l'échéance dans `processNormalBilling`. Avec Flouci, le coach doit avoir le temps de payer.

**À faire :**
- Tâche automatique : pour chaque abonnement `ACTIVE` dont `currentPeriodEnd - 5 jours <= aujourd'hui` (mensuel) ou `- 15 jours` (annuel), sans facture de renouvellement pour cette période : créer une facture `UNPAID`, type `SUBSCRIPTION`, raison `RENEWAL`, `dueDate = currentPeriodEnd`.
- Montant : prix du plan **de l'abonnement à ce moment-là** + addons - coupons valides + charges en attente (`pendingExtrasCharge`, `pendingUpgradeCharge`).
- Si un changement de plan est planifié pour cette date (SUB-41, SUB-43), utiliser le nouveau plan.
- Clé d'idempotence par période (`INV_{subscriptionId}_{currentPeriodEnd}`), un seul exemplaire par période.
- Ne **pas** changer les dates ici.

**Critères d'acceptation :**
- [ ] Une facture existe 5 jours avant l'échéance (15 pour l'annuel), une seule fois même si la tâche tourne plusieurs fois.
- [ ] Le montant inclut les charges en attente et exclut les coupons expirés.
- [ ] Les dates de l'abonnement ne changent pas à la création de la facture.
- [ ] Un abonnement avec `cancelAtPeriodEnd` n'a pas de facture.

## SUB-33 — Paiement avant ou pendant la grâce : les dates ne bougent pas
**Projet :** YS · **Dépend de :** SUB-32 · **Taille :** M

**Pourquoi :** `renewSubscription` ajoute un mois à l'ancien `endDate`. Si le coach paie très en retard, plusieurs cycles de rattrapage peuvent être créés.

**À faire :**
- Quand une facture `RENEWAL` passe à `PAID` : `currentPeriodStart = ancien currentPeriodEnd`, `currentPeriodEnd` = +1 mois ou +1 an à partir de l'ancienne fin. Statut `ACTIVE`, `periodPaidAmount` = montant payé.
- Cela vaut aussi si le coach paie en avance (avant l'échéance) ou pendant la grâce (`PAST_DUE`).
- Après paiement, si le coach était `PAST_DUE` : retour `ACTIVE`.
- Supprimer l'ancienne logique de renouvellement automatique de `processNormalBilling` qui créait une facture et renouvelait le même jour.

**Critères d'acceptation :**
- [ ] Payer le 12 novembre pour une échéance du 15 novembre → nouvelle période du 15 novembre au 15 décembre.
- [ ] Payer le 18 novembre (dans la grâce) → même résultat.
- [ ] Aucune facture de rattrapage n'est créée.
- [ ] Une même confirmation reçue deux fois ne prolonge qu'une fois.

## SUB-34 — Retard, puis blocage après la grâce
**Projet :** YS · **Dépend de :** SUB-32, SUB-08 · **Taille :** M

**À faire :**
- Tâche automatique chaque nuit : abonnement `ACTIVE` dont `currentPeriodEnd <= aujourd'hui` et facture de renouvellement non payée → `PAST_DUE` (customer reste `ACTIF`), facture `OVERDUE`.
- Abonnement `PAST_DUE` dont `aujourd'hui > currentPeriodEnd + paymentGraceDays` (du plan) → `EXPIRED`, customer `INACTIF`.
- La facture ouverte reste ouverte jusqu'au paiement ou jusqu'à la réactivation (SUB-18).
- Remplacer l'ancienne logique : `handleMissedBillingCycle`, `handleUnpaidInvoicesWithRules`, `monitorGracePeriods` et `handleCancellationPolicy` (qui programme une annulation en fin de terme) doivent être supprimées ou adaptées à ces règles. Le coach ne passe jamais en `CANCELLED` à cause d'un retard : seulement en `EXPIRED`.
- Si le plan n'a pas de `paymentGraceDays` : traiter comme 0 jour de grâce.

**Critères d'acceptation :**
- [ ] Échéance le 15 novembre, grâce 7 jours : `PAST_DUE` le 15 novembre, `EXPIRED` à partir du 23 novembre.
- [ ] Pendant `PAST_DUE`, le coach a un accès complet.
- [ ] Un coach qui paie pendant `PAST_DUE` revient à `ACTIVE` sans décalage de dates.
- [ ] Les tâches ne créent aucune facture rétroactive.

## SUB-35 — Annulation de l'abonnement
**Projet :** YS, CE · **Dépend de :** SUB-08 · **Taille :** M

**À faire :**
- Endpoint `POST /api/subscriptions/{id}/cancel` : met `cancelAtPeriodEnd = true`. Aucune facture de renouvellement ne sera créée, plus de rappel.
- À `currentPeriodEnd`, une tâche automatique passe l'abonnement en `CANCELLED` (lecture seule).
- Endpoint `POST /api/subscriptions/{id}/resume` : remet `cancelAtPeriodEnd = false` tant que la période n'est pas finie.
- Pendant l'essai : annuler garde l'accès jusqu'à `trialEndsAt`, puis `EXPIRED` ou `CANCELLED`.
- Pas de remboursement automatique.
- CE `CoachBillingController` expose ces deux appels au coach.

**Critères d'acceptation :**
- [ ] Après « Annuler », le coach garde l'accès jusqu'à la fin de la période payée.
- [ ] Aucune facture de renouvellement n'est créée pour cette période.
- [ ] Il peut retirer l'annulation avant la fin de la période.
- [ ] Après la fin, le statut est `CANCELLED` et le compte est en lecture seule.

## SUB-36 — Emails de renouvellement et de retard
**Projet :** YS · **Dépend de :** SUB-31, SUB-32, SUB-34 · **Taille :** M

**À faire :**
- Modèles : facture de renouvellement créée (avec lien de paiement), rappel à 2 jours de l'échéance, rappel le jour de l'échéance, retard (grâce commencée), compte bloqué, paiement reçu, réactivation, annulation confirmée.
- Pour l'annuel : rappels à 15, 7 et 1 jour.
- Un suivi garantit un seul envoi par événement et par période.

**Critères d'acceptation :**
- [ ] Chaque événement de la liste envoie l'email correspondant, une seule fois.
- [ ] Un coach qui a payé ne reçoit plus de rappel.
- [ ] Chaque email contient un lien direct vers la facture à payer.

## SUB-37 — Page « Mon abonnement »
**Projet :** FR, CE · **Dépend de :** SUB-13, SUB-32, SUB-35 · **Taille :** L

**À faire :**
- Nouvelle page dans FR (le service `CoachBillingService` et le modèle `coach-invoice.model.ts` existent déjà) avec : plan, statut, prochaine date de paiement, liste des factures (statut, montant, bouton « Payer »), boutons « Annuler » et « Retirer l'annulation », bouton « Réactiver » en lecture seule, changement de plan (SUB-46).
- Ajouter l'entrée de menu correspondante (`sidebar-items.ts`).

**Critères d'acceptation :**
- [ ] Un coach voit son plan, sa prochaine date et ses factures.
- [ ] Il peut payer une facture ouverte depuis cette page.
- [ ] Il peut annuler et retirer l'annulation.
- [ ] Un coach en lecture seule voit le bouton « Réactiver ».

---

# Phase 5 — Changements de plan

## SUB-38 — Service de calcul du prorata
**Projet :** YS · **Dépend de :** SUB-07 · **Taille :** S

**Pourquoi :** Le calcul existe dans `calculateUpgradeCharge` mais il est mélangé à d'autres choses.

**À faire :**
- Créer un service `ProrationService` avec : `proratedDifference(oldPlan, newPlan, subscription, today)` = `(prixNouveau − prixAncien) × joursRestants ÷ totalJours` (mensuel : 30, annuel : 365, avec `joursRestants` = jours entre aujourd'hui et `currentPeriodEnd`, minimum 0).
- Arrondir à 3 décimales (millimes) ou selon la règle trouvée en SUB-01.
- Gérer `FULL_DIFFERENCE` : `prixNouveau − prixAncien`. Prorata est la valeur par défaut.

**Critères d'acceptation :**
- [ ] 30 → 50 TND, 10 jours restants sur 30 : **6,667 TND**.
- [ ] 600 → 1000 TND annuel, 100 jours restants : **109,589 TND**.
- [ ] 0 jour restant : 0 TND.
- [ ] `FULL_DIFFERENCE` renvoie 20 TND pour l'exemple mensuel.

## SUB-39 — Upgrade : le coach paie d'abord, l'accès vient après
**Projet :** YS, CE · **Dépend de :** SUB-38, SUB-10 · **Taille :** L

**Pourquoi :** `performAutomaticUpgrade` change le plan tout de suite et met la différence sur la prochaine facture. Avec Flouci, le coach utiliserait un plan plus grand sans avoir payé.

**À faire :**
- Endpoint `POST /api/subscriptions/{id}/upgrade` avec `newPlanId`. Il crée une facture de type `UPGRADE`, raison `UPGRADE`, montant = différence calculée par SUB-38 (selon `BillingRules.upgradePolicy` du plan). Une seule demande en attente à la fois.
- Le plan **ne change pas** tant que la facture n'est pas `PAID`. À la confirmation : `subscription.plan = newPlan`, `upgradeDate = aujourd'hui`, `periodPaidAmount` += montant payé. **Les dates ne changent pas.**
- La demande expire après 3 jours (à valider) : facture `VOID`, rien ne change.
- Une facture `UPGRADE` impayée ne met pas l'abonnement en `PAST_DUE` ni en lecture seule.
- CE expose l'appel au coach.

**Critères d'acceptation :**
- [ ] Sans paiement, le plan reste l'ancien.
- [ ] Après paiement, le nouveau plan est actif tout de suite, avec les mêmes dates.
- [ ] Une demande non payée expire sans effet sur le statut.
- [ ] Impossible d'ouvrir deux demandes d'upgrade en même temps.
- [ ] Un upgrade vers un plan avec `freeUpgradeMonths` encore valable est gratuit (règle existante conservée).

## SUB-40 — Dépassement de limite : proposer l'upgrade, ne jamais le faire seul
**Projet :** YS, CE · **Dépend de :** SUB-39 · **Taille :** M

**Pourquoi :** `updateSubscriptionItemCount` / `handelUpgradeNextPlan` changent le plan automatiquement.

**À faire :**
- Supprimer le changement de plan automatique dans `handelUpgradeNextPlan` et `performAutomaticUpgrade`.
- Ajouter `GET /api/subscriptions/{id}/suggested-upgrade?clients=N` : renvoie le plus petit plan, du même produit et du même cycle, dont `toUnits >= N` et dont le prix est supérieur (logique de `findNextTierPlan`), avec son prix et le montant à payer maintenant (prorata).
- Si aucun plan ne convient : renvoyer « contactez le support » (pas d'exception).
- Pour les plans en mode « extras » (`ExtraClientMode.ALLOW_AND_CHARGE`) : conserver la règle existante (le client est ajouté, et le supplément s'ajoute à la prochaine facture). Pour `BLOCK` : le coach ne peut pas ajouter le client.
- CE utilise cet appel pour remplir `suggestedPlan` dans SUB-26.

**Critères d'acceptation :**
- [ ] Aucun plan ne change sans paiement et sans clic du coach.
- [ ] La suggestion renvoie le bon plan, le bon prix et le montant du prorata.
- [ ] S'il n'y a pas de plan plus grand, la réponse l'indique clairement.
- [ ] Les plans en mode extras gardent leur comportement actuel.

## SUB-41 — Downgrade au prochain renouvellement
**Projet :** YS, CE · **Dépend de :** SUB-33 · **Taille :** M

**À faire :**
- Endpoint `POST /api/subscriptions/{id}/downgrade` avec `newPlanId`. Il enregistre `pendingPlanId` et `pendingPlanEffectiveDate = currentPeriodEnd`.
- Refuser si le nombre de clients actifs est supérieur à `toUnits` du nouveau plan (code `PLAN_TOO_SMALL`, avec le nombre de clients à archiver).
- À la création de la facture de renouvellement (SUB-32) : utiliser le nouveau plan. Au paiement (SUB-33) : `subscription.plan = pendingPlan` et remise à zéro de `pendingPlanId`.
- Le coach peut annuler la demande avant la date d'effet.
- Pas de remboursement.
- Garder la proposition existante (`eligibleForDowngrade`, `daysBelowDowngradeThreshold`) : elle **propose** seulement, le coach confirme.

**Critères d'acceptation :**
- [ ] Le plan change à la date du renouvellement, pas avant.
- [ ] Une demande avec trop de clients actifs est refusée.
- [ ] Le coach peut annuler la demande avant la date d'effet.
- [ ] La facture de renouvellement utilise le prix du nouveau plan.

## SUB-42 — Mensuel vers annuel, avec crédit
**Projet :** YS, CE · **Dépend de :** SUB-38, SUB-39 · **Taille :** M

**À faire :**
- Endpoint `POST /api/subscriptions/{id}/switch-to-yearly` avec `newPlanId` (un plan annuel, du même niveau ou plus grand).
- Montant de la facture : `prix du plan annuel − periodPaidAmount` (montant réellement payé pour la période en cours, coupons inclus), minimum 0.
- À la confirmation : `plan = nouveau plan`, `currentPeriodStart` ne change pas, `currentPeriodEnd = currentPeriodStart + 1 an`, `periodPaidAmount` = montant total payé pour l'année (ancien + nouveau).
- Autorisé seulement pour un abonnement `ACTIVE`.

**Critères d'acceptation :**
- [ ] 50 TND payés pour le mois + plan annuel à 300 TND → facture de **250 TND**.
- [ ] L'année commence au début du mois en cours (pas au jour du changement).
- [ ] Le montant est le même que le coach change le 2 ou le 28 du mois.
- [ ] Si le coach avait payé 40 TND grâce à un coupon, la facture est de 260 TND.
- [ ] Un changement vers un plan annuel de niveau supérieur suit la même règle.

## SUB-43 — Annuel vers mensuel en fin d'année
**Projet :** YS, CE · **Dépend de :** SUB-41 · **Taille :** S

**À faire :**
- Même mécanique que le downgrade (SUB-41) : la demande est enregistrée avec `pendingPlanId` (un plan mensuel) et prend effet à `currentPeriodEnd`.
- Pas de remboursement, pas de calcul de crédit.
- Vérifier que les clients actifs rentrent dans le plan mensuel.

**Critères d'acceptation :**
- [ ] Le plan mensuel commence au renouvellement annuel, pas avant.
- [ ] La facture de renouvellement est au prix mensuel.
- [ ] Le coach peut annuler la demande avant la fin de l'année.

## SUB-44 — Règles de protection des changements de plan
**Projet :** YS · **Dépend de :** SUB-39, SUB-41 · **Taille :** S

**À faire :**
- Interdire upgrade, downgrade et changement de cycle si le statut est `PAST_DUE`, `EXPIRED`, `CANCELLED` ou `PENDING`. Message : « Payez ou réactivez d'abord » (code `PAY_FIRST`).
- Une seule demande de changement en attente à la fois (upgrade ou downgrade). Une nouvelle demande remplace l'ancienne, sauf si une facture d'upgrade est déjà ouverte.
- Autoriser un plan dont le minimum (`fromUnits`) est supérieur au nombre de clients. Le choix reste possible, et l'écran propose un plan plus petit.

**Critères d'acceptation :**
- [ ] Un coach `PAST_DUE` ne peut pas changer de plan et reçoit `PAY_FIRST`.
- [ ] Il n'y a jamais deux changements de plan en attente.
- [ ] Un plan trop grand pour le nombre de clients est autorisé avec un message de suggestion.

## SUB-45 — Prix conservé, plan archivé, codes promo
**Projet :** YS · **Dépend de :** SUB-07 · **Taille :** M

**À faire :**
- Le prix d'une période est déterminé à la création de la facture de renouvellement avec le prix du plan **à ce moment-là**. Un changement de prix par un administrateur n'a donc d'effet que sur les nouvelles factures. Vérifier qu'une facture déjà créée garde son montant (`planSnapshot` et `baseAmount` existent déjà).
- Un plan archivé ou désactivé reste utilisé par les abonnements actuels jusqu'à leur renouvellement. Puis le coach doit choisir un autre plan : au renouvellement, créer la facture au prix du plan archivé jusqu'à la fin de la période, puis demander un choix. Décision à écrire dans le ticket avec le product owner.
- Coupon : après un changement de plan, un coupon reste appliqué seulement si `isCouponActive` est vrai pour le nouveau plan. Sinon il est retiré avec un message.

**Critères d'acceptation :**
- [ ] Changer le prix d'un plan ne modifie aucune facture existante.
- [ ] Les abonnés gardent l'ancien prix jusqu'à leur prochaine facture de renouvellement.
- [ ] Un coupon non valable pour le nouveau plan n'est pas appliqué.

## SUB-46 — Écran de changement de plan
**Projet :** FR · **Dépend de :** SUB-39, SUB-40, SUB-41, SUB-42, SUB-43 · **Taille :** L

**À faire :**
- Dans « Mon abonnement » (SUB-37) : bouton « Changer de plan ». Afficher le plan actuel, les autres plans (mensuel et annuel), et pour chacun le calcul : « Vous payez X TND maintenant, effet immédiat » (upgrade), « Effet au renouvellement du JJ/MM, pas de remboursement » (downgrade), « Vous payez X TND, votre année commence le JJ/MM » (mensuel vers annuel).
- Confirmer, puis payer pour les cas qui demandent un paiement.
- Afficher la demande en attente (avec un bouton pour l'annuler).
- Pour le message de limite dépassée (SUB-29) : même écran avec le plan suggéré présélectionné.

**Critères d'acceptation :**
- [ ] Les quatre cas (upgrade, downgrade, mensuel vers annuel, annuel vers mensuel) sont possibles depuis l'écran.
- [ ] Le prix et la date d'effet affichés sont ceux calculés par le serveur.
- [ ] Le coach doit confirmer avant tout paiement.
- [ ] Une demande en attente est visible et annulable.

---

# Phase 6 — Administration et cas particuliers

L'interface d'administration du CRM `yo-sales` n'est pas dans ces dépôts. Si elle existe séparément, créer un ticket de suivi pour chaque endpoint ci-dessous.

## SUB-47 — Paiement manuel par l'administrateur
**Projet :** YS · **Dépend de :** SUB-16 · **Taille :** M

**À faire :**
- Endpoint réservé aux administrateurs : `POST /api/invoices/{id}/manual-payment` avec méthode (`BANK_TRANSFER`, `CASH`), référence et date.
- Il crée un `Payment` `SUCCESS` avec cette méthode et passe la facture à `PAID` par le même chemin que SUB-10 (même effet sur l'abonnement).
- Journaliser l'administrateur qui a fait l'action.

**Critères d'acceptation :**
- [ ] Un paiement manuel active l'abonnement de la même façon qu'un paiement Flouci.
- [ ] Un coach ne peut pas appeler cet endpoint.
- [ ] L'événement indique qui l'a enregistré.

## SUB-48 — Prolongation d'essai par l'administrateur
**Projet :** YS · **Dépend de :** SUB-12 · **Taille :** S

**À faire :**
- Endpoint réservé aux administrateurs : `POST /api/subscriptions/{id}/extend-trial` avec un nombre de jours.
- Il décale `trialEndsAt`. Si le coach était `EXPIRED` à cause de l'essai, il repasse `TRIAL` et son compte redevient `ACTIF`.
- Journaliser l'action.

**Critères d'acceptation :**
- [ ] Un essai prolongé de 7 jours se termine 7 jours plus tard.
- [ ] Un coach bloqué à cause de l'essai retrouve l'accès.
- [ ] Un coach qui a déjà payé n'est pas concerné (refus).

## SUB-49 — Code promo à 100 %
**Projet :** YS · **Dépend de :** SUB-16 · **Taille :** S

**À faire :**
- Si le total de la facture de premier paiement est 0 : ne pas passer par Flouci. Marquer la facture `PAID` tout de suite et activer l'abonnement comme au SUB-16.
- Le renouvellement suivant suit les règles normales (le coupon s'applique tant qu'il est valable).

**Critères d'acceptation :**
- [ ] Un code à 100 % active l'abonnement sans appel à Flouci.
- [ ] Le journal indique « payé par coupon ».

## SUB-50 — Remboursement et litige
**Projet :** YS · **Dépend de :** SUB-19 · **Taille :** M

**À faire :**
- Endpoint administrateur « marquer remboursé » : le `Payment` passe `REFUNDED`. La facture passe `VOID` ou reste payée selon un choix écrit dans le ticket. L'administrateur décide en même temps si l'abonnement reste actif ou passe en `EXPIRED`.
- Un litige ouvert met l'abonnement en lecture seule (`EXPIRED`) jusqu'à décision.
- Journaliser.

**Critères d'acceptation :**
- [ ] Un remboursement est visible dans les paiements et le journal.
- [ ] L'administrateur peut garder ou bloquer l'abonnement.
- [ ] Un double paiement marqué « à rembourser » (SUB-19) peut être clôturé par cet endpoint.

## SUB-51 — Journal des événements d'abonnement
**Projet :** YS · **Dépend de :** SUB-08 · **Taille :** M

**Pourquoi :** `InvoiceEvent` et `InvoiceAuditService` existent pour les factures, mais rien pour les abonnements.

**À faire :**
- Créer `SubscriptionEvent` (abonnement, type, date, origine : système, coach, admin, ancien et nouveau statut, ancien et nouveau plan, détail).
- L'écrire à chaque transition de `SubscriptionLifecycleService` et à chaque changement de plan ou de période.
- Endpoint de lecture pour le support.

**Critères d'acceptation :**
- [ ] Chaque transition de statut crée un événement.
- [ ] Le support peut lire l'historique d'un abonnement dans l'ordre.
- [ ] Un événement indique l'origine (système, coach, admin).

## SUB-52 — Réconciliation des paiements
**Projet :** YS, PAY · **Dépend de :** SUB-10 · **Taille :** M

**À faire :**
- Tâche automatique : pour les `Payment` en `PENDING` depuis plus de 15 minutes, interroger PAY / Flouci sur leur état réel et appliquer le résultat (comme une confirmation).
- Arrêter après 7 jours : `Payment` en `EXPIRED`, facture inchangée.

**Critères d'acceptation :**
- [ ] Une confirmation perdue est rattrapée automatiquement en moins d'une heure.
- [ ] Un paiement réellement refusé passe à `FAILED`.
- [ ] La tâche peut tourner plusieurs fois sans doublon.

## SUB-53 — Vitrine
**Projet :** WEB · **Dépend de :** SUB-09 · **Taille :** S

**À faire :**
- Sur la carte de chaque plan avec essai (`pricing.component.ts`) : afficher « 30 jours gratuits, jusqu'à 5 clients » à partir de `trialMaxClients`.
- Indiquer ce qui est verrouillé pendant l'essai (branding).
- Vérifier que les textes « No credit card » et « Cancel anytime » (`hero.component.ts`, `final-cta`, `payment-info`, `cgv`, `terms`) sont exacts avec les règles. Corriger au besoin, en particulier « Cancel anytime » (annulation = fin de période payée, sans remboursement).

**Critères d'acceptation :**
- [ ] La limite de l'essai vient de l'API, pas d'un texte écrit à la main.
- [ ] Les conditions (CGV, termes) décrivent les règles réelles.

---

# Phase 7 — Qualité et préparation de Stripe

## SUB-54 — Isoler le paiement derrière une interface
**Projet :** YS, CE · **Dépend de :** SUB-16, SUB-39 · **Taille :** M

**Pourquoi :** Stripe arrivera avec carte enregistrée et prélèvement automatique. Les règles de dates, statuts et plans ne doivent pas changer.

**À faire :**
- Créer une interface `PaymentCollector` avec : `requestPayment(invoice)` (renvoie un lien ou lance un prélèvement). Implémentation actuelle : `FlouciPaymentCollector` (utilise `payInvoice`).
- Lire la méthode depuis `Subscription.paymentGateway`.
- Aucun code de règle (dates, statut, plan) ne doit mentionner Flouci.
- Documenter ce que Stripe devra ajouter : choix de la méthode selon le pays, carte enregistrée, prélèvement à l'échéance, relances de prélèvement échoué.

**Critères d'acceptation :**
- [ ] Une recherche de « FLOUCI » dans les services de règles (cycle de vie, facturation, changement de plan) ne trouve rien.
- [ ] Une fausse implémentation de test d'une 2e méthode fonctionne sans changer le reste.

## SUB-55 — Tests de bout en bout des scénarios
**Projet :** YS, CE, FR · **Dépend de :** toutes les phases · **Taille :** L

**À faire :** écrire un test automatique (ou un scénario de test guidé si le test automatique est impossible) pour chaque ligne :
- Essai puis paiement le jour 15 → abonnement du jour 15 au mois suivant.
- Essai qui se termine sans paiement → lecture seule le premier jour sans accès.
- Retour 3 mois plus tard → réactivation sans facturer l'absence.
- Essai : 5 clients actifs, le 6e est refusé ; archiver en libère un.
- Branding verrouillé en essai, libre après paiement.
- Renouvellement : facture 5 jours avant (15 pour l'annuel), paiement en avance, pendant la grâce, après la grâce.
- Upgrade avec prorata (mensuel et annuel), payé avant l'accès, demande qui expire.
- Dépassement de limite → proposition d'upgrade, jamais de changement seul.
- Downgrade au renouvellement, refusé s'il y a trop de clients actifs.
- Mensuel vers annuel (50 payé + annuel 300 = 250), annuel vers mensuel en fin d'année.
- Annulation : accès jusqu'à la fin, plus de facture, retrait de l'annulation.
- Double paiement, paiement refusé, page fermée avant retour.
- Paiement manuel admin, prolongation d'essai, code promo à 100 %.
- Un second essai pour le même email est refusé.

**Critères d'acceptation :**
- [ ] Chaque ligne a un test qui passe.
- [ ] Les tests utilisent une horloge de test (pas la date réelle).

## SUB-56 — Guide du support et recette
**Projet :** tous · **Dépend de :** SUB-55 · **Taille :** S

**À faire :**
- Écrire un guide court : chaque statut, ce que voit le coach, ce que l'équipe peut faire (paiement manuel, prolongation d'essai, remboursement, lire le journal).
- Faire une recette avec 3 coachs de test (essai, abonné mensuel, abonné annuel).
- Écrire la procédure de retour arrière de la migration SUB-07.

**Critères d'acceptation :**
- [ ] Le support peut répondre à « pourquoi mon compte est en lecture seule ? » avec le guide seulement.
- [ ] La recette est faite et ses résultats sont écrits.

---

## Points encore ouverts (à décider pendant la phase 0)

- Durée avant l'expiration d'une demande d'upgrade non payée (proposé : 3 jours).
- Politique si YS ne répond pas à CE (proposé : ne pas bloquer, journaliser).
- Sort des plans archivés (SUB-45).
- Où se trouve l'interface d'administration du CRM `yo-sales`.

## Hors périmètre pour l'instant

- Stripe (carte enregistrée, prélèvement automatique).
- Détection du pays par adresse IP pour choisir la méthode de paiement.
