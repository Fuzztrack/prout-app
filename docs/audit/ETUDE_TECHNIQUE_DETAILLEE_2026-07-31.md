# ÉTUDE TECHNIQUE DÉTAILLÉE — Proot ! (ProutApp)
## Document de travail destiné à une revue croisée (Gemini) — 31/07/2026

> **Statut : AUCUNE MODIFICATION N'A ÉTÉ APPLIQUÉE.** Ce document décrit ce qui existe, ce qui est cassé,
> et ce qu'il faudrait faire. Tous les extraits de code sont des **citations de l'existant** ou des
> **propositions non appliquées** (explicitement marquées `PROPOSÉ`).
>
> **Version auditée** : app `1.1.39` · Android `versionCode 211` · iOS `buildNumber 103` ·
> backend `prout-backend` (Render, plan free) · Supabase projet `utfwujyymaikraaigvuv`.
>
> **Méthode** : lecture ligne à ligne du code, exécution de `tsc --noEmit` (252 erreurs), inspection de
> l'historique Git des deux dépôts, lecture des 40 migrations SQL, ping du backend de production
> (aucune requête mutante n'a été émise), vérification des recommandations officielles
> (Supabase Realtime Authorization, Supabase Edge Functions Auth, Supabase RLS Performance,
> Expo Push Receipts, NestJS Throttler behind proxy — liens en §8).

---

# PARTIE 0 — Comment lire ce document

Chaque défaut porte un identifiant stable (`SEC-01`, `BUG-03`, `PERF-02`…) et un **niveau de preuve** :

| Marqueur | Signification |
|---|---|
| **[PROUVÉ-STATIQUE]** | Démontré par lecture du code / du schéma. Aucune ambiguïté possible. |
| **[PROUVÉ-OUTIL]** | Démontré par la sortie d'un outil (`tsc`, `git`, `curl`). |
| **[À CONFIRMER-PROD]** | Hypothèse forte, mais dépend d'une config serveur non lisible depuis le repo (variables Render, état réel des policies en base). Une commande de vérification est fournie à chaque fois. |

Un défaut **[À CONFIRMER-PROD]** ne doit jamais être corrigé à l'aveugle : la commande de vérification
doit être jouée d'abord.

---

# PARTIE 1 — Architecture réelle

## 1.1 Le chemin d'une donnée

```
┌──────────────┐   supabase-js (clé ANON, JWT user)    ┌────────────────────┐
│  App Expo    │ ────────────────────────────────────► │ Supabase Postgres  │
│  (RN 0.81.5) │   lecture directe : profils, amis,    │  + RLS             │
│              │   messages, réactions, blocages       └────────────────────┘
│              │                                                 ▲
│              │   fetch + Bearer <access_token>                 │ service_role
│              │ ──────────────────┐                             │ (bypass RLS)
└──────────────┘                   ▼                             │
                        ┌──────────────────────┐        ┌────────────────────┐
                        │ Edge Function Deno   │ ─────► │ NestJS sur Render  │
                        │ « prout-proxy »      │ x-api  │ (plan free)        │
                        │ (relais + clé API)   │  -key  │                    │
                        └──────────────────────┘        └────────┬───────────┘
                                                                 │
                                        ┌────────────────────────┼──────────────┐
                                        ▼                        ▼              ▼
                                  Expo Push (iOS)          FCM (Android)   Realtime Broadcast
                                                                            canal `room-<uuid>`
```

**Le point structurant, et la racine de la moitié des problèmes :** le backend NestJS s'authentifie
auprès de Supabase avec la **`service_role` key** (`backend/src/supabase/supabase.service.ts:10`),
donc **il court-circuite intégralement la RLS**. Toute la sécurité repose donc sur la capacité du backend
à savoir *qui* l'appelle. Or il ne le sait pas : il lit `senderId` / `receiverId` / `userId` **dans le corps
de la requête**, sans jamais les recouper avec une identité vérifiée.

## 1.2 Inventaire

| Élément | Volume | Remarque |
|---|---|---|
| Code applicatif (app/ lib/ components/ hooks/) | ~37 300 lignes | dont `FriendsList.tsx` **4 538 l.** et `chat.tsx` **2 025 l.** |
| Backend NestJS | 4 modules, `prout.service.ts` **1 697 l.** | god-service |
| Migrations SQL | 40 fichiers non ordonnés, non versionnés | pas de source de vérité du schéma |
| Tests automatisés | **0** | |
| Pipeline CI | **0** | |
| Crash reporting / APM | **0** | `SETUP_SENTRY.md` existe, package absent |
| Erreurs TypeScript | **252** | masquées par `|| true` dans `npm run type-check` |
| `console.*` en prod | **464** | |
| Attributs d'accessibilité | **17** | pour 37 300 lignes |

---

# PARTIE 2 — La chaîne d'attaque complète (pourquoi c'est systémique)

Ce n'est pas une liste de failles indépendantes : elles s'enchaînent. Voici le scénario complet,
réalisable par une personne seule avec un téléphone et 30 minutes.

```
ÉTAPE 1 — Récupérer les clés
   apktool d proot.apk && grep -r "supabase.co\|x-api-key" .
   → EXPO_PUBLIC_SUPABASE_URL + ANON_KEY (inlinées par Expo, publiques par conception)
   → API_KEY backend « 82d6d94d97ad501a596bf866c2831623 » (SEC-01, en dur dans le JS)

ÉTAPE 2 — Créer un compte gratuit (email jetable), obtenir un JWT `authenticated`

ÉTAPE 3 — Aspirer l'annuaire  (SEC-04)
   select * from user_profiles;
   → RLS = USING (true) → id, pseudo, phone, expo_push_token, locale de TOUS les utilisateurs

ÉTAPE 4 — Écoute temps réel  (SEC-07)
   supabase.channel('room-<uuid_victime>').on('broadcast', {event:'message-received'}, …)
   → canal PUBLIC → réception en direct du contenu déchiffré de tous les messages de la victime

ÉTAPE 5 — Usurpation / destruction  (SEC-02, SEC-03)
   POST /functions/v1/prout-proxy         Authorization: Bearer <anon_key>
        body: { senderId: <victime>, receiverId: <cible>, customMessage: "…" }
   → message envoyé AU NOM de la victime
   POST …/prout/purge  { userId, friendId }        → conversation effacée
   POST …/prout/read   { messageId }               → message d'autrui DÉTRUIT
   POST …/prout/pendingReceived { userId }         → boîte de réception d'autrui

ÉTAPE 6 — Harcèlement de masse  (SEC-06 + SEC-09)
   POST /friends/match-contacts { userId: <moi>, phoneNumbers: [+336…] }
   → énumération : qui est inscrit + son numéro + amitié bidirectionnelle AUTO-ACCEPTÉE
   → puis spam de notifications ; le blocage étant purement client, il ne bloque rien
```

**Conclusion de la Red Team : le modèle de sécurité serveur n'est pas faible, il est absent.**
Corriger un maillon sans corriger les autres ne change rien au résultat.

---

# PARTIE 3 — Inventaire détaillé des défauts

## 3.1 SÉCURITÉ

---

### SEC-01 — Clé API backend en dur dans le client et committée **[PROUVÉ-STATIQUE]**

**Preuve**
```ts
// lib/matchContactsBackend.ts:2-4
export async function matchContactsViaBackend(userId: string, phoneNumbers: string[]) {
  const API_URL = 'https://prout-backend.onrender.com/friends/match-contacts';
  const API_KEY = '82d6d94d97ad501a596bf866c2831623'; // doit matcher backend .env
```
```yaml
# backend/render.yaml:7-9  (committé dans github.com/Fuzztrack/prout-backend)
      - key: API_KEY
        value: 82d6d94d97ad501a596bf866c2831623
        sync: false
```

**Pourquoi c'est grave** : cette clé est le **seul** contrôle d'accès de `/prout/*` et `/friends/*`,
et derrière elle il y a la `service_role` Supabase. `sync: false` **n'empêche pas** la valeur d'être
committée en clair — il empêche seulement Render de la synchroniser, la valeur est bien dans le YAML.

**Correctif** : voir CHANTIER A (étapes A1, A3).

---

### SEC-02 — L'Edge Function ne vérifie pas l'identité de l'appelant **[PROUVÉ-STATIQUE]**

**Preuve**
```ts
// supabase/functions/prout-proxy/index.ts:20-26
const authHeader = req.headers.get("Authorization");
if (!authHeader) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, … });
}
// …puis relais direct du body, sans aucune autre vérification :
const bodyText = await req.text();
const response = await fetch(targetUrl, {
  method: req.method,
  headers: { "Content-Type": "application/json", "x-api-key": BACKEND_API_KEY },
  body: bodyText,
});
```

**Le piège documenté** : même avec `verify_jwt = true` (défaut de la plateforme), **la clé anon est un JWT
valide et signé** ; elle passe la validation cryptographique. La doc Supabase le dit explicitement :
*« An Authorization header alone is insufficient for security. The anon key is a valid JWT »*
(cf. §8, Supabase Edge Functions Auth).

Il faut donc **deux** contrôles : (a) `verify_jwt` au niveau plateforme, (b) extraction et vérification du
`sub` / `role` dans la fonction, puis **réécriture serveur** des identifiants.

**Impact** : IDOR sur 100 % des endpoints. Tableau des abus :

| Endpoint | Paramètre non vérifié | Abus |
|---|---|---|
| `POST /prout` | `extraData.senderId` | envoyer un message au nom de n'importe qui |
| `POST /prout/pendingReceived` | `userId` | lire la boîte de réception d'autrui |
| `POST /prout/pendingSent` | `userId` | lire les messages envoyés d'autrui |
| `POST /prout/purge` | `userId`, `friendId` | effacer la conversation d'autrui |
| `POST /prout/edit` | `senderId` | réécrire le message d'un autre |
| `POST /prout/readConversation` | `senderId`, `receiverId` | marquer lu + détruire une conversation |
| `POST /friends/match-contacts` | `userId` | créer des amitiés au nom d'autrui |

---

### SEC-03 — `markMessageRead` supprime n'importe quel message **[PROUVÉ-STATIQUE]**

**Preuve** — `backend/src/prout/prout.service.ts:1409-1461`
```ts
const { data: msg, error: selectError } = await supabase
  .from('pending_messages')
  .select('message_content, to_user_id, from_user_id')
  .eq('id', messageId)        // ← aucun filtre sur le destinataire
  .single();
…
const { error } = await supabase.from('pending_messages')
  .delete().eq('id', messageId).select('id');   // ← destruction inconditionnelle
```
À comparer avec `editMessage` (ligne 1596) qui, lui, filtre bien (`.eq('from_user_id', senderId)`).
L'incohérence montre que c'est un oubli, pas un choix.

**Impact** : destruction de données arbitraire. Les `id` sont des UUID v4 (non énumérables par force brute),
mais ils **fuient** via SEC-07 (broadcast public) et via `/prout/pendingReceived` (SEC-02).

---

### SEC-04 — RLS `user_profiles` : lecture totale **[PROUVÉ-STATIQUE / état prod À CONFIRMER]**

**Preuve** — `supabase/migrations/supabase_nouvelle_architecture.sql:19`
```sql
CREATE POLICY "Enable read access for authenticated users"
ON "public"."user_profiles" FOR SELECT TO authenticated USING (true);
```
Et la variante concurrente `supabase_user_profiles_rls_FIXED.sql:50` :
```sql
CREATE POLICY "Users can read public profiles" ON user_profiles
FOR SELECT USING (auth.role() = 'authenticated');
```
Les deux sont équivalentes en pratique : **tout compte authentifié lit toutes les lignes**.

**Colonnes exposées** (déduites du code qui les lit) : `id`, `pseudo`, `phone`, `locale`,
`expo_push_token`, `push_platform`, `push_ios_bundle`, `avatar_url`, `updated_at`.
→ **numéros de téléphone + jetons push de l'intégralité de la base**.

**Vérification prod obligatoire avant correction**
```sql
select policyname, cmd, roles, qual, with_check
from pg_policies where schemaname='public' and tablename='user_profiles';
```

**Piège majeur** : c'est cette policy qui fait fonctionner la recherche d'utilisateur et l'affichage des
amis. La restreindre brutalement **casse l'app**. Il faut la remplacer par une RPC (voir CHANTIER B, étape B2).

---

### SEC-05 — Clé privée Firebase dans l'historique Git **[PROUVÉ-OUTIL]**

```
$ git -C backend show HEAD:FIREBASE_SERVICE_ACCOUNT_ONE_LINE.txt | grep -c "BEGIN PRIVATE KEY"
1
$ git -C backend log --oneline -1 -- FIREBASE_SERVICE_ACCOUNT_ONE_LINE.txt
e8bc497 Fix: Utilisation de Expo Push API pour tout le monde
$ cat backend/.gitignore
node_modules/ | dist/ | .env | *.log | .DS_Store        ← le fichier n'y est PAS
$ curl -o /dev/null -w "%{http_code}" https://github.com/Fuzztrack/prout-backend
404      ← dépôt privé ou supprimé : pas de fuite publique constatée aujourd'hui
```
Le fichier contient le service account complet du projet `prout-5e6ec` (`private_key_id`
`dcd4c23717660ec8ec…`, `BEGIN PRIVATE KEY`). Un service account Firebase = **envoi de push à tous les
utilisateurs, lecture/écriture Firestore, gestion IAM du projet**.

**Le fait qu'il soit privé aujourd'hui ne suffit pas** : un `git push` sur un fork public, un
collaborateur ajouté, ou un simple passage du dépôt en public suffit. Et supprimer le fichier du HEAD
ne suffira pas non plus : il est dans l'historique. **La rotation est obligatoire**, la réécriture
d'historique est un complément.

---

### SEC-06 — `/friends/match-contacts` : oracle d'énumération + amitié forcée **[PROUVÉ-STATIQUE]**

**Preuve** — `backend/src/friends/friends.controller.ts:31-46`
```ts
if (!userId || !phoneNumbers || !Array.isArray(phoneNumbers)) throw new BadRequestException(…);
// ← aucune borne sur phoneNumbers.length
const matches = await this.friendsService.addContactsMatches(userId, phoneNumbers);
return { success: true,
  matches: matches.map(m => ({ id: m.id, pseudo: m.pseudo, phone: m.phone })), // ← renvoie le TÉLÉPHONE
  count: matches.length };
```
```ts
// friends.service.ts:104  — amitié créée sans consentement du destinataire
await this.addFriendBothWays(currentUserId, user.id);
// → upsert { user_id, friend_id, method:'contact', status:'accepted' }  ×2
```

**Trois problèmes distincts** :
1. **Oracle** : `POST` avec 10 000 numéros → liste des inscrits. Non borné, non authentifié (SEC-01/02).
2. **Fuite PII** : la réponse renvoie le `phone` d'utilisateurs tiers à l'appelant.
3. **Consentement** : `status: 'accepted'` dans les deux sens. La victime se retrouve « amie » avec un
   inconnu, qui peut lui envoyer des notifications. C'est le vecteur de harcèlement le plus direct de l'app.

---

### SEC-07 — Canal Realtime public transportant le contenu des messages **[PROUVÉ-STATIQUE]** ⚠️ *le plus grave*

**Preuve serveur** — `backend/src/prout/prout.service.ts:876-895`
```ts
const channel = supabase.channel(`room-${receiverId}`);   // ← PAS de { config: { private: true } }
channel.subscribe(async (status) => {
  if (status === 'SUBSCRIBED') {
    const sendSignal = async () => {
      const broadcastPayload = {
        from: senderId,
        ...(customMessage ? { customMessage } : {}),     // ← contenu du message EN CLAIR
        ...(proutKey ? { proutKey } : {}),
        ...(insertedMessageData && { m_d: insertedMessageData }), // ← message DÉCHIFFRÉ complet
      };
      await channel.send({ type: 'broadcast', event: 'message-received', payload: broadcastPayload });
    };
    await sendSignal(); setTimeout(sendSignal, 500); setTimeout(sendSignal, 1500); // ×3
```
**Preuve client** — `components/FriendsList.tsx:2346-2348`
```ts
const channelName = `room-${user.id}`;
const broadcastChannel = supabase.channel(channelName)   // ← idem, canal public
```

**Doc officielle Supabase (§8)** : *« By default without RLS policies, public channels allow **any client**
to broadcast and receive messages. »*

**Conséquence** : le nom du canal est `room-<uuid utilisateur>`. Les UUID sont obtenus via SEC-04.
N'importe qui muni de la clé anon (publique) peut :
- **écouter en direct tous les messages entrants** de n'importe quel utilisateur (mise sur écoute) ;
- **injecter de faux événements** `message-received` / `message-read` / `message-edited` dans l'app d'un
  tiers (le client fait confiance au payload : `payload.payload.m_d` est directement inséré dans le store).

C'est une **interception de communications privées**, catégorie la plus lourde au regard du RGPD et,
en droit français, susceptible de relever de l'atteinte au secret des correspondances.

**Vérification prod**
```bash
supabase functions list                # verify_jwt de prout-proxy
# Dashboard > Realtime > Settings > "Allow public access"  → doit être DÉSACTIVÉ
select policyname, cmd from pg_policies where schemaname='realtime' and tablename='messages';
```

---

### SEC-08 — Session persistée en clair + `service_role` dans le `.env` de l'app **[PROUVÉ-STATIQUE]**

```ts
// lib/supabase.ts:14-21
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, … },
});
```
`AsyncStorage` = SQLite non chiffré dans le sandbox de l'app. Sur Android, `allowBackup="true"`
(`android/app/src/main/AndroidManifest.xml:19`) ⇒ le `refresh_token` peut sortir via une sauvegarde
ADB/cloud. `expo-secure-store` est **déjà une dépendance** du projet mais n'est pas utilisé pour la session.

**En prime** : le fichier `.env` **de l'app mobile** contient `SUPABASE_SERVICE_ROLE_KEY`.
Cette variable n'étant pas préfixée `EXPO_PUBLIC_`, elle **n'est pas inlinée dans le bundle** (vérifié :
aucune occurrence hors `.env`), donc pas de fuite dans l'APK. Mais `.easignore` ne l'exclut pas :
le fichier est **uploadé sur les serveurs de build EAS** à chaque build. Une clé `service_role` n'a
strictement rien à faire dans le projet mobile.

---

### SEC-09 — Le blocage est purement cosmétique **[PROUVÉ-STATIQUE]**

```bash
$ grep -rn "blocked_users" backend/src/
(aucun résultat)
```
La table `blocked_users` existe, avec une RLS correcte, et n'est lue **que par le client**
(`components/BlockedUsersList.tsx:53`, `components/FriendsList.tsx:2843` qui filtre l'affichage).

**Conséquence** : un utilisateur bloqué continue d'envoyer des prouts et des messages ; la notification
push **arrive et sonne** sur le téléphone de la victime (le backend ne consulte jamais la table).
Seule la ligne disparaît de la liste. C'est exactement ce que la **Guideline 1.2 d'Apple** (contenu
généré par les utilisateurs : « the ability to block abusive users ») exige et que l'app ne fournit pas
réellement. Risque de rejet App Store en cas de signalement, **et surtout inefficacité réelle face au
harcèlement**.

---

### SEC-10 — Injection HTML dans les alertes de modération **[PROUVÉ-STATIQUE]**

```ts
// backend/src/moderation/moderation.service.ts:73-86
<p><strong>Note:</strong> ${report.note || 'N/A'}</p>   // ← texte libre utilisateur, non échappé
```
`note` est saisi par l'utilisateur qui signale. Un `<img src=x onerror=…>` ou un lien maquillé arrive
dans la boîte mail du développeur. Impact limité (un seul destinataire) mais trivial à corriger.

---

### SEC-11 — `SECURITY DEFINER` sans `SET search_path` **[PROUVÉ-STATIQUE]**

~10 fonctions concernées, dont `delete_user_account()` (`supabase_delete_user_function.sql:12`),
`update_friend_interaction`, les triggers `friends`. C'est le warning `function_search_path_mutable`
du linter Supabase. Exploitabilité faible sur PG15+ (le `CREATE` sur `public` n'est plus donné à
`PUBLIC` par défaut), **mais** c'est une défense en profondeur gratuite et c'est un point que tout
auditeur externe relèvera.

---

## 3.2 BUGS FONCTIONNELS

---

### BUG-01 — 🔴 `app/chat.tsx` plante à l'ouverture (TDZ) **[PROUVÉ-OUTIL + PROUVÉ-STATIQUE]**

**Sortie de `tsc`**
```
app/chat.tsx(243,17): error TS2448: Block-scoped variable 'sentMessages' used before its declaration.
app/chat.tsx(626,9):  error TS2448: Block-scoped variable 'loadConversationReactions' used before its declaration.
app/chat.tsx(790,34): error TS2448: … 'isReactionForCurrentConversation' …
app/chat.tsx(790,68): error TS2448: … 'removeReactionForMessage' …
app/chat.tsx(790,94): error TS2448: … 'replaceReactionForMessage' …
```

**Le code** (un seul composant, `export default function ChatScreen()` ligne 193) :
```ts
// ligne 228
const handleMessageEdited = useCallback((messageId: string, newText: string) => {
  …
  const existing = sentMessages.find(…);          // corps : exécuté plus tard, OK
  …
}, [friendId, sentMessages, addSentMessages]);    // ← ligne 243 : ÉVALUÉ PENDANT LE RENDU

// ligne 272
const [sentMessages, setSentMessages] = useState<VisibleSentMessage[]>(sentByFriend[friendId] || []);
```

**Analyse** : le corps d'un `useCallback` est différé, mais **le tableau de dépendances est un littéral
construit au moment de l'appel**, donc pendant le rendu, ligne 243 — alors que `sentMessages` (un `const`)
n'est initialisé qu'à la ligne 272. C'est une **Temporal Dead Zone** : JavaScript lève
`ReferenceError: Cannot access 'sentMessages' before initialization`. Même chose pour les
`useFocusEffect` des lignes 626 et 790, dont les dépendances pointent vers des `useCallback` déclarés
lignes 964, 978, 1016 et 1027.

**Le chemin utilisateur** — `components/FriendsList.tsx:3197` puis `3871` :
```ts
const handlePressFriend = useStableCallback((friend: any) => {
  …
  safePush(router, { pathname: '/chat', params: { friendId: friend.id, … } }, …);
});
…
<SwipeableFriendRow … onPressName={handlePressFriend} />
```
→ **Appuyer sur le prénom d'un ami dans la liste ouvre `/chat` ⇒ ReferenceError au premier rendu ⇒
capturé par l'`AppErrorBoundary` ⇒ écran « Oups… Une erreur est survenue. Relance l'app. »**

**Statut** : `[PROUVÉ-STATIQUE]` sur la sémantique JS (aucune ambiguïté), mais **je n'ai pas exécuté
l'app**. Il faut 30 secondes pour trancher — et ce test est le **premier** à faire :

> **Repro** : lancer l'app → liste d'amis → appuyer sur le **prénom** d'un ami (pas l'avatar, pas le swipe).
> Attendu si le bug est réel : écran « Oups… ». Dans les logs Metro/logcat :
> `ReferenceError: Cannot access 'sentMessages' before initialization`.

**Si l'écran s'ouvre normalement**, alors une transformation Babel/React-Compiler réordonne le code et
le bug est *latent* et non actif — il redeviendra actif au premier changement de configuration de build.
Dans les deux cas, la correction est la même et elle est triviale (déplacer les déclarations).

---

### BUG-02 — 🔴 `Notifications` non importé dans le routeur racine **[PROUVÉ-OUTIL]**

```
app/index.tsx(191,48): error TS2552: Cannot find name 'Notifications'. Did you mean 'Notification'?
app/index.tsx(222,46): error TS2552: …
```
Imports du fichier (lignes 1-8) : `AsyncStorage`, `expo-router`, `expo-splash-screen`, `react`,
`react-native`, `../lib/eula`, `../lib/navigation`, `../lib/supabase`. **Pas d'`expo-notifications`.**

4 appels `await Notifications.getPermissionsAsync()` (≈ l. 191, 222, 257, 281). Chacun lève une
`ReferenceError`, capturée ligne 297 :
```ts
} catch (e) {
  console.log('❌ Erreur Routeur:', e);
  // En cas de doute, retour à l'auth
```
**Conséquence utilisateur** : dans toutes les branches concernées — connexion Apple/Google avec pseudo
auto-rempli, **et la branche « sécurité » (profil non validé)** — l'utilisateur est **silencieusement
renvoyé sur l'écran de connexion** au lieu d'entrer dans l'app ou d'aller compléter son profil.
Aucune trace côté serveur, aucune remontée. C'est le candidat n°1 pour expliquer un retour du type
« ça me redemande de me connecter / je tourne en rond à l'inscription ».

---

### BUG-03 — Le déduplicage de jeton push ne peut pas fonctionner **[PROUVÉ-STATIQUE]**

```ts
// lib/pushTokenRegistration.ts:101-108
await supabase.from('user_profiles')
  .update(EMPTY_PUSH_PAYLOAD)
  .eq('expo_push_token', pushToken)
  .neq('id', userId);            // ← cible les lignes des AUTRES utilisateurs
```
La policy UPDATE est `USING (auth.uid() = id)` : la requête ne peut donc toucher **aucune** ligne.
Elle ne renvoie pas d'erreur (0 ligne modifiée = succès), et le `catch` note « Nettoyage doublons ignoré ».

**Conséquence réelle** : si deux comptes se succèdent sur le même téléphone (revente, prêt, ré-inscription),
**l'ancien profil conserve le jeton push du device**. Les prouts destinés à A sonnent chez B, avec le
pseudo de l'expéditeur et le texte du message dans la notification. **Fuite de correspondance privée
vers un tiers.** Ce n'est pas théorique : c'est le comportement nominal du code actuel.

---

### BUG-04 — Aucune lecture des *receipts* Expo **[PROUVÉ-STATIQUE]**

Le code ne traite que les **tickets** (`prout.service.ts:1206-1233`) :
```ts
const tickets = await this.expoClient.sendPushNotificationsAsync(notifications);
tickets.forEach((ticket, index) => { if (ticket?.status === 'ok') item.resolve(…) });
```
Doc Expo (§8) : *« A status of ok along with a receipt ID means that the message was received by Expo's
servers, **not** that it was received by the user »* et *« **You must check each push receipt** »*.

`getPushNotificationReceiptsAsync` n'est **jamais** appelé. Conséquences :
- les `DeviceNotRegistered` remontés en *receipt* (le cas le plus fréquent : désinstallation) ne sont
  jamais traités ⇒ **les jetons morts s'accumulent** en base et on continue de pousser dessus
  (mauvais citoyen APNs/FCM, risque de throttling projet) ;
- les erreurs de credentials APNs (`InvalidCredentials`) sont invisibles : l'app « n'envoie plus de
  notifications iOS » sans qu'aucun log ne l'indique.

Le cas `DeviceNotRegistered` **au niveau ticket** est bien géré (`normalizeExpoTicketError:1241`) — c'est
le cas minoritaire.

---

### BUG-05 — `normalizePhone` : normalisation naïve, faux appariements possibles **[PROUVÉ-STATIQUE]**

```ts
// lib/normalizePhone.ts
if (cleaned.startsWith('06') || cleaned.startsWith('07')) cleaned = '+33' + cleaned.substring(1);
if (cleaned.startsWith('00')) cleaned = '+' + cleaned.substring(2);
return cleaned;   // sinon, laissé tel quel
```
- Le préfixe `+33` est **imposé à tout numéro commençant par 06/07**, quel que soit le pays de
  l'utilisateur (l'Italie, la Russie, l'Afrique du Sud ont des numéros locaux en `06…`/`07…`).
- Les numéros sans indicatif et ne commençant pas par 06/07 sont stockés **tels quels** : `0612345678`
  et `+33612345678` sont alors deux clés différentes ⇒ appariements manqués.
- Aucune validation E.164, aucune bibliothèque (`libphonenumber-js`).

**Conjugué à SEC-06** (amitié auto-acceptée), une normalisation qui télescope deux numéros de pays
différents ne produit pas seulement un bug d'affichage : elle **met deux inconnus en relation**.

---

### BUG-06 — `projectId` Expo de secours incohérent **[PROUVÉ-STATIQUE]**

```ts
// lib/fcmToken.ts:31-35
const projectId = (Constants?.expoConfig?.extra?.eas?.projectId ?? … ) ||
  '38706df8-6933-40e1-8848-d3e7a086057e'; // Ton Project ID réel par défaut
```
Or `app.json` déclare `"projectId": "bdb304d6-9f2e-4af9-82ea-4532522a031f"`. **Les deux ne
correspondent pas.** Si le fallback s'active un jour (config non chargée, build mal configuré), l'app
émettra des jetons Expo rattachés à **un autre projet** ⇒ les notifications ne partiront jamais, sans
la moindre erreur visible. Mine anti-personnel typique.

---

### BUG-07 — Code mort exécutable et routes fantômes **[PROUVÉ-STATIQUE]**

- `app/index copie.tsx` est dans le dossier `app/` ⇒ **expo-router en fait une route** (`/index copie`).
- `lib/notifications.ts:registerForPushNotificationsAsync` contient `if (!Constants.isDevice) return;`
  or `Constants.isDevice` **n'existe plus** dans expo-constants (SDK 54) ⇒ `!undefined === true` ⇒
  la fonction retourne **toujours** `undefined`. *Heureusement elle n'est plus appelée* (seule occurrence :
  `lib/_archives notifications copie.ts`) — mais c'est une bombe à retardement si quelqu'un la rebranche.
