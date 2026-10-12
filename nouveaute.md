# Propositions de Nouveautés & Étude de Faisabilité — Proot !

*Date de rédaction : 23 septembre 2026*

---

## 💡 Top 5 des Propositions de Nouveautés

### 1. 🚀 Widget Écran d'Accueil & Écran de Verrouillage
* **Concept** : Un widget interactif sur l'écran d'accueil ou de verrouillage du téléphone affichant le dernier prout reçu avec un bouton pour répondre instantanément.
* **Intérêt** : Friction zéro, favorise l'instantanéité des réactions entre amis.

### 2. 💣 Le « Prout à Retardement » (Programmation d'envoi)
* **Concept** : Programmer l'envoi d'un prout à une heure/date précise (ex : réveil d'un ami à 8h00 pile).
* **Intérêt** : Effet de surprise garanti, renforce le côté farceur et ludique de l'app.

### 3. 🎯 Le « Tir de Groupe » (Envoi Multi-Destinataires)
* **Concept** : Mode de sélection multiple permettant d'envoyer un son simultanément à plusieurs amis ou un groupe créé au préalable.
* **Intérêt** : Déclenche des réactions en chaîne immédiates au sein d'un groupe d'amis.

### 4. 🏆 Jalons & Badges de Complicité (Gamification)
* **Concept** : Débloquer des sons exclusifs secrets et des badges au fur et à mesure que le score de complicité avec un ami augmente.
* **Intérêt** : Booste l'engagement et la rétention à long terme.

### 5. 🎭 Le « Mood du Jour » (Statut Audio Éphémère 24h)
* **Concept** : Afficher un statut d'ambiance visuel et sonore (24h) sous son pseudo dans la liste d'amis (*« En réunion 🤫 »*, *« En PLS 😴 »*, etc.).
* **Intérêt** : Indique à ses proches son état d'esprit avant l'envoi d'un prout.

---

## 🛠️ Étude de Faisabilité & Compatibilité EAS Update (OTA)

| Option | Fonctionnalité | Compatible EAS Update (OTA) | Nécessite Build Native |
| :--- | :--- | :---: | :---: |
| **Option 1** | Widget Écran d'Accueil / Lock Screen | **NON 🔴** | **OUI** (iOS Swift / Android Kotlin) |
| **Option 2** | Le « Prout à Retardement » | **OUI 🟢** | **NON** (100% JS + Supabase) |
| **Option 3** | Le « Tir de Groupe » | **OUI 🟢** | **NON** (100% JS + Supabase) |

---

### Detail Technique par Option

#### Option 1 : Widget Écran d'Accueil
* **Compatibilité EAS Update** : **NON 🔴**
* **Explication** : Nécessite la compilation de modules natifs spécifiques (Swift/WidgetKit pour iOS avec App Groups, et Kotlin/AppWidgetProvider pour Android). Impossible de passer uniquement par du code JavaScript en Over-The-Air (OTA).
* **Plan d'implémentation (Build Native)** :
  1. Installer `react-native-home-widget`.
  2. Configurer les App Groups dans Xcode (`ios/`) et le `AndroidManifest.xml` (`android/`).
  3. Développer l'extension native iOS (Swift) et Android (Kotlin).
  4. Publier une nouvelle version sur l'App Store et Google Play Store via `eas build`.

#### Option 2 : Le « Prout à Retardement »
* **Compatibilité EAS Update** : **OUI 🟢**
* **Explication** : Repose entièrement sur du code JavaScript/TypeScript côté front-end et la base de données Supabase / Backend NestJS existant.
* **Plan d'implémentation** :
  1. **Supabase** : Création d'une table `scheduled_prouts` (`id`, `sender_id`, `recipient_id`, `sound_key`, `scheduled_at`, `status`).
  2. **Front-End (App)** : Ajout d'une option « Programmer » (sélecteur d'heure/date) qui insère la ligne dans Supabase.
  3. **Back-End** : Un job cron (sur NestJS ou via Supabase `pg_cron`) vérifie les envois programmés et déclenche la notification Push FCM/APNs.
  4. **Déploiement** : Envoi instantané en 1 clic via `npx eas update --branch production`.

#### Option 3 : Le « Tir de Groupe »
* **Compatibilité EAS Update** : **OUI 🟢**
* **Explication** : Nécessite uniquement des adaptations de l'interface utilisateur (React Native) et la réutilisation des API d'envoi existantes.
* **Plan d'implémentation** :
  1. **Front-End (App)** : Ajout d'un mode de sélection multiple dans la liste d'amis (`FriendsList.tsx`) et d'un bouton d'action groupé.
  2. **Logique d'envoi** : Boucle d'envoi parallélisée (`Promise.all`) ou évolution mineure du backend pour accepter une liste d'utilisateurs destinataires.
  3. **Déploiement** : Envoi instantané en 1 clic via `npx eas update --branch production`.

---

## 🎯 Recommandation de Feuille de Route

1. **Phase 1 (Sans nouvelle version Store - 100% OTA)** : Implémenter et déployer l'**Option 2 (Prout à retardement)** et/ou l'**Option 3 (Tir de groupe)** via des EAS Updates rapides.
2. **Phase 2 (Mise à jour majeure Store)** : Développer l'**Option 1 (Widgets)** et soumettre une nouvelle build native sur l'App Store et le Play Store.
