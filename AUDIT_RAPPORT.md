# 📋 Rapport d'Audit Complet — DCLIC Monitoring App (`DclicApp`)

**Date de l'audit :** Septembre 2026  
**Périmètre :** `DclicApp/backend` & `DclicApp/frontend`  
**Cible :** Application de monitoring pédagogique et de suivi de cohorte (Moodle / Supabase / React)

---

## Executive Summary (Synthèse Globale)

L'application **DCLIC Monitoring** est un outil à fort potentiel, conçu pour suivre la progression pédagogique d'une cohorte d'apprenants, détecter le décrochage scolaire, analyser les complétions d'activités et générer des rapports de suivi.

Elle repose sur une architecture moderne :
- **Backend :** Node.js / Express / TypeScript avec connecteur Supabase (PostgreSQL).
- **Frontend :** React 19 / Vite / Tailwind CSS v4 / Recharts / Radix UI / Lucide Icons.

### Score Global de Santé du Code : **68 / 100**

| Catégorie | Note | Synthèse |
|---|:---:|---|
| **Fiabilité & Intégrité des Données** | `55 / 100` | Plusieurs bugs critiques de parsing et d'ingestion de données faussent les calculs de dates et risquent de bloquer l'application. |
| **Architecture & Configuration** | `70 / 100` | Bonne base TypeScript/Express/React, mais fort couplage avec des données en dur (*hardcoded*) et résidus de prototypage. |
| **Propreté du Code (Dette technique)** | `65 / 100` | ~1.5 Mo de données mortes en dépôt, scripts scratch oubliés, 18 avertissements de linter, variables orphelines. |
| **Fonctionnalités Métier** | `72 / 100` | Calculs de cohortes pertinents (règle des 93.5% Phase 1, décrochage), mais fonctionnalités inachevées (centre d'alertes inerte, communications orphelines). |
| **Design, UI & Expérience Utilisateur** | `78 / 100` | Belle base graphique inspirée de Shadcn/UI, mais incohérence de tokens Tailwind v4 (couleurs `success`/`warning` invisibles) et absence de Dark Mode interactif. |

---

## 1. 🚨 Bugs Critiques & Dysfonctionnements Techniques

### 1.1. Bug Critique de Parsing des Dates en Français (`moodleParser.ts:168`)
> **Gravité : CRITIQUE — Toutes les activités validées en août sont faussement rétrogradées à janvier !**

Dans `backend/src/services/parser/moodleParser.ts` (ligne 168) :
```typescript
const cleanMonth = month.toLowerCase().replace('', 'u'); // basic fix for août/aot
const mIndex = months[cleanMonth] || 0;
```
* **Problème :** En JavaScript, `.replace('', 'u')` remplace le premier caractère vide au début de la chaîne. Par conséquent, `'août'` devient `'uaoût'`.
* **Conséquence :** `months['uaoût']` renvoie `undefined`. L'opérateur de repli `|| 0` affecte alors l'index `0` (`janvier`) ! Toutes les validations effectuées en **août 2026** sont enregistrées en **janvier 2026**, faussant complètement les rapports hebdomadaires et l'historique d'activité par jour de l'apprenant.
* **Correction recommandée :**
```typescript
const cleanMonth = month.toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // supprime les accents (août -> aout)
  .replace(/[^a-z]/g, '');
```

---

### 1.2. Purge Incomplète des Données : Omission de la Table `progress` (`store.ts:609`)
> **Gravité : ÉLEVÉE — Risque de corruption de données ou d'erreurs d'intégrité référentielle.**

Dans `backend/src/services/store.ts` (lignes 609-615) :
```typescript
async clearAllData(): Promise<void> {
  await supabase.from('learners').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('activities').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('uploads').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('reports').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('alerts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}
```
* **Problème :** La table `progress` (qui contient pourtant le plus gros volume d'enregistrements) **n'est pas purgée**.
* **Preuve de l'oubli :** Dans le script scratch `backend/clear_db.ts` (ligne 5), le développeur avait expressément inclus `supabase.from('progress').delete()`, mais a oublié de le reporter dans la méthode officielle du store.
* **Conséquence :** Si un utilisateur clique sur "Reset Données" dans l'application, les apprenants et activités sont effacés mais les progrès restent dans Supabase (orphelins), faussant les futurs calculs.

---

### 1.3. Blocage si le CSV est Importé Avant les Participants (`uploadService.ts:110-145` & `store.ts:65`)
> **Gravité : ÉLEVÉE — Tableau de bord complètement vide (0 apprenants affichés).**

* Dans `uploadService.ts` : Si aucun participant n'est encore enregistré avec le groupe `G1_MN_072026`, le service importe temporairement les apprenants du CSV avec `group_id: 'UNKNOWN'`.
* Dans `store.ts` :
  ```typescript
  async getLearners(): Promise<Learner[]> {
    const { data } = await supabase
      .from('learners')
      .select('*')
      .eq('group_id', 'G1_MN_072026');
    return data as Learner[] || [];
  }
  ```
* **Conséquence :** Si un utilisateur dépose d'abord le fichier de progression `progress.csv`, les apprenants sont bien insérés dans la base avec `UNKNOWN`, mais `getLearners()` ne retourne **rien du tout** (`[]`). L'application affiche alors "0 apprenants" sur le Dashboard.

---

### 1.4. Plantage de l'Upload en cas d'absence du Bucket Supabase Storage (`uploadService.ts:37`)
> **Gravité : MOYENNE — Échec silencieux de tout l'import de fichier.**

Dans `uploadService.ts` :
```typescript
await supabase.storage.from('uploads').upload(storagePath, fileContent);
```
Cet appel n'est entouré d'aucun `try/catch` dédié. Si le bucket Supabase `uploads` n'a pas été créé au préalable avec les bons droits RLS, l'appel lève une exception non gérée, bascule le statut de l'upload en `error`, et abandonne tout le traitement sans importer les données.

---

### 1.5. Incohérence Typage / Base de Données sur les Alertes (`types.ts:106` vs `store.ts:583`)
* Dans `backend/src/types.ts` : L'interface `Alert` définit `acknowledged: boolean`.
* Dans `backend/src/services/store.ts` : Le store filtre avec `.eq('status', 'new')` et met à jour `{ status: 'acknowledged' }`.
* **Conséquence :** Discordance complète entre le schéma TypeScript et la structure attendue en base SQL.

---

### 1.6. Configuration ESM / CJS du Backend (`backend/package.json`)
Dans `backend/package.json`, `"type": "module"` est absent.
Lors de l'exécution avec Node natif (`node dist/index.js`), Node affiche un avertissement de performance :
```
[MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type is not specified and it doesn't parse as CommonJS. Reparsing as ES module because module syntax was detected.
```
Il suffit d'ajouter `"type": "module"` dans `backend/package.json` pour aligner TypeScript (`"module": "ESNext"`) et le runtime Node.

---

### 1.7. Rechargement Brutal de la Page dans `UploadPage.tsx:198`
Dans `frontend/src/components/upload/UploadPage.tsx` :
```tsx
<Button onClick={() => window.location.href = '/'} variant="default">
  Aller au Dashboard
</Button>
```
Dans une Single Page Application React utilisant un état de navigation interne (`App.tsx`), faire un `window.location.href = '/'` recharge violemment tout le bundle JavaScript dans le navigateur au lieu d'utiliser `onNavigate('dashboard')`.

---

## 2. 🧩 Incohérences Métier & Limitations d'Architecture

### 2.1. Données et Périodes Codées "En Dur" (*Hardcoded*)
L'application a été programmée avec de nombreuses constantes figées pour une seule cohorte spécifique :
1. **Identifiant de groupe figé :** `TARGET_GROUP = 'G1_MN_072026'` répété dans `uploadService.ts`, `store.ts`, `moodleParser.ts`. Impossible de suivre un Groupe G2 ou une nouvelle session sans modifier le code source.
2. **Calendrier figé dans le composant Dashboard :** `Dashboard.tsx` définit en dur les dates des Séquences (27 juil - 3 août, etc.) et l'ouverture du Projet Pro au 14 Septembre 2026.
3. **Condition temporelle sur les Top Performers :** Dans `store.ts` :
   ```typescript
   const PROJET_PRO_START = new Date(2026, 8, 14);
   const isBeforeProjetPro = now < PROJET_PRO_START;
   ```
   Si la date du projet pro est décalée ou pour toute autre session, cette règle masquera automatiquement les apprenants à 93.5% du classement.
4. **Header statique :** Dans `Layout.tsx`, le badge affiche en dur `27 Jul — 25 Sep 2026`.

---

### 2.2. Incohérence des Statuts d'Apprenants
* Dans `backend/src/types.ts` et la base, les statuts valides d'un apprenant sont :  
  `'active' | 'inactive' | 'dropped' | 'completed_phase1' | 'completed'`.
* Sur le frontend (`LearnersList.tsx`), deux filtres supplémentaires sont proposés : `bloqués` et `en risque`.  
  Ce sont des statuts calculés (apprenants ayant un module échoué ou >7j d'inactivité) et non des statuts persistés. Le backend les intercepte via une sur-couche dans `/learners`, créant une confusion entre état physique et filtre analytique.
* **Oubli dans la fiche apprenant :** Dans `LearnerDetail.tsx`, seuls `active`, `inactive` et `dropped` sont stylisés avec des Badges. Les apprenants ayant terminé (`completed_phase1` ou `completed`) n'ont aucun badge affiché !

---

### 2.3. Gestion Fragile des Rapports Personnalisés (`Reports.tsx:93`)
Dans `frontend/src/pages/Reports.tsx` :
```typescript
const currentReport = (isCustomMode && customReport) ? customReport : (reports[currentIndex] || reports[0]);
```
Lorsque l'utilisateur bascule en mode "Période personnalisée", tant qu'il n'a pas cliqué sur "Générer", `currentReport` affiche le rapport hebdomadaire courant au lieu d'inviter l'utilisateur à choisir ses dates et générer les données. De plus, si l'historique est vide, l'accès à `currentReport.total_validations` lève une erreur `TypeError: Cannot read properties of undefined`.

---

## 3. 🗑️ Code en Trop, Fichiers Résiduels & Bloat (Dette Technique)

### 3.1. Fichiers Résiduels Inutilisés dans le Dépôt
Plusieurs fichiers temporaires ou obsolètes polluent le projet :

| Fichier | Taille | Utilité / Statut | Action recommandée |
|---|:---:|---|---|
| `backend/data.json` | **1.49 Mo** | Ancien dump de données de test au format JSON utilisé avant la migration Supabase. Totalement orphelin (aucune référence dans le code). | **Supprimer** |
| `backend/check_csv.js` | 789 B | Script de scratch Node.js pour inspecter les en-têtes d'un fichier local. | **Supprimer** ou archiver |
| `backend/clear_db.ts` | 387 B | Script d'urgence pour vider Supabase, rendu inutile par l'endpoint `/api/reset`. | **Supprimer** |
| `backend/test.csv` | 24 B | Fichier de test vide. | **Supprimer** |
| `backend/dummy.xlsx` | 16 Ko | Fichier Excel de test. | **Supprimer** |

---

### 3.2. Avertissements Linter (`oxlint`) & Code Mort
L'analyse statique révèle **18 avertissements** :

1. **Imports inutilisés :**
   - `Dashboard.tsx` : `Clock`, `Area`, `AreaChart`
   - `LearnersList.tsx` : `Eye`, `MessageSquare`
   - `Reports.tsx` : `Cell`, `TrendingDown`
2. **Variables déclarées et jamais lues :**
   - `Dashboard.tsx` : `BAR_GRADIENT = ['#db2777', ...]`
   - `LearnersList.tsx` : `isCompleted = status === ...`
   - `Reports.tsx` : `COLORS = [...]`, `weekOptions = [...]`
   - `LearnerDetail.tsx` : variable déstructurée `y` dans `const [y, m, d] = v.split('-')`
3. **Paramètres passés mais ignorés dans le DOM :**
   - `LearnersList.tsx:317` : Le composant `FilterButton` reçoit la prop `color="success"` / `color="warning"` / `color="destructive"`, mais la variable n'est jamais injectée dans les classes CSS du bouton !
4. **Dépendances de Hooks manquantes (`react-hooks/exhaustive-deps`) :**
   - `UploadPage.tsx` : `uploadFile` omis dans les dépendances de `handleDrop` et `handleFileSelect`.
   - `LearnersList.tsx` : `loadLearners` omis dans les dépendances du `useEffect`.

---

## 4. 🎨 Audit Design, UI & Ergonomie (Aesthetics & UX)

### 4.1. Classes CSS Inexistantes / Non Compilées (Tailwind CSS v4)
* **Classes de statut fantômes :**
  Dans `frontend/src/index.css`, la directive `@theme` définit les variables de couleur :
  `--color-primary`, `--color-destructive`, `--color-muted`, etc.
  Cependant, **`--color-success` et `--color-warning` n'y sont PAS définies** !
  Pourtant, le code utilise partout : `text-success`, `bg-success`, `text-warning`, `border-warning/20`, `bg-warning/5`.
  En Tailwind v4, ces classes ne correspondent à aucune règle CSS valide : elles sont silencieusement ignorées par le navigateur et s'affichent en couleur de texte par défaut !
* **Interpolation dynamique de classes CSS non supportée :**
  Dans `UploadPage.tsx` :
  ```tsx
  <div className={cn('p-2 rounded-lg', `bg-${color}/10`)}>
    <Icon size={18} className={`text-${color}`} />
  </div>
  ```
  Le compilateur Tailwind ne peut pas deviner les classes dynamiques construites par template literals (`bg-${color}/10`). Les icônes de la section "Formats supportés" s'affichent sans fond coloré.

---

### 4.2. Incohérences dans la Palette et les Composants
1. **Mélange de conventions :**
   `LearnerDetail.tsx` utilise des classes brutes Tailwind `text-slate-900`, `text-slate-500`, `bg-slate-100`, `bg-rose-500` au lieu des tokens sémantiques de l'application (`text-foreground`, `text-muted-foreground`, `bg-muted`, `text-destructive`).
2. **Cloche d'Alertes non interactive :**
   Dans le Header (`Layout.tsx`), la cloche de notification est un simple bouton sans menu déroulant (`dropdown`), sans modale et sans interaction possible, malgré un modèle d'alertes existant côté serveur.
3. **Dialogue de confirmation navigateur désuet :**
   `UploadPage.tsx` utilise `window.confirm()` pour réinitialiser la base ou vider l'historique. Une modale interactive (`AlertDialog`) avec un design soigné serait bien plus professionnelle et sécurisante.

---

### 4.3. Manques Ergonomiques sur les Pages Clés
1. **Dashboard :**
   - Le graphique en anneau (PieChart) des statuts affiche des libellés mais n'offre aucun filtre au clic (ex: cliquer sur "Décrocheurs" pour filtrer directement la table).
   - Les cartes KPI n'indiquent pas la comparaison hebdomadaire (sauf taux de complétion).
2. **Liste des Apprenants (`LearnersList.tsx`) :**
   - **Absence de pagination :** Les 115 apprenants sont rendus d'un coup dans le DOM. À mesure que les cohortes s'agrandissent, cela dégrade les performances de rendu.
   - **Absence d'export :** Impossible d'exporter la liste filtrée au format CSV ou Excel pour le tuteur.
3. **Fiche Apprenant (`LearnerDetail.tsx`) :**
   - Tous les accordéons de séquences sont fermés par défaut (`isOpen = false`). Pour un apprenant ayant validé 40 activités, le tuteur doit cliquer une à une sur chaque séquence pour vérifier ses travaux.
   - Aucune action rapide disponible : bouton d'envoi d'email, lien WhatsApp direct (`wa.me/...`), ou bouton de consignation de note.
4. **Rapports Hebdomadaires (`Reports.tsx`) :**
   - Le tableau des **Top Apprenants de la semaine** est calculé et exporté dans le fichier Markdown, mais il est **totalement absent de l'affichage à l'écran** !

---

## 5. 💡 Améliorations Fonctionnelles & Valeur Métier

### 5.1. Gestion Dynamique des Cohortes & Sessions
Actuellement, l'application est mono-cohorte et mono-groupe (`G1_MN_072026`).
* **Évolution conseillée :**
  - Ajouter un sélecteur de cohorte dans le Header (ex: `G1 — Marketing Numérique Juil 2026`, `G2 — DCLIC Août 2026`).
  - Stocker la liste des sessions/cohortes dans Supabase et déduire dynamiquement les dates limites de séquences associées.

---

### 5.2. Activations des Modules Fantômes (Communications & Alertes)
Le backend dispose déjà de routes complètes pour la gestion des communications :
- `POST /api/communications`
- `GET /api/communications?learner_id=...`
- `GET /api/alerts`
- `POST /api/alerts/:id/acknowledge`

**Opportunité :**
- Connecter le panneau de notifications de la cloche aux alertes Supabase (inactivité > 7 jours, note bloquante non atteinte).
- Ajouter un onglet "Historique des échanges" dans la fiche apprenant pour enregistrer les relances WhatsApp, emails et appels téléphoniques.

---

### 5.3. Générateur de Rapports IA & Export Multi-Formats (Word / PDF)
Le projet compagnon `DclicAssistant` contient des rapports hebdomadaires complets au format `.md` et `.doc` (Word), rédigés avec un haut niveau de détail pédagogique et organisationnel.
* **Opportunité :**
  - Intégrer directement dans la page `Reports` un bouton "Générer la synthèse par IA" (connectable à une API Claude/Gemini ou au script existant).
  - Proposer l'export en `.docx` ou `.pdf` prêt à être envoyé à la coordination du programme DCLIC.

---

## 6. 🗺️ Plan d'Action Recommandé

### Phase 1 : Correctifs Immédiats (Hotfixes Critiques)
1. **Corriger le parser de dates** dans `moodleParser.ts` (normalisation sans accent au lieu de `.replace('', 'u')`).
2. **Ajouter `supabase.from('progress').delete()`** dans `store.ts:clearAllData()`.
3. **Remplacer `window.location.href`** par la navigation interne dans `UploadPage.tsx`.
4. **Définir les tokens Tailwind v4** `--color-success: #10b981` et `--color-warning: #f59e0b` dans `index.css`.
5. **Ajouter `"type": "module"`** dans `backend/package.json`.

### Phase 2 : Nettoyage & Résorption de la Dette
1. **Supprimer les fichiers résiduels** : `backend/data.json` (1.49 Mo), `backend/check_csv.js`, `backend/clear_db.ts`, `backend/test.csv`, `backend/dummy.xlsx`.
2. **Résoudre les 18 avertissements de linter** (oxlint) : supprimer les imports et variables morts, sécuriser les `useCallback`/`useEffect`.
3. **Harmoniser les classes de composants** : remplacer les `slate-*` de `LearnerDetail.tsx` par les tokens design system.

### Phase 3 : Améliorations Fonctionnelles & Ergonomie Immédiate
1. **Afficher les Top Apprenants de la semaine** dans la page `Reports.tsx` (actuellement calculés mais invisibles dans l'UI).
2. **Ouvrir par défaut la séquence en cours** dans `LearnerDetail.tsx` au lieu de masquer toutes les activités.
3. **Ajouter l'export CSV / Excel** de la liste des apprenants.
4. **Raccorder le centre de notifications** dans le Header pour afficher les alertes de décrochage en un clic.

### Phase 4 : Évolutions Stratégiques
1. **Support multi-cohortes / multi-groupes** sans configuration en dur.
2. **Génération automatisée des rapports hebdomadaires** avec export DOCX / PDF.
3. **Carnet de bord du tuteur** (historique des relances WhatsApp et notes pédagogiques).