- Doublons compilés `.js` à côté des `.ts` : `lib/supabase.js` (contient la clé anon en dur),
  `constants/theme.js`, `hooks/use-color-scheme.js`, `components/themed-text.js`… Metro résout `.ts`
  en premier, donc inactifs, mais toute modification de `sourceExts` inverse le comportement.
- `components/FriendsList.backup.tsx` + `components/FriendsList_baaack.tsx` = 5 016 lignes mortes.
- `temp_restore/` (40 erreurs TS) est inclus dans le `tsconfig.json`.

---

## 3.3 FIABILITÉ / SRE

### SRE-01 — Rate limiting global : plafond dur pour toute l'application **[PROUVÉ-STATIQUE]**
```ts
// backend/src/app.module.ts:16-19
ThrottlerModule.forRoot({ ttl: 60, limit: 10 })
```
Le tracker par défaut de `@nestjs/throttler` est **l'IP** (`req.ip`). Or :
1. tout le trafic transite par l'Edge Function ⇒ quelques IP d'egress Supabase seulement ;
2. `main.ts` ne configure **pas** `trust proxy` ⇒ `req.ip` est l'IP du proxy Render, pas du client.

⇒ **Un unique compteur de 10 requêtes / 60 s partagé par l'ensemble des utilisateurs.**
Les rustines présentes dans le code le confirment : `@Throttle(90, 60)` sur les endpoints `pending*`,
et côté client `pendingRateLimitCooldownMs = 8_000` avec gestion explicite du 429
(`lib/sendProutBackend.ts:186`). On soigne le symptôme depuis des mois.

