# Guide pas à pas : deux apps iOS (Prout + Prrt!) avec Expo

Objectif : garder l’ancienne app **Prout** (com.fuzztrack.proutapp) et la nouvelle **Prrt!** (com.prrt.app), avec la **même clé APNs .p8** pour les deux.

---

## Prérequis

- Une clé APNs .p8 déjà créée dans Apple Developer (valable pour les deux bundles).
- Accès à [expo.dev](https://expo.dev) et à EAS CLI (`npm i -g eas-cli`).

---

## Étape 1 : Créer le nouveau projet Expo (pour l’app Prrt!)

Le projet **Prout** (com.fuzztrack.proutapp) **existe déjà** sur Expo. On crée un projet **séparé** pour la nouvelle app **Prrt!** (com.prrt.app).

1. Va sur **[expo.dev](https://expo.dev)** → **Log in**.
2. **Create a project** (ou **Projects** → **Create project**).
3. Donne un nom, ex. **Prrt!** (nouvelle app).
4. Note l’**Project ID** du nouveau projet (ex. `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`). Tu en auras besoin pour **app.json**.

---

## Étape 2 : Configurer les projectId dans les deux configs

- **app.json** (Prrt!, com.prrt.app) : remplace **expo.extra.eas.projectId** par le **Project ID** du **nouveau** projet **Prrt!** créé à l’étape 1. C’est la config par défaut pour builder la nouvelle app.
- **app.prout.json** (Prout, com.fuzztrack.proutapp) : remplace **expo.extra.eas.projectId** par le **Project ID** du projet **Prout existant** (celui que tu as déjà sur expo.dev). Tu trouves cet ID dans **expo.dev** → projet Prout → **Project settings**.

Vérifications rapides :
- **app.prout.json** : `expo.name` = `"Prout"`, `scheme` = `"proutapp"`, `ios.bundleIdentifier` = `"com.fuzztrack.proutapp"`, `ios.googleServicesFile` = `"./GoogleService-Info.plist"` (ou chemin vers ton plist Prout). Si le plist Prout est ailleurs, adapte **expo.ios.googleServicesFile**.

**Note** : Au premier build avec `--config app.prout.json`, EAS peut demander de lier le projet ; choisis le projet **Prout** (existant).

---

## Étape 3 : Profils de build EAS (eas.json)

Tu peux ajouter un profil qui utilise la config Prout pour iOS uniquement.

1. Ouvre **eas.json**.
2. Ajoute un profil **production-prout** (ou **ios-prout**) qui utilise la config Prout :

   ```json
   {
     "build": {
       "production": { ... },
       "production-prout": {
         "extends": "production",
         "ios": {
           "resourceClass": "medium",
           "image": "latest"
         },
         "channel": "production"
       }
     }
   }
   ```

   On ne surcharge pas le bundle ici : c’est **app.prout.json** qui définit le bundle pour ce build.

---

## Étape 4 : Lier les configs aux bons projets EAS

- **app.json** doit pointer vers le projet **Prrt!** (nouveau). À la racine du repo :
  ```bash
  eas init
  ```
  Choisis **Link to existing project** et sélectionne le projet **Prrt!** (créé à l’étape 1). EAS met à jour le **projectId** dans **app.json** → c’est ce qu’on veut pour Prrt!.

- **app.prout.json** : le **projectId** du projet **Prout** (existant) doit être renseigné à la main dans le fichier (étape 2). Si tu lances un build avec `--config app.prout.json`, EAS peut proposer de lier ; dans ce cas choisis le projet **Prout** existant. Vérifie que **app.json** n’a pas été écrasé (il doit garder le projectId de Prrt!).

---

## Étape 5 : Credentials iOS – même clé .p8 pour les deux projets

À faire **pour chaque** projet (Prout et Prrt!) sur [expo.dev](https://expo.dev).

### Projet Prout (com.fuzztrack.proutapp) – projet existant

1. **expo.dev** → ton projet **Prout** (celui qui existe déjà).
2. **Project settings** → **Credentials** → **iOS**.
3. **Push Notifications** : la clé .p8 est sans doute déjà configurée pour `com.fuzztrack.proutapp`. Sinon : **Upload** / **Set up** Push Key avec ta **.p8**, **Key ID**, **Team ID**, **Bundle ID** = `com.fuzztrack.proutapp`.

### Projet Prrt! (com.prrt.app) – nouveau projet

1. **expo.dev** → le projet **Prrt!** (créé à l’étape 1).
2. **Project settings** → **Credentials** → **iOS**.
3. **Push Notifications** : configure **la même** clé .p8 que pour Prout :
   - **Upload** / **Set up** Push Key.
   - Même fichier **.p8**, même **Key ID**, même **Team ID**.
   - **Bundle ID** = `com.prrt.app`.
4. Enregistre.

Une seule clé .p8 pour les deux ; Apple l’accepte pour les deux bundles.

---

## Étape 6 : Builds iOS

### Builder l’app Prrt! (nouvelle app, com.prrt.app)

Config = **app.json** (déjà pour Prrt!):

```bash
eas build --platform ios --profile production
```

(EAS utilise **app.json** par défaut → projet Prrt!, bundle com.prrt.app.)

### Builder l’app Prout (ancienne app, com.fuzztrack.proutapp)

Config = **app.prout.json** :

```bash
eas build --platform ios --profile production --config app.prout.json
```

Si tu as créé un profil dédié, par exemple :

```bash
eas build --platform ios --profile production-prout --config app.prout.json
```

---

## Étape 7 : Vérifier les notifs

- **Prout** (ancienne app) : utilisateur avec l’app Prout installée → token enregistré pour le **projet Prout** → backend envoie au token → Expo utilise les credentials du projet Prout (ta .p8) → notif reçue sur l’ancienne app.
- **Prrt!** (nouvelle app) : utilisateur avec l’app Prrt! installée → token pour le **projet Prrt!** → même .p8 côté Expo → notif reçue sur la nouvelle app.

Le backend n’a pas besoin de savoir quelle app : il envoie toujours au token stocké en base.

---

## Dépannage : Erreur « InvalidCredentials » (backend)

Si le backend renvoie **Erreur Expo: InvalidCredentials** en envoyant une notif à un appareil iOS, c’est qu’Expo n’a pas de clé APNs valide pour le **projet** associé au token (celui avec lequel l’app a été buildée).

- **App Prrt!** (com.prrt.app) : aller sur **expo.dev** → projet **Prrt!** → **Project settings** → **Credentials** → **iOS** → **Push Notifications**, et configurer la clé **.p8** (Key ID, Team ID, Bundle ID = `com.prrt.app`).
- **App Prout** (com.fuzztrack.proutapp) : idem sur le projet **Prout** avec Bundle ID = `com.fuzztrack.proutapp`.

Une même clé .p8 peut être utilisée pour les deux projets (les deux bundles).

---

## Récap des fichiers

| Fichier          | Rôle |
|------------------|------|
| **app.json**     | Config **Prrt!** (com.prrt.app) → projectId du **nouveau** projet Prrt! sur Expo. Utilisé pour Android et pour les builds iOS Prrt!. |
| **app.prout.json** | Config **Prout** (com.fuzztrack.proutapp) → projectId du **projet Prout existant** sur Expo. Utilisé uniquement pour les builds iOS de l’ancienne app. |

Android : on ne touche pas ; tu continues à builder avec **app.json** (package com.fuzztrack.proutapp).
