# AUDIT COMPLET — Proot ! (ProutApp) — 31/07/2026

> Audit **lecture seule**. Aucun fichier applicatif modifié. Version auditée : app `1.1.39`,
> Android `versionCode 211`, iOS `buildNumber 103`. Backend : NestJS sur Render (free plan).
> Base : Supabase (`utfwujyymaikraaigvuv`). Push : Expo Push + FCM.

---

## 0. Périmètre réel

| Élément | Constat |
|---|---|
| Front | Expo SDK 54 / RN 0.81.5 / expo-router 6 / New Arch + Hermes + React Compiler |
| Code applicatif | ~37 300 lignes (app/ lib/ components/ hooks/) |
| Backend | NestJS 9, 4 modules (prout, friends, moderation, supabase), 1 697 lignes dans `prout.service.ts` |
| DB | Supabase Postgres, 40 fichiers SQL dans `supabase/migrations` (non versionnés/ordonnés) |
| Edge Function | `prout-proxy` (Deno) qui relaie vers Render |
| Tests | **0** |
| CI/CD | **aucune** |
| Télémétrie / crash reporting | **aucun** (guide `SETUP_SENTRY.md` présent mais Sentry non installé) |

---

## 1. CRITIQUE (P0) — à traiter avant toute nouvelle feature

### P0-1 — Clé API backend en dur dans l'app + committée
- `lib/matchContactsBackend.ts:4` → `const API_KEY = '82d6d94d97ad501a596bf866c2831623';`
- `backend/render.yaml:9` → même clé en clair, **committée dans le repo Git backend**.
- Cette clé est le **seul** contrôle d'accès de tous les endpoints `/prout/*` et `/friends/*`.
- Le backend s'authentifie à Supabase avec la **service_role key** (`supabase.service.ts`) → bypass total de RLS.

**Impact** : n'importe qui décompilant l'APK (5 min, `apktool` + `grep`) obtient les pleins pouvoirs applicatifs.

### P0-2 — L'Edge Function `prout-proxy` ne vérifie pas l'identité
```ts
const authHeader = req.headers.get("Authorization");
if (!authHeader) return 401;   // ← seule vérification
```
- Aucun `supabase.auth.getUser(jwt)`. La clé **anon** (publique par nature, embarquée dans l'app) est un JWT valide et passe le `verify_jwt` de la plateforme.
- Aucune corrélation entre l'utilisateur authentifié et les `senderId` / `receiverId` / `userId` **fournis dans le body**.

**IDOR généralisé** — un attaquant peut, pour n'importe quel compte :
| Endpoint | Abus |
|---|---|
| `POST /prout` | envoyer un prout/message **au nom de n'importe qui** (usurpation d'identité, harcèlement) |
| `POST /prout/pendingReceived` | **lire tous les messages en attente** d'un utilisateur arbitraire |
| `POST /prout/pendingSent` | idem côté expéditeur |
| `POST /prout/purge` | **effacer les conversations** d'autrui |
| `POST /prout/edit` | **réécrire un message** d'un autre utilisateur (`senderId` vient du body) |
| `POST /prout/readConversation` | marquer/détruire une conversation entière |

### P0-3 — `markMessageRead` détruit n'importe quel message sans contrôle
`backend/src/prout/prout.service.ts:1409`
```ts
const { data: msg } = await supabase.from('pending_messages')
  .select(...).eq('id', messageId).single();   // ← aucun .eq('to_user_id', callerId)
...
await supabase.from('pending_messages').delete().eq('id', messageId);
```
Connaître (ou brute-forcer) un `messageId` suffit à supprimer définitivement le message.

### P0-4 — RLS `user_profiles` : lecture totale pour tout compte authentifié
`supabase/migrations/supabase_nouvelle_architecture.sql:19`
```sql
CREATE POLICY "Enable read access for authenticated users"
ON public.user_profiles FOR SELECT TO authenticated USING (true);
```
(variante identique dans `supabase_user_profiles_rls_FIXED.sql` : `USING (auth.role() = 'authenticated')`)