**Vérification prod**
```bash
for i in $(seq 1 15); do curl -s -o /dev/null -w "%{http_code} " \
  -X POST https://prout-backend.onrender.com/prout -H "x-api-key: <clé>" -d '{}'; done
# attendu si le diagnostic est bon : 401/400 … puis 429 à partir de la 11e
```
*(à jouer avec une clé de test après rotation, pas en production)*

### SRE-02 — 6 secondes bloquantes par accusé de lecture **[PROUVÉ-STATIQUE]**
```ts
// prout.service.ts:1452-1455
await new Promise(resolve => setTimeout(resolve, 1000));
await new Promise(resolve => setTimeout(resolve, 5000));
const { error } = await supabase.from('pending_messages').delete().eq('id', messageId)…
```
Deux attentes cumulées. Chaque `/prout/read` immobilise une connexion HTTP 6 s.
Sur le plan free Render (0.1 CPU / 512 Mo), quelques dizaines de requêtes concurrentes suffisent à saturer.
C'est aussi un **DoS à coût nul** (SEC-02 permet de les déclencher sans compte).

### SRE-03 — Aucune télémétrie **[PROUVÉ-STATIQUE]**
Pas de Sentry (absent de `package.json` malgré `docs/guides/SETUP_SENTRY.md`), pas de métriques,
pas d'alerte, pas de healthcheck externe. L'`AppErrorBoundary` (`app/_layout.tsx:59-77`) fait un
`console.error` **jamais collecté**, et affiche un cul-de-sac sans bouton.
Le seul « log » du dépôt est un dump logcat de décembre 2025 (5,5 Mo) contenant **zéro
`FATAL EXCEPTION`** applicative — autrement dit **on n'a aucune donnée sur les crashes réels**.
Les logs Render n'ont pas pu être consultés (pas d'accès CLI/API dans cette session).

