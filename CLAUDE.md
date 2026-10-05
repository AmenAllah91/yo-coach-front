# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Contexte

Chantier en cours : abonnements, essai gratuit et paiement Flouci, décrit dans `../backlog-abonnements.md` (tickets SUB-xx, règles validées, statuts). Le lire avant de toucher aux abonnements, factures ou paiements. On avance ticket par ticket, en commençant par SUB-01 (phase 0 : vérifications, sans changement de code).
Les 4 projets liés : YS `yo-sales` (source de vérité), CE `coach-empire` (backend coach), FR `yo-coach-front`, WEB `../yocoach-website`. Un changement de flux touche souvent plusieurs dépôts : les nommer explicitement. Dates de coupure en `Africa/Tunis`, montants en TND, tâches idempotentes, jamais de suppression de données de coach.

## Commandes

```bash
npm install
npm start            # ng serve avec --max-old-space-size=4096 (obligatoire)
npm run build
npm run lint
npm test
ng test --include=**/nom.spec.ts
node --test tests/food-validation.test.cjs   # tests Node dans tests/*.test.cjs, hors Karma
```

## Architecture

- Angular 17, mélange NgModule (`app.module.ts`, `app-routing.module.ts`) et standalone (`app.config.ts`, `app.routes.ts`) : vérifier lequel porte la route avant d ajouter un composant. UI en français/anglais (`language.service.ts`).
- `src/app/service/` : un service HTTP par domaine (clients, nutrition, programmes, `coach-billing.service.ts`, `subscriptions.service.ts`, `subscription-onboarding.service.ts`, chat/websocket…). `src/app/components/` : composants par fonctionnalité.
- `src/environments/` : `environment.ts` (dev, CE sur :8080, notifications :8086), `.integration.ts`, `.development.ts`, `environnement.local.ts` (orthographe réelle). Configurations de build : production, development, integration, local. `proxy.conf.json` : `/api` → `localhost:8080`, `/auth` → Keycloak d intégration.
- Auth Keycloak (`src/keycloak.json`). Branche de travail : `integration`. CI : Jenkinsfile (+ `Jenkinsfiledev`), image `kamdigisdocker/yo-coach-front`.