Un simple compte gratuit permet `select * from user_profiles` → **exfiltration de l'annuaire complet** :
`phone`, `pseudo`, `locale`, `push_token`, `push_platform`, `push_ios_bundle`.
→ **Violation de données à caractère personnel notifiable (RGPD art. 33/34)** si exploitée.

### P0-5 — Clé privée Firebase committée
`backend/FIREBASE_SERVICE_ACCOUNT_ONE_LINE.txt` contient un `BEGIN PRIVATE KEY` complet et est **présent dans `HEAD`** du repo `github.com/Fuzztrack/prout-backend` (commit `e8bc497`).
Le repo répond 404 (privé ou supprimé) → pas de fuite publique constatée **aujourd'hui**, mais :
- toute ouverture accidentelle du repo = compromission du projet FCM `prout-5e6ec` ;
- le secret est dans l'historique : le supprimer du HEAD ne suffira pas (rotation obligatoire).
Le fichier n'est pas dans le `.gitignore` du backend.

### P0-6 — `/friends/match-contacts` : oracle d'énumération + amitié forcée
`backend/src/friends/friends.controller.ts` + `friends.service.ts`
- Aucune limite sur la taille de `phoneNumbers[]` (`.in('phone', [...])` non borné).
- La réponse renvoie **le numéro de téléphone** des utilisateurs matchés (`m.phone`) → fuite de PII vers l'appelant.
- Un match crée immédiatement une **amitié bidirectionnelle acceptée** sans consentement du destinataire (`addFriendBothWays`, `status: 'accepted'`).

**Abus** : balayer une plage de numéros → savoir qui est inscrit, récupérer son pseudo/téléphone, **et s'ajouter d'office dans sa liste d'amis** (donc pouvoir lui envoyer des prouts). Vecteur de harcèlement direct.

---

## 2. ÉLEVÉ (P1)

### P1-1 — Bug runtime confirmé : `Notifications` non importé (`app/index.tsx`)
4 appels à `Notifications.getPermissionsAsync()` (lignes ~191, 222, 257, 281) alors que
`expo-notifications` **n'est pas importé** dans le fichier (imports lignes 1-8).
→ `ReferenceError` → capturée par le `catch (e)` ligne 297 → *« En cas de doute, retour à l'auth »*.

**Conséquence utilisateur** : tout parcours passant par ces branches (connexion Apple/Google avec pseudo auto,
et la branche « sécurité » quand `pseudoValidated` est faux) **renvoie l'utilisateur sur l'écran de connexion
au lieu d'ouvrir l'app ou l'écran de complétion de profil**. Silencieux (aucune remontée).
→ Correspond typiquement aux retours « ça me redemande de me connecter ».

### P1-2 — Rate limiting global : plafond dur à ~10 requêtes/minute pour toute l'app
`app.module.ts` : `ThrottlerModule.forRoot({ ttl: 60, limit: 10 })`, tracker = **IP**.
Or tout le trafic arrive via l'Edge Function Supabase (quelques IP d'egress) et Express n'a pas
`trust proxy` → tous les utilisateurs partagent **le même compteur**.
→ Au-delà de ~10 envois/min **cumulés tous utilisateurs confondus**, tout le monde reçoit des 429
(d'où les `pendingRateLimitCooldownMs` et le `@Throttle(90, 60)` en rustine côté client).
**SPOF de scalabilité : l'app ne peut pas dépasser quelques dizaines d'utilisateurs actifs simultanés.**

### P1-3 — 6 secondes de latence artificielle par accusé de lecture
`prout.service.ts:1453-1455`
```ts
await new Promise(r => setTimeout(r, 1000));
await new Promise(r => setTimeout(r, 5000));   // ← deux attentes cumulées
```
Chaque `/prout/read` immobilise une connexion 6 s. Couplé au throttler ci-dessus et au plan free,
c'est aussi un vecteur d'épuisement de connexions trivial (DoS à faible coût).

### P1-4 — Messages stockés en clair
Le chiffrement AES-256-GCM existe (`encryptMessageContent`) mais est **désactivé** :
ni `MESSAGE_ENCRYPTION_ENABLED` ni `MESSAGE_ENCRYPTION_KEY` ne sont définis dans `backend/.env`
(commentaire du code : « Pause temporaire du chiffrement »).
→ Combiné à P0-2/P0-4, le contenu des conversations est lisible. *À reconfirmer côté variables Render.*

### P1-5 — Zéro observabilité
Pas de Sentry/Crashlytics, pas de métriques, pas d'alerting, pas de healthcheck externe.
L'`AppErrorBoundary` (`app/_layout.tsx:59`) fait un `console.error` **jamais collecté**.
Les seuls « logs » du repo (`logs/crash_logs_android.txt`, 5,5 Mo) sont un dump logcat de décembre 2025,
sans aucune `FATAL EXCEPTION` ni ANR applicative → **aucune visibilité réelle sur les crashs utilisateurs**.
Les logs Render n'ont pas pu être consultés (pas d'accès CLI/API dans cette session).