### SRE-04 — Plan Render *free* = SPOF pour une app de notifications **[PROUVÉ-OUTIL]**
```
$ curl https://prout-backend.onrender.com/    → {"status":"ok"}  577 ms puis 220 ms  (service chaud)
```
Le plan free met le service en veille après ~15 min d'inactivité ; le réveil prend 30-60 s.
Pendant ce temps, **tout envoi de prout échoue ou timeout**. Pour une app dont la proposition de valeur
est l'instantanéité, c'est structurel. Aucun *health ping* n'est configuré.

### SRE-05 — Pas d'idempotence, pas de file durable **[PROUVÉ-STATIQUE]**
`sendProut` n'accepte aucune clé d'idempotence ; `offlineService.processQueue()` retente en boucle
toutes les 15 s. Un timeout côté client sur un envoi qui a en réalité abouti ⇒ **doublon** en base et
double notification. Le broadcast est déjà envoyé **3 fois** volontairement (T0, +500 ms, +1,5 s) pour
compenser l'absence de garantie de livraison.

### SRE-06 — Schéma non versionné **[PROUVÉ-STATIQUE]**
40 fichiers SQL, dont 6 variantes concurrentes des triggers `friends`
(`_triggers`, `_triggers_fixed`, `_triggers_final`, `_triggers_CORRIGE`, `_triggers_debug`, `_complete`)
et 3 variantes de la RLS `user_profiles`. **Rien n'indique laquelle est appliquée en production.**
`pending_messages` n'a même pas de `CREATE TABLE` dans le dépôt (créée à la main dans le dashboard).
⇒ Impossible de reconstruire l'environnement, impossible de raisonner sur la sécurité sans se connecter.

---

## 3.4 PERFORMANCE

| ID | Constat | Preuve | Coût |
|---|---|---|---|
| PERF-01 | **N+1 séquentiel** sur l'appariement des contacts : par contact matché, 2 `SELECT` (`relationExists`) puis 2 `UPSERT` (`addFriendBothWays`), **en série** dans un `for…of` | `friends.service.ts:93-112` | 200 contacts ⇒ ~800 aller-retours séquentiels ⇒ plusieurs dizaines de secondes, requête qui timeout |
| PERF-02 | `.in('phone', phoneNumbers)` **non borné** + **aucun index sur `user_profiles(phone)`** | `friends.service.ts:19` + aucun `CREATE INDEX` sur `phone` dans les 40 migrations | scan séquentiel de toute la table à chaque import de carnet d'adresses |
| PERF-03 | **Polling 5 s redondant** avec le Realtime tant qu'un chat est ouvert, en plus du polling `offlineService` toutes les 15 s (permanent, même déconnecté) et d'un `setInterval` de vibration toutes les 6 s | `FriendsList.tsx:1243`, `offlineService.ts:22`, `AppHeader.tsx:90` | ~24 req/min/utilisateur, à confronter à SRE-01 |
| PERF-04 | Un **canal Realtime créé + souscrit + détruit à chaque message** côté serveur (5 occurrences), avec `setTimeout(removeChannel, 5000)` | `prout.service.ts:877, 1440, 1481, 1568, 1643` | une connexion WebSocket par message ; sous charge, fuite de connexions |
| PERF-05 | Index manquants sur les colonnes de policy : `pending_messages(to_user_id)`, `(from_user_id)`, `friends(user_id)` — seuls `interaction_logs` et `friends.last_interaction_at` sont indexés | grep `CREATE INDEX` sur les 40 migrations | la doc Supabase mesure jusqu'à **99,94 %** de gain avec ces index (§8) |
| PERF-06 | `auth.uid()` **non enveloppé** dans un `select` dans toutes les policies | toutes les migrations | jusqu'à **99,99 %** de gain selon la doc Supabase (§8) — réécriture mécanique |
| PERF-07 | `FriendsList.tsx` : 4 538 lignes, **43 `useEffect`**, 35 `useMemo/useCallback`, un `@ts-ignore` sur `<FlashList>` avec `estimatedItemSize` (ignoré par FlashList v2) | `FriendsList.tsx:3747-3757` | rendus en cascade impossibles à raisonner |

---

## 3.5 RGPD / CONFORMITÉ

| ID | Constat | Article concerné |
|---|---|---|
| RGPD-01 | Annuaire complet (téléphones inclus) lisible par tout compte — SEC-04 | art. 32 (sécurité) + art. 33/34 (notification de violation si exploité) |
| RGPD-02 | Correspondances interceptables en temps réel par un tiers — SEC-07 | art. 32 + secret des correspondances |
| RGPD-03 | Chiffrement des messages **désactivé** : `MESSAGE_ENCRYPTION_ENABLED` et `MESSAGE_ENCRYPTION_KEY` absents de `backend/.env` ; le code retourne alors le texte en clair (`prout.service.ts:514`) **[À CONFIRMER-PROD : vérifier les variables Render]** | art. 32 |
| RGPD-04 | Amitié bidirectionnelle créée **sans consentement** du destinataire — SEC-06 | art. 6 (base légale) |
| RGPD-05 | Rétention non automatisée : `supabase_purge_old_pending_messages.sql` est un script **manuel**, la purge à 7 jours est **commentée**, aucun `pg_cron` | art. 5.1.e (limitation de conservation) |
| RGPD-06 | Numéros de téléphone du carnet d'adresses **transmis en clair** au backend, sans hachage. L'état de l'art (Signal, WhatsApp) utilise des identifiants hachés/tronqués ou du PSI | art. 5.1.c (minimisation) |
| RGPD-07 | `delete_user_account()` supprime `friends`, `invitations`, `pending_messages`, `interaction_logs`, `user_profiles`, `auth.users` — mais **pas explicitement** `reports`, `blocked_users`, `identity_reveals`, `message_reactions` (dépend de `ON DELETE CASCADE`, non vérifiable depuis le dépôt) | art. 17 (effacement) |
| RGPD-08 | Contenu des messages mis en cache **en clair** dans AsyncStorage (`CACHE_KEY_LAST_SENT_MESSAGES`, `chatStore` persisté) | art. 32 |

---

## 3.6 UX / ACCESSIBILITÉ

| ID | Constat | Preuve |
|---|---|---|
| UX-01 | **307 `Alert.alert`** — dialogue modal bloquant natif pour la moindre confirmation | `grep -c` sur app/ components/ lib/ |
| UX-02 | **17** attributs `accessibilityLabel/Role/accessible` pour 37 300 lignes ⇒ VoiceOver/TalkBack inutilisables | grep |
| UX-03 | `bypassDnd: true` sur **tous** les canaux Android (36 canaux) + `importance: MAX` : l'app force le passage à travers « Ne pas déranger » | `lib/notifications.ts:57-60` |
| UX-04 | Écran d'erreur ultime = cul-de-sac : « Oups… Une erreur est survenue. Relance l'app. » sans bouton | `app/_layout.tsx:66-72` |
| UX-05 | Échecs silencieux : BUG-02 renvoie à l'écran de connexion sans message ; `markMessageReadViaBackend` avale les erreurs (`console.warn` puis `return true`) | `sendProutBackend.ts:80-88` |
| UX-06 | 11 `hitSlop` seulement ; aucune vérification des cibles tactiles ≥ 48 dp | grep |

---

## 3.7 QUALITÉ / DEVEX

| ID | Constat |
|---|---|
| DEV-01 | **252 erreurs TypeScript**, masquées : `"type-check": "tsc --noEmit … || true"` — le `|| true` garantit un code de sortie 0 |
| DEV-02 | `class-validator` et `class-transformer` sont **installés** côté backend et **jamais utilisés** : tous les handlers sont en `@Body() body: any` |
| DEV-03 | **0 test**, **0 CI**. Aucun garde-fou avant publication sur les stores |
| DEV-04 | 464 `console.*` en production, sans `babel-plugin-transform-remove-console` |
| DEV-05 | 192 `: any` dans le code applicatif |
| DEV-06 | Versions en fin de vie : NestJS **9** (EOL), `@nestjs/throttler` **3** (API `@Throttle(limit, ttl)` positionnelle, remplacée en v5+), `firebase-admin` **11** côté backend contre **13** côté app |
| DEV-07 | Ballast Git : `android/.gradle/*.bin` (**29 Mo**) et `logs/crash_logs_android.txt` (5,5 Mo) versionnés ; ~800 Mo de `.aab`/`.ipa` dans le répertoire de travail |
| DEV-08 | Le dépôt backend est **imbriqué** dans le dépôt app (`backend/.git`) sans submodule : deux historiques indépendants, aucun lien de version entre client et serveur |

---

# PARTIE 4 — PLANS D'EXÉCUTION

> Cinq chantiers, ordonnés par dépendance. Aucun n'est appliqué.
> Chaque chantier : **objectif · préalables · étapes · code proposé · tests · rollback · risques**.

---

## CHANTIER A — Confinement immédiat (24-48 h, aucune modification de code applicatif)

**Objectif** : rendre inopérants les secrets exposés, sans casser les clients déjà installés
(v1.1.39 est en production : toute rupture d'API met les utilisateurs hors service).

### A1. Rotation des secrets
| Secret | Où | Action |
|---|---|---|
| Service account Firebase | Console Firebase > Paramètres > Comptes de service | **Générer une nouvelle clé**, mettre à jour `FIREBASE_SERVICE_ACCOUNT_JSON` sur Render, puis **supprimer l'ancienne clé** |
| `SUPABASE_SERVICE_ROLE_KEY` | Dashboard Supabase > API | Rotation, mise à jour sur Render **uniquement** |
| `SUPABASE_WEBHOOK_SECRET` | Render + webhook Supabase | Rotation simultanée des deux côtés |
| `RESEND_API_KEY` | Dashboard Resend | Rotation |
| `API_KEY` backend | Render + Edge Function | **Voir A3 : rotation en deux temps obligatoire** |

### A2. Nettoyage du dépôt backend
```bash
# PROPOSÉ — à exécuter dans backend/, après avoir prévenu tous les collaborateurs
printf 'FIREBASE_SERVICE_ACCOUNT_ONE_LINE.txt\n*.json.key\nrender.yaml.local\n' >> .gitignore
git rm --cached FIREBASE_SERVICE_ACCOUNT_ONE_LINE.txt
pipx run git-filter-repo --path FIREBASE_SERVICE_ACCOUNT_ONE_LINE.txt --invert-paths
git push --force-with-lease origin main
```
Et dans `render.yaml`, retirer la valeur :
```yaml
# PROPOSÉ
      - key: API_KEY
        sync: false          # valeur saisie dans le dashboard Render, jamais dans le YAML
```
> ⚠️ **Piège** : `git-filter-repo` réécrit tous les SHA. Le dépôt étant imbriqué dans celui de l'app
> (DEV-08), vérifier qu'aucune CI ni aucun clone tiers ne pointe sur les anciens commits.
> **La rotation (A1) reste obligatoire même après réécriture** : l'ancien objet peut subsister dans un
> clone, un fork, ou le cache GitHub.

### A3. Rotation de l'`API_KEY` **en deux temps** (sinon coupure de service)
`lib/matchContactsBackend.ts` embarque la clé dans **l'app déjà installée**. Changer la clé d'un coup
casse l'appariement des contacts pour tous les utilisateurs jusqu'à leur mise à jour.

```ts
// PROPOSÉ — backend, période de transition
const validKeys = [process.env.API_KEY, process.env.API_KEY_LEGACY].filter(Boolean);
if (!apiKey || !validKeys.includes(apiKey)) throw new UnauthorizedException('Invalid API key');
```
Séquence : `API_KEY` = nouvelle clé (connue de la seule Edge Function) + `API_KEY_LEGACY` = ancienne →
publier la version client qui n'utilise plus la clé (CHANTIER B) → **supprimer `API_KEY_LEGACY`** une fois
le parc migré (suivi via la répartition des versions dans les consoles Play/App Store).

### A4. Correctifs SQL immédiats (sans impact client)
```sql
-- PROPOSÉ — 1. Index manquants (aucun risque, gain immédiat)
create index concurrently if not exists idx_user_profiles_phone      on public.user_profiles (phone);
create index concurrently if not exists idx_pending_messages_to      on public.pending_messages (to_user_id);
create index concurrently if not exists idx_pending_messages_from_to on public.pending_messages (from_user_id, to_user_id);
create index concurrently if not exists idx_friends_user_id          on public.friends (user_id);
create index concurrently if not exists idx_friends_friend_id        on public.friends (friend_id);

-- PROPOSÉ — 2. search_path sur les SECURITY DEFINER (à répéter pour chaque fonction)
alter function public.delete_user_account()        set search_path = public, pg_temp;
alter function public.update_friend_interaction(uuid, uuid, timestamptz) set search_path = public, pg_temp;

-- PROPOSÉ — 3. Rétention automatique (RGPD-05)
create extension if not exists pg_cron;
select cron.schedule('purge-pending-messages', '0 3 * * *', $$
  delete from public.pending_messages where created_at < now() - interval '7 days';
$$);
```
> ⚠️ **Piège** : `create index concurrently` ne peut pas tourner dans une transaction — l'exécuter
> ligne par ligne dans l'éditeur SQL Supabase.
> ⚠️ **Piège** : avant d'activer la purge à 7 jours, vérifier la fonctionnalité « messages sauvegardés »
> (commit `0b95656`) : si la sauvegarde est **locale** (AsyncStorage via `chatStore`), la purge serveur
> est sans effet sur elle — c'est le cas d'après le code, mais à confirmer.

### A5. Correctif `markMessageRead` (SEC-03) — 3 lignes, aucun impact client
```ts
// PROPOSÉ — prout.service.ts, signature inchangée pour ne rien casser
async markMessageRead(messageId: string, senderId: string, callerId?: string) {
  const { data: msg } = await supabase.from('pending_messages')
    .select('message_content, to_user_id, from_user_id')
    .eq('id', messageId)
    .eq('to_user_id', callerId ?? undefined)   // ← borne à l'identité vérifiée (cf. CHANTIER B)
    .single();
```
En attendant l'identité vérifiée du CHANTIER B, un garde-fou intermédiaire immédiat :
`.eq('from_user_id', senderId)` — `senderId` est déjà transmis et **doit** correspondre à l'expéditeur
du message ciblé. Cela ferme la suppression arbitraire (il faut connaître la paire messageId + senderId),
sans rien changer côté client.

### Validation du chantier A
- [ ] Firebase : ancienne clé supprimée, un push de test part toujours.
- [ ] `git log --all -- FIREBASE_SERVICE_ACCOUNT_ONE_LINE.txt` ne renvoie plus rien.
- [ ] `explain analyze select … from user_profiles where phone in (…)` utilise l'index.
- [ ] Un `POST /prout/read` avec un `messageId` valide mais un `senderId` étranger renvoie une erreur.

---

## CHANTIER B — Rétablir l'identité serveur (le cœur du sujet, 1-2 semaines)

**Objectif** : que le serveur sache **qui** parle, et n'accepte plus jamais un identifiant d'utilisateur
venant du client.

### B1. Durcir l'Edge Function — elle devient le point d'ancrage de l'identité

```ts
// PROPOSÉ — supabase/functions/prout-proxy/index.ts (réécriture complète)
import { createClient } from "jsr:@supabase/supabase-js@2";

const BACKEND = "https://prout-backend.onrender.com";
const ALLOWED_ROUTES = new Set([
  "", "/read", "/readMany", "/readConversation", "/purge", "/edit",
  "/pendingReceived", "/pendingSent",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST")    return json({ error: "method_not_allowed" }, 405);

  // 1) Identité VÉRIFIÉE (et pas seulement « un header est présent »)
  const jwt = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const { data: { user }, error } = await admin.auth.getUser(jwt);
  if (error || !user) return json({ error: "unauthorized" }, 401);   // ← la clé anon échoue ici

  // 2) Allow-list de routes (empêche le path traversal vers un autre endpoint)
  const route = new URL(req.url).pathname.replace("/prout-proxy", "");
  if (!ALLOWED_ROUTES.has(route)) return json({ error: "not_found" }, 404);

  // 3) Réécriture serveur des identifiants : le client ne décide plus de qui il est
  const body = await req.json().catch(() => ({}));
  const safeBody = {
    ...body,
    senderId: user.id,
    userId:   user.id,
    extraData: { ...(body.extraData ?? {}), senderId: user.id },
  };

  const res = await fetch(`${BACKEND}/prout${route}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": Deno.env.get("BACKEND_API_KEY")!,
      "x-verified-user-id": user.id,        // ← source de vérité pour le backend
    },
    body: JSON.stringify(safeBody),
  });
  return new Response(await res.text(), { status: res.status, headers: { ...cors, "Content-Type": "application/json" } });
});
```
> ⚠️ **Piège n°1** : `purge` et `readConversation` prennent **deux** identifiants (`userId` + `friendId`,
> `senderId` + `receiverId`). Écraser aveuglément `senderId` casse `readConversation`, où `senderId`
> désigne… l'expéditeur des messages qu'on marque comme lus, c'est-à-dire **l'ami**, pas l'appelant.
> **Il faut auditer la sémantique de chaque endpoint avant d'écraser quoi que ce soit** — c'est le point
> le plus délicat de tout le chantier. Recommandation : introduire un champ distinct `actorId`
> (toujours = utilisateur vérifié) et **laisser** `senderId`/`receiverId` décrire la conversation, puis
> vérifier côté backend que `actorId ∈ {senderId, receiverId}`.
>
> ⚠️ **Piège n°2** : `getUser()` ajoute un aller-retour réseau. Alternative : vérifier le JWT localement
> via `SUPABASE_JWKS` (pas d'appel réseau), au prix de la non-détection des révocations. Pour ce volume,
> `getUser()` suffit.
>
> ⚠️ **Piège n°3** : `/friends/match-contacts` n'est **pas** derrière le proxy aujourd'hui. Il faut l'y
> ajouter *et* publier une version client qui l'utilise, sinon l'appariement des contacts casse.

### B2. Backend — un garde-fou, des DTO, et l'interdiction des identifiants clients

```ts
// PROPOSÉ — backend/src/common/verified-user.guard.ts
@Injectable()
export class VerifiedUserGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    if (req.headers['x-api-key'] !== process.env.API_KEY) throw new UnauthorizedException();
    const userId = req.headers['x-verified-user-id'];
    if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) throw new UnauthorizedException('missing verified identity');
    req.actorId = userId;      // seule source d'identité autorisée dans les services
    return true;
  }
}
```
```ts
// PROPOSÉ — backend/src/prout/dto/send-prout.dto.ts
export class SendProutDto {
  @IsString() @IsNotEmpty()               token: string;
  @IsString() @Length(1, 40)              sender: string;
  @IsIn(VALID_PROUTS)                     proutKey: string;
  @IsOptional() @IsIn(['ios','android'])  platform?: 'ios' | 'android';
  @IsOptional() @IsString() @MaxLength(500) customMessage?: string;
  @IsUUID() receiverId: string;
  // senderId volontairement ABSENT : il vient de req.actorId
}
```
```ts
// PROPOSÉ — main.ts
app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
app.set('trust proxy', 1);          // cf. CHANTIER C
```
> ⚠️ **Piège** : `forbidNonWhitelisted: true` **rejette** toute propriété inconnue. Les clients v1.1.39
> envoient `senderId`, `extraData`, `platform`… ⇒ **400 pour tout le parc installé**.
> Déployer d'abord avec `whitelist: true` seul (les champs inconnus sont silencieusement retirés), et
> n'activer `forbidNonWhitelisted` qu'après migration du parc. **C'est le piège qui casse la production.**

### B3. Vérification du blocage côté serveur (SEC-09)
```ts
// PROPOSÉ — prout.service.ts, tout début de sendProut
const { data: block } = await supabase
  .from('blocked_users')
  .select('id')
  .or(`and(blocker_id.eq.${receiverId},blocked_user_id.eq.${actorId}),` +
      `and(blocker_id.eq.${actorId},blocked_user_id.eq.${receiverId})`)
  .limit(1);