### P1-6 — 252 erreurs TypeScript
`npx tsc --noEmit --skipLibCheck` → **252 erreurs** (le script `npm run type-check` masque l'échec avec `|| true`).
Répartition : `temp_restore/` 40, `backend/src/prout/prout.controller.ts` 32, `app/index.tsx` 30,
`components/FriendsList.tsx` 22, `app/chat.tsx` 12…
Parmi elles, des **erreurs de correction réelle**, pas seulement de typage :
- `app/chat.tsx:243, 626, 790` : *Block-scoped variable used before its declaration* (TDZ → `ReferenceError` possible à l'exécution).
- `app/(tabs)/index.tsx:704` : `Share.share({ message: undefined })` possible.
- `app/(tabs)/index.tsx:877` : comparaison `Platform.OS === 'ios'` sur un type qui exclut `'ios'` → branche morte.
- `app/index.tsx:191/222` : le bug P1-1.

### P1-7 — Rétention des données non automatisée (RGPD)
`supabase_purge_old_pending_messages.sql` est un script **manuel** ; la purge à 7 jours est commentée.
Aucun `pg_cron`. Les messages « lus » supprimés le sont au coup par coup côté backend.
`delete_user_account()` couvre friends / invitations / pending_messages / interaction_logs / profil / auth.users
mais **pas explicitement** `reports`, `blocked_users`, `identity_reveals`, `message_reactions`
(dépend des `ON DELETE CASCADE` → à vérifier en base).

---

## 3. MOYEN (P2)

| # | Constat | Localisation |
|---|---|---|
| P2-1 | Session Supabase (refresh token) persistée dans **AsyncStorage non chiffré** alors qu'`expo-secure-store` est déjà une dépendance | `lib/supabase.ts:16` |
| P2-2 | `android:allowBackup="true"` ; les règles référencées (`@xml/secure_store_backup_rules`) sont introuvables dans `res/xml` du dossier `android/` versionné (dossier obsolète, régénéré par prebuild → à revérifier après `expo prebuild`) | `android/app/src/main/AndroidManifest.xml:19` |
| P2-3 | Permissions Android excessives : `WRITE_CONTACTS`, `WRITE_EXTERNAL_STORAGE`, `READ_EXTERNAL_STORAGE`, `SYSTEM_ALERT_WINDOW` (aucune écriture de contact ni overlay dans le code) → risque de rejet/déclaration Play Console | `app.json` + manifest |
| P2-4 | Injection HTML dans les emails de modération : `report.note` (texte libre utilisateur) interpolé sans échappement | `backend/src/moderation/moderation.service.ts:73` |
| P2-5 | 464 `console.*` dans le code applicatif, dont beaucoup **non gardés par `__DEV__`** (IDs utilisateurs, tokens partiels) → fuite en logcat + coût CPU sur le pont JS | app/ lib/ components/ |
| P2-6 | ~10 fonctions `SECURITY DEFINER` **sans `SET search_path`** (dont `delete_user_account`) → schéma d'escalade classique signalé par le linter Supabase | `supabase/migrations/*.sql` |
| P2-7 | N+1 : `addContactsMatches` fait 3 requêtes **séquentielles** par contact matché (2 SELECT + 2 UPSERT) → 200 contacts ⇒ ~600 aller-retours en série | `friends.service.ts:83` |
| P2-8 | Polling 5 s pendant qu'un chat est ouvert **en plus** du Realtime, + `offlineService` toutes les 15 s en permanence (même déconnecté/en arrière-plan), + vibration `setInterval` 6 s dans le header | `FriendsList.tsx:1243`, `offlineService.ts:22`, `AppHeader.tsx:90` |
| P2-9 | Un canal Realtime **créé + souscrit + détruit à chaque message** côté serveur (`supabase.channel('room-…')` + `removeChannel` à 5 s) → coût réseau et fuite potentielle sous charge | `prout.service.ts` (×5) |
| P2-10 | Dette : `FriendsList.tsx` = **4 538 lignes / 43 `useEffect`** ; `chat.tsx` 2 025 ; `i18n.ts` 3 605 | components/, app/ |
| P2-11 | Code mort embarqué : `FriendsList.backup.tsx`, `FriendsList_baaack.tsx` (2 508 l. chacun), `temp_restore/`, `dist/`, `backend/dist/`, `lib/supabase.js` (contient l'anon key en dur), doublons `.js`/`.ts` (`theme`, `use-color-scheme`, `themed-text`…) | racine |
| P2-12 | **`app/index copie.tsx` est un fichier de route** → expo-router expose une route fantôme `/index copie` | app/ |
| P2-13 | Bloat Git : `android/.gradle/*.bin` (29 Mo) et `logs/crash_logs_android.txt` (5,5 Mo) versionnés ; ~800 Mo de `.aab`/`.ipa` traînent dans le dossier de travail (non versionnés) | repo |
| P2-14 | Versions EOL : NestJS **9** (EOL), `@nestjs/throttler` 3, `firebase-admin` **11** côté backend vs **13** côté app | `backend/package.json` |
| P2-15 | Accessibilité : **17** attributs `accessibilityLabel/Role` pour 37 000 lignes ; **307 `Alert.alert`** (friction majeure pour un public senior/non technophile) ; 11 `hitSlop` seulement | app/, components/ |
| P2-16 | Écran d'erreur ultime : « Oups… Une erreur est survenue. Relance l'app. » — **cul-de-sac sans bouton d'action** | `app/_layout.tsx:66` |
| P2-17 | 192 `: any` ; aucun schéma de validation (`class-validator` est installé côté backend mais **jamais utilisé** : tous les `@Body() body: any`) | global |

---

## 4. Plan de remédiation ordonné (proposition — rien n'a été appliqué)

### Sprint 0 — Confinement (24–48 h)
1. **Rotation immédiate** : service account Firebase, `API_KEY` backend, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_WEBHOOK_SECRET`, `RESEND_API_KEY`.
2. Purger `FIREBASE_SERVICE_ACCOUNT_ONE_LINE.txt` de l'historique (`git filter-repo`) + l'ajouter au `.gitignore` backend ; retirer `API_KEY` de `render.yaml` (`sync: false` sans valeur).
3. RLS `user_profiles` : remplacer `USING (true)` par une politique de moindre privilège
   (profil personnel + amis acceptés uniquement) et **sortir `phone` et `push_token` de la table lisible**
   (vue restreinte ou colonnes déplacées dans une table protégée).
4. `markMessageRead` : ajouter `.eq('to_user_id', <uid vérifié>)` sur le SELECT **et** le DELETE.

### Sprint 1 — Reprise de contrôle de l'identité (1–2 semaines)
5. `prout-proxy` : `const { data: { user } } = await supabaseAdmin.auth.getUser(jwt)` → rejeter si absent,
   puis **injecter `user.id` côté serveur** dans le body relayé (`x-user-id` signé).
6. Backend : ignorer tout `senderId`/`userId` venant du client ; l'imposer depuis le JWT vérifié.
   Un `AuthGuard` NestJS + DTO `class-validator` sur chaque endpoint.
7. Supprimer `matchContactsBackend.ts` en direct → passer par le proxy ; ne plus renvoyer `phone` ;
   borner `phoneNumbers` (ex. 1 000 max) ; passer l'amitié auto en **demande** (`status: 'pending'`).
8. Réactiver le chiffrement des messages (`MESSAGE_ENCRYPTION_KEY` en secret Render).

### Sprint 2 — Fiabilité
9. Corriger `app/index.tsx` (import manquant) — **quick win, gros impact utilisateur**.
10. Passer le rate limiting sur `userId` (pas l'IP) + `app.set('trust proxy', 1)`.
11. Supprimer les `setTimeout` bloquants de `markMessageRead`.
12. Installer Sentry (front + backend), activer un healthcheck externe, quitter le plan free Render
    (cold start = notifications retardées).
13. `npm run type-check` sans `|| true`, en CI bloquante ; ramener les 252 erreurs à 0 par lots.
14. `pg_cron` de purge `pending_messages` (7 j) + compléter `delete_user_account()`.

### Sprint 3 — Dette & UX
15. Supprimer le code mort (`*.backup.tsx`, `_baaack`, `index copie.tsx`, `temp_restore/`, `dist/`, doublons `.js`).
16. Découper `FriendsList.tsx` (4 538 l.) en modules ; extraire les 43 `useEffect`.
17. Remplacer les `Alert.alert` par des retours in-place non bloquants ; audit a11y (labels, cibles ≥ 48 dp, contraste, `fontScale`).
18. Réduire les `console.*` (babel `transform-remove-console` en production).

---

## 5. Verdicts des 7 Collèges

| Collège | Verdict | Motif bloquant |
|---|---|---|
| 🏴‍☠️ Red Team & Zero-Day | ❌ **REJET** | P0-1 → P0-6 : usurpation d'identité, lecture/suppression de messages arbitraires, dump de l'annuaire |
| 🚀 Apollo SRE | ❌ **REJET** | SPOF Render free + throttler global 10 req/min + zéro télémétrie : panne invisible et non diagnosticable |
| ⚙️ Core V8 | ⚠️ **RÉSERVES** | 6 s d'attente serveur artificielle, N+1 contacts, polling 5 s redondant, canaux Realtime jetables |
| 🧠 Cognitive UX & A11y | ⚠️ **RÉSERVES** | 307 `Alert.alert`, 17 attributs a11y, écran d'erreur cul-de-sac, rebond silencieux vers l'écran de login (P1-1) |
| ⚖️ Haut-Conseil RGPD | ❌ **REJET** | Annuaire lisible par tout compte (art. 32), messages en clair, rétention non automatisée, amitié imposée sans consentement |
| 💎 DevEx & Open Source | ❌ **REJET** | 0 test, 0 CI, 252 erreurs TS masquées, secrets committés, code mort massif, fichiers 4 500 lignes |
| 🌐 Direction Alphabet | ⚠️ **RÉSERVES** | i18n solide (6 langues) et abstraction Supabase correcte, mais plafond dur à quelques dizaines d'utilisateurs simultanés : « scale to billions » impossible en l'état |

**Décision consolidée : NO-GO pour toute nouvelle fonctionnalité tant que le Sprint 0 n'est pas exécuté.**
Les points forts existent (i18n complète, batching Expo/FCM déjà en place, RLS correcte sur
`pending_messages` / `friends` / `reports` / `blocked_users`, ErrorBoundary, file d'attente offline,
plugins natifs propres) — mais la couche d'authentification serveur est absente, pas seulement faible.

---

## 6. État / passation pour la prochaine session

- **Rien n'a été modifié.** Cet audit est le seul fichier créé (`docs/audit/AUDIT_COMPLET_2026-07-31.md`).
- Modifications non commitées en cours dans l'arbre de travail (antérieures à l'audit) :
  `app.json`, `app/(tabs)/index.tsx`, `components/FriendsList.tsx`,
  `components/FriendsListComponents/SwipeableFriendRow.tsx`, `package.json` (bump 1.1.39 / vc 211).
- Non vérifiable dans cette session (à faire avec les accès) :
  - logs Render en production (`render logs -s prout-backend`) ;
  - variables d'environnement réellement définies sur Render (chiffrement des messages, API_KEY) ;
  - politiques RLS **effectivement actives** en base :
    `select tablename, policyname, cmd, qual from pg_policies where schemaname='public';`
  - `verify_jwt` de l'Edge Function `prout-proxy` (`supabase functions list`).
- Prochaine étape recommandée : **Sprint 0** (rotation des secrets + RLS `user_profiles` + fix `markMessageRead`),
  puis le quick win P1-1 (import manquant dans `app/index.tsx`).