if (block?.length) return { success: true, delivered: false };   // échec silencieux volontaire
```
> ⚠️ **Piège** : ne **jamais** renvoyer « vous êtes bloqué » — cela transformerait l'API en oracle de
> blocage et exposerait la victime. On renvoie un succès factice, comme le font les messageries.
> ⚠️ **Piège** : une requête supplémentaire par envoi. La table est petite et indexée
> (`blocked_users_blocker_idx`) ; mesurer, et si besoin mettre en cache 60 s par paire.

### B4. Refonte de `match-contacts` (SEC-06 + PERF-01/02 + RGPD-06)
```ts
// PROPOSÉ — friends.service.ts : appariement en 3 requêtes au lieu de 4N
async addContactsMatches(actorId: string, phoneNumbers: string[]) {
  const phones = [...new Set(phoneNumbers.map(normalizeE164).filter(Boolean))].slice(0, 1000); // borné
  const { data: matches } = await supabase
    .from('user_profiles').select('id, pseudo').in('phone', phones);   // ← plus de `phone` renvoyé
  const others = (matches ?? []).filter(u => u.id !== actorId);
  if (!others.length) return [];

  const { data: existing } = await supabase
    .from('friends').select('friend_id').eq('user_id', actorId)
    .in('friend_id', others.map(u => u.id));                          // ← 1 requête au lieu de 2N
  const known = new Set((existing ?? []).map(r => r.friend_id));

  const rows = others.filter(u => !known.has(u.id)).flatMap(u => ([
    { user_id: actorId, friend_id: u.id, method: 'contact', status: 'accepted' }, // moi → lui : OK
    { user_id: u.id, friend_id: actorId, method: 'contact', status: 'pending'  }, // lui → moi : EN ATTENTE
  ]));
  if (rows.length) await supabase.from('friends').upsert(rows, { onConflict: 'user_id,friend_id' }); // 1 requête
  return others.filter(u => !known.has(u.id)).map(u => ({ id: u.id, pseudo: u.pseudo }));
}
```
> ⚠️ **Piège** : passer le sens retour en `pending` **change le comportement de l'app**. La policy
> SELECT sur `friends` filtre sur `status = 'accepted'` : un `pending` **n'apparaîtra pas** dans la liste
> du destinataire tant que l'UI d'acceptation n'existe pas. Il faut donc livrer **en même temps** l'écran
> « X vous a ajouté via ses contacts — Accepter / Ignorer » (l'écran `Invitation.tsx` existe déjà et peut
> servir de base), sinon des amitiés deviennent invisibles.
> ⚠️ **Piège** : `upsert` avec `onConflict: 'user_id,friend_id'` **écrase** un `status` existant.
> Utiliser `ignoreDuplicates: true` ou un `insert … on conflict do nothing` pour ne pas rétrograder une
> amitié déjà acceptée.

### B5. RLS `user_profiles` en moindre privilège (SEC-04)
```sql
-- PROPOSÉ
drop policy if exists "Enable read access for authenticated users" on public.user_profiles;
drop policy if exists "Users can read public profiles"             on public.user_profiles;

create policy "read own profile" on public.user_profiles
  for select to authenticated using ((select auth.uid()) = id);

create policy "read profiles of accepted friends" on public.user_profiles
  for select to authenticated using (
    id in (select friend_id from public.friends
           where user_id = (select auth.uid()) and status = 'accepted')
  );

-- La recherche d'utilisateur passe par une RPC qui ne renvoie JAMAIS le téléphone ni le jeton push
create or replace function public.search_users(q text)
returns table (id uuid, pseudo text, avatar_url text)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.id, p.pseudo, p.avatar_url
  from public.user_profiles p
  where p.pseudo ilike q || '%'          -- préfixe uniquement : pas de balayage total
    and length(q) >= 3                   -- longueur minimale : anti-énumération
    and p.id <> (select auth.uid())
  limit 20;
$$;
revoke all on function public.search_users(text) from public;
grant execute on function public.search_users(text) to authenticated;
```
> ⚠️ **Piège majeur** : c'est le changement le plus risqué du plan. Il faut d'abord **inventorier tous
> les `.from('user_profiles')` du client** (`grep -rn "from('user_profiles')" app lib components`) et
> vérifier, un par un, que chacun reste couvert par les nouvelles policies. Les lectures de profil d'un
> **non-ami** (recherche, invitation, écran de révélation d'identité) casseront et devront passer par la RPC.
> **Procédure obligatoire : appliquer sur une base de préproduction (branche Supabase), rejouer les
> parcours, puis seulement produire.**
> ⚠️ **Piège** : le backend utilise la `service_role` et **n'est pas affecté** par ces policies —
> ne pas s'en servir comme test de non-régression.

### B6. Canaux Realtime privés (SEC-07)
```sql
-- PROPOSÉ
create policy "receive own room broadcasts" on realtime.messages
  for select to authenticated
  using ( realtime.topic() = 'room-' || (select auth.uid())::text
          and extension = 'broadcast' );
-- aucune policy INSERT pour `authenticated` : seul le backend (service_role) émet.
```
```ts
// PROPOSÉ — des DEUX côtés, sinon rien ne fonctionne
const channel = supabase.channel(`room-${userId}`, { config: { private: true } });
```
> ⚠️ **Piège n°1 — RUPTURE DE COMPATIBILITÉ TOTALE** : dès que « Allow public access » est désactivé,
> **tous les clients v1.1.39 déjà installés perdent le temps réel** (ils s'abonnent en public).
> Séquence obligatoire : (1) publier un client qui s'abonne en `private: true` ; (2) attendre que le parc
> soit migré (suivi Play/App Store) ; (3) *seulement ensuite* désactiver l'accès public.
> Prévoir un mécanisme de mise à jour forcée (l'écran « Vérifier la mise à jour » existe déjà : clé i18n
> `check_for_updates`).
> ⚠️ **Piège n°2** : sur un canal privé, le socket Realtime doit porter un JWT à jour. Après un refresh
> de token, appeler `supabase.realtime.setAuth()` (supabase-js le fait sur `onAuthStateChange`, à vérifier
> pour la version utilisée). Symptôme typique : le temps réel marche 1 h puis s'arrête.
> ⚠️ **Piège n°3** : le client fait **confiance au contenu** du broadcast (`payload.m_d` inséré tel quel
> dans le store). Même en privé, considérer le broadcast comme un **signal** (« va recharger »), pas comme
> une source de vérité. C'est aussi ce qui permettra de supprimer le contenu du message du payload.

### B7. Chiffrement des messages (RGPD-03)
Le code est déjà écrit et rétro-compatible : `decryptMessageContent` renvoie le texte tel quel s'il ne
commence pas par `ENCv1:`. Il suffit de définir sur Render :
```
MESSAGE_ENCRYPTION_ENABLED=true
MESSAGE_ENCRYPTION_KEY=<32+ octets aléatoires>
```
> ⚠️ **Piège** : `getEncryptionKey()` fait `sha256(secret)` — pas un KDF. Acceptable si le secret est
> déjà de l'aléa fort ; **inacceptable** si c'est une phrase de passe. Générer avec `openssl rand -base64 48`.
> ⚠️ **Piège** : la perte de la clé rend **tous** les messages illisibles (pas de récupération possible).
> La sauvegarder dans un gestionnaire de secrets avant activation.
> ⚠️ **Piège** : le préfixe `READ:` est ajouté **devant** le blob chiffré, et `purgeChat` filtre avec
> `.like('message_content', 'READ:%')` — ça continue de fonctionner. Mais toute future manipulation du
> contenu en SQL (recherche, tri, statistiques) deviendra impossible. C'est le prix à payer, et c'est le bon prix.

---

## CHANTIER C — Fiabilité et performance (1 semaine, en parallèle de B)

### C1. Rate limiting par utilisateur, plus par IP (SRE-01)
```ts
// PROPOSÉ — backend/src/common/user-throttler.guard.ts
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): string {
    return req.headers['x-verified-user-id'] ?? req.ips?.[0] ?? req.ip;  // identité d'abord
  }
}
```
+ `app.set('trust proxy', 1)` dans `main.ts` (recommandation officielle NestJS, §8).
Quotas proposés : `sendProut` 30/min/utilisateur ; `pending*` 60/min ; `purge`/`edit` 10/min.
> ⚠️ **Piège** : le stockage par défaut du throttler est **en mémoire du process**. Sur Render,
> un redémarrage (fréquent en free) remet tous les compteurs à zéro, et le passage à 2 instances
> divise l'efficacité par 2. Pour faire les choses correctement : `@nest-lab/throttler-storage-redis`
> ou une table Postgres. Acceptable en l'état pour la v1, à documenter comme dette assumée.

### C2. Supprimer les 6 secondes bloquantes (SRE-02) — **attention, changement de sémantique**
Le `sleep(6 s)` n'est pas gratuit : il laisse au client expéditeur le temps de venir constater l'état
`READ:` **avant** que la ligne ne soit détruite. Supprimer l'attente sans rien d'autre ⇒ **l'accusé de
lecture ne s'affichera plus jamais**.

**Plan correct, en 3 temps :**
```sql
-- PROPOSÉ — 1. Un état explicite plutôt qu'un préfixe dans le texte
alter table public.pending_messages add column if not exists read_at timestamptz;
create index if not exists idx_pending_messages_read_at on public.pending_messages (read_at);
-- migration des données existantes
update public.pending_messages set read_at = now()
 where message_content like 'READ:%' and read_at is null;
```
```ts
// PROPOSÉ — 2. Le endpoint marque et rend la main immédiatement
await supabase.from('pending_messages')
  .update({ read_at: new Date().toISOString() })
  .eq('id', messageId).eq('to_user_id', actorId);
await this.broadcastRead(senderId, messageId);
return { success: true };                       // 6 s → ~50 ms
```
```sql
-- PROPOSÉ — 3. La destruction devient asynchrone (pg_cron, toutes les 5 minutes)
select cron.schedule('purge-read-messages', '*/5 * * * *', $$
  delete from public.pending_messages where read_at < now() - interval '10 minutes';
$$);
```
> ⚠️ **Piège** : le client parse `READ:` à plusieurs endroits (`parseMessageContent` dans `chat.tsx:148`,
> `FriendsList`, `purgeChat` côté backend). Tant que le parc n'est pas migré, il faut **écrire les deux**
> (préfixe `READ:` **et** `read_at`) pendant une version, puis retirer le préfixe.

### C3. Receipts Expo (BUG-04)
```ts
// PROPOSÉ — stocker les ticket ids, puis les relire ~15 min plus tard
// 1) à l'envoi : insert into push_tickets (ticket_id, user_id, token, created_at)
// 2) tâche périodique :
const chunks = expo.chunkPushNotificationReceiptIds(ids);
for (const chunk of chunks) {
  const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
  for (const [id, r] of Object.entries(receipts)) {
    if (r.status === 'error' && r.details?.error === 'DeviceNotRegistered') {
      await supabase.from('user_profiles')
        .update({ expo_push_token: null, push_platform: null })
        .eq('expo_push_token', tokenOf(id));      // service_role : pas de blocage RLS
    }
  }
}
```
> ⚠️ **Piège** : sur Render free, le service dort. Un `setInterval` dans le process ne s'exécutera pas
> de manière fiable. Utiliser un **Cron Job Render** (payant) ou un `pg_cron` Supabase qui appelle une
> Edge Function. Ne pas se reposer sur un timer applicatif.

### C4. Corriger le déduplicage de jeton (BUG-03)
La requête ne peut pas passer sous RLS. Deux options :
- **(a)** contrainte `unique (expo_push_token)` en base + `on conflict` qui bascule le jeton sur le
  nouveau profil (nettoyage garanti par le moteur) ;
- **(b)** une RPC `security definer` `claim_push_token(token text)` qui efface le jeton partout ailleurs
  puis l'attribue à `auth.uid()`.
**Recommandation : (b)**, plus explicite et auditable.
> ⚠️ **Piège** : `unique` sur une colonne où `null` est fréquent est acceptable en Postgres (les `null`
> ne se conflictent pas), mais les jetons Expo peuvent changer à la réinstallation : prévoir
> `on conflict (expo_push_token) do update`.

### C5. Réduire la charge client (PERF-03)
- Supprimer le polling 5 s dès que le Realtime est fiable (chantier B6) ; le remplacer par un
  **refetch au retour au premier plan** + un filet de sécurité toutes les 60 s.
- `offlineService` : ne démarrer l'intervalle **que si la file est non vide**, et l'arrêter dès qu'elle
  se vide (aujourd'hui il tourne indéfiniment, même déconnecté).
- Vibration du header : `setInterval` 6 s permanent → à conditionner à la visibilité de l'écran.

---

## CHANTIER D — Bugs client (2-3 jours, très haut rapport valeur/effort)

### D1. `app/index.tsx` (BUG-02)
```ts
// PROPOSÉ — ligne 1
import * as Notifications from 'expo-notifications';
```
> ⚠️ **Piège** : `getPermissionsAsync()` est asynchrone et se trouve sur le **chemin critique du
> démarrage**, quatre fois. Mieux : lire une seule fois, en amont, et mémoriser le résultat.
> Bien vérifier que l'app se comporte correctement quand le statut est `denied` (aujourd'hui, seul
> `undetermined` est traité ; `denied` tombe dans le `else` qui va vers `CompleteProfileScreen`, ce qui
> est probablement le comportement voulu, mais ce n'est écrit nulle part).

### D2. `app/chat.tsx` (BUG-01)
Déplacer les déclarations d'état et de callbacks **avant** leurs consommateurs :
`sentMessages` (l. 272) avant `handleMessageEdited` (l. 228) ; `replaceReactionForMessage` (964),
`removeReactionForMessage` (978), `isReactionForCurrentConversation` (1016),
`loadConversationReactions` (1027) avant les `useFocusEffect` des lignes 618-790.
> ⚠️ **Piège** : ne **pas** contourner avec des `useRef` ou des `// @ts-expect-error`. L'ordre de
> déclaration est la seule correction juste. Après déplacement, revérifier que les dépendances des hooks
> restent exhaustives (activer `react-hooks/exhaustive-deps` en erreur sur ce fichier).
> ⚠️ **Piège** : 2 025 lignes dans un seul composant ⇒ le risque de régression au déplacement est réel.
> Faire ce déplacement **seul**, dans un commit isolé, et tester le parcours chat de bout en bout.

### D3. `type-check` qui échoue vraiment
```jsonc
// PROPOSÉ — package.json
"type-check": "tsc --noEmit --skipLibCheck",      // suppression du « || true »
```
et `tsconfig.json` : exclure `temp_restore`, `dist`, `backend`, `**/*.backup.tsx`.
Cela ramène mécaniquement les 252 erreurs à ~150, dont ~40 sont de vrais défauts.
> ⚠️ **Piège** : ne pas activer la CI bloquante avant d'avoir traité les erreurs, sinon plus rien ne
> peut être publié. Ordre : exclure le code mort → corriger les erreurs de correction (TS2448/TS18047
/TS2552) → activer le blocage → traiter le reste au fil de l'eau.

### D4. Ménage
`app/index copie.tsx`, `components/FriendsList.backup.tsx`, `components/FriendsList_baaack.tsx`,
`temp_restore/`, `lib/_archives notifications copie.ts`, doublons `.js`, `lib/supabase.js`,
`backend/dist/`, `android/.gradle/*.bin`, `logs/crash_logs_android.txt`.
> ⚠️ **Piège** : supprimer `lib/supabase.js` **après** avoir vérifié qu'aucun import ne le vise
> explicitement (`grep -rn "supabase.js"`). Il est déjà dans `.gitignore` mais **présent sur le disque**.

---

## CHANTIER E — Socle durable (continu)

1. **Sentry** (front + backend), avec `beforeSend` qui filtre les PII, et remontée explicite depuis
   `AppErrorBoundary` (aujourd'hui l'erreur meurt dans un `console.error`).
2. **CI GitHub Actions** : `tsc --noEmit` + `eslint` + build EAS de préproduction sur chaque PR.
3. **Tests** — commencer par ce qui protège vraiment : (a) un test d'intégration par endpoint backend
   qui vérifie **qu'un `actorId` étranger est refusé** ; (b) `normalizePhone` (table de cas par pays) ;
   (c) `parseMessageContent` / chiffrement (aller-retour).
4. **Schéma versionné** : `supabase db pull` pour figer l'état réel, puis migrations ordonnées, et
   suppression des 6 variantes concurrentes de triggers.
5. **Observabilité produit** : compteur d'envois, taux d'échec push, latence p95 — sinon impossible de
   savoir si les corrections fonctionnent.
6. **Découpage** de `FriendsList.tsx` (4 538 l.) et `prout.service.ts` (1 697 l.).
7. **UX** : remplacer progressivement les 307 `Alert.alert` par des retours non bloquants ;
   passe d'accessibilité (labels, cibles ≥ 48 dp, contraste, `fontScale`) ; retirer `bypassDnd: true`.

---

# PARTIE 5 — Les 12 pièges à ne surtout pas ignorer

| # | Piège | Conséquence si ignoré |
|---|---|---|
| 1 | Changer l'`API_KEY` d'un coup | L'appariement des contacts casse pour tout le parc installé (clé en dur dans l'app) |
| 2 | Activer `forbidNonWhitelisted` avant migration du parc | **400 sur toutes les requêtes** des clients v1.1.39 |
| 3 | Désactiver « Allow public access » Realtime avant migration | Temps réel mort pour tout le parc installé |
| 4 | Restreindre la RLS `user_profiles` sans RPC de remplacement | Recherche d'utilisateur, invitations et révélation d'identité cassées |
| 5 | Écraser `senderId` par l'appelant dans le proxy | `readConversation` inverse sa sémantique : mauvais messages marqués lus |
| 6 | Supprimer les `sleep` de `markMessageRead` sans colonne `read_at` | L'accusé de lecture ne s'affiche plus jamais |
| 7 | Passer l'amitié retour en `pending` sans écran d'acceptation | Des amitiés deviennent invisibles (policy filtrée sur `accepted`) |
| 8 | `upsert` avec `onConflict` sur `friends` | Rétrograde une amitié déjà acceptée |
| 9 | Activer le chiffrement sans sauvegarder la clé | **Perte définitive** de tous les messages |
| 10 | Renommer les canaux Android (v6 → v7) | Réinitialise les réglages son/vibration de tous les utilisateurs (déjà subi 5 fois : v2→v6) |
| 11 | `git filter-repo` sans rotation des secrets | Le secret survit dans les clones, forks et caches |
| 12 | CI bloquante avant d'avoir traité les 252 erreurs TS | Plus aucune publication possible |

---

# PARTIE 6 — Tests d'acceptation

**Sécurité** (chacun doit **échouer** après correction)
- [ ] `POST /functions/v1/prout-proxy` avec `Authorization: Bearer <ANON_KEY>` → **401**
- [ ] `POST …/prout` avec `senderId` d'un tiers → le message part au nom de **l'appelant**, pas du tiers
- [ ] `POST …/prout/pendingReceived` avec le `userId` d'un tiers → **403** ou liste vide
- [ ] `POST …/prout/read` avec le `messageId` d'un tiers → **403**, message **non supprimé**
- [ ] `select * from user_profiles` avec un JWT `authenticated` quelconque → **uniquement soi + amis**
- [ ] `supabase.channel('room-<uuid tiers>')` (public) → abonnement **refusé**
- [ ] Un utilisateur bloqué envoie un prout → **aucune notification** chez la victime
- [ ] `match-contacts` → la réponse ne contient **aucun** `phone`

**Fonctionnel (non-régression)**
- [ ] Appuyer sur le prénom d'un ami ouvre le chat **sans erreur** (BUG-01)
- [ ] Inscription Apple/Google → arrive sur la complétion de profil, **pas** sur l'écran de connexion (BUG-02)
- [ ] Envoi hors-ligne → mis en file → part au retour du réseau, **sans doublon**
- [ ] Accusé de lecture toujours visible après suppression des `sleep`
- [ ] Import de 500 contacts < 5 s
- [ ] Réinstallation sur un autre compte → l'ancien compte **ne reçoit plus** les notifications de ce device (BUG-03)

**Performance**
- [ ] p95 de `POST /prout` < 500 ms (hors cold start)
- [ ] 50 utilisateurs simultanés sans **aucun** 429

---

# PARTIE 7 — Questions ouvertes (décisions à prendre)

1. **Garder le backend NestJS ?** Tout ce qu'il fait (push, écriture DB, broadcast) tient dans 2-3 Edge
   Functions Supabase, avec l'identité vérifiée **nativement**, sans plan Render, sans cold start, sans
   `service_role` exposée à un tiers hébergeur, sans clé API partagée. Le coût de migration est réel
   (≈1 700 lignes, dont beaucoup de mapping de sons trivial à porter) mais **supprime SEC-01, SEC-02,
   SRE-01 et SRE-04 d'un seul coup**. C'est, à mon avis, la meilleure décision d'architecture disponible.
2. **Mise à jour forcée** : sans mécanisme de version minimale, les chantiers B6/B2 restent bloqués par
   le parc installé. À implémenter **avant** eux (l'écran existe déjà : `check_for_updates`).
3. **Hachage des numéros de téléphone** (RGPD-06) : passer à un appariement par hachage tronqué change
   le schéma et le parcours d'inscription. À arbitrer maintenant, car cela impacte le CHANTIER B4.
4. **`app/chat.tsx` vs chat intégré dans `FriendsList`** : deux implémentations de chat coexistent
   (2 025 l. + le chat déplié dans la liste). Laquelle est la cible ? Corriger BUG-01 dans un écran
   destiné à disparaître serait du gaspillage — mais le laisser planter n'est pas une option.
5. **Budget hébergement** : sans quitter le plan free Render, SRE-04 reste ouvert quoi qu'on corrige.

---

# PARTIE 8 — Références (vérifiées le 31/07/2026)

- Supabase — *Realtime Authorization* (canaux privés, RLS sur `realtime.messages`) :
  https://supabase.com/docs/guides/realtime/authorization
  → *« By default without RLS policies, public channels allow any client to broadcast and receive messages. »*
- Supabase — *Edge Functions : Auth* :
  https://supabase.com/docs/guides/functions/auth
  → *« An Authorization header alone is insufficient for security. The anon key is a valid JWT… »*
- Supabase — *RLS performance* (`(select auth.uid())`, index sur colonnes de policy, clause `TO`) :
  https://supabase.com/docs/guides/database/postgres/row-level-security
- Expo — *Sending Notifications* (tickets vs receipts, `DeviceNotRegistered`, 600 notif/s, batch de 100) :
  https://docs.expo.dev/push-notifications/sending-notifications/
  → *« You must check each push receipt… »*
- NestJS — *Rate Limiting* / `@nestjs/throttler` (proxies, `getTracker`, `trust proxy`) :
  https://docs.nestjs.com/security/rate-limiting · https://github.com/nestjs/throttler

---

# PARTIE 9 — Suivi d'avancement (à tenir à jour d'une session à l'autre)

| Chantier | Statut | Dernière mise à jour |
|---|---|---|
| A — Confinement | ⬜ non démarré | 31/07/2026 |
| B — Identité serveur | ⬜ non démarré | 31/07/2026 |
| C — Fiabilité/perf | ⬜ non démarré | 31/07/2026 |
| D — Bugs client | ⬜ non démarré | 31/07/2026 |
| E — Socle durable | ⬜ non démarré | 31/07/2026 |

**Prochaine action recommandée** : reproduire BUG-01 (30 secondes, sur device) — c'est le seul point du
document qui peut invalider une hypothèse, et c'est aussi le plus visible pour les utilisateurs.
Puis CHANTIER A (aucune modification de code applicatif, aucun risque de régression client).

**Vérifications à faire avec les accès (non disponibles dans la session du 31/07/2026)** :
```bash
render logs -s prout-backend --tail 500          # erreurs réelles en production
supabase functions list                          # verify_jwt de prout-proxy
```
```sql
select tablename, policyname, cmd, roles, qual from pg_policies where schemaname='public' order by 1,2;
select tablename, rowsecurity from pg_tables where schemaname='public';
select proname, prosecdef, proconfig from pg_proc where pronamespace = 'public'::regnamespace;
select count(*) from pending_messages;                                  -- volume résiduel
select count(*) from pending_messages where created_at < now() - interval '30 days';
```
+ Dashboard Render : présence de `MESSAGE_ENCRYPTION_ENABLED` / `MESSAGE_ENCRYPTION_KEY`.
+ Dashboard Supabase > Realtime > Settings : état de « Allow public access ».
