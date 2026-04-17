# Instructions de Configuration - Backend Nest.js pour Sons Différents

## ✅ Structure créée

La structure suivante a été mise en place :

```
project-root/
├─ backend/                    ← NOUVEAU
│  ├─ package.json
│  ├─ tsconfig.json
│  ├─ .env.example
│  ├─ .gitignore
│  ├─ README.md
│  └─ src/
│     ├─ main.ts
│     ├─ app.module.ts
│     └─ prout/
│        ├─ prout.module.ts
│        ├─ prout.controller.ts
│        └─ prout.service.ts
├─ lib/
│  └─ sendProutBackend.ts      ← NOUVEAU
├─ components/
│  └─ FriendsList.tsx          ← MODIFIÉ (utilise maintenant le backend)
└─ android/app/src/main/
   ├─ res/raw/                 ← Déjà présent (prout1.ogg à prout10.ogg)
   └─ res/xml/
      └─ notification_channels.xml  ← NOUVEAU
```

## 📋 Étapes de configuration

### 1. Configuration du Backend

```bash
cd backend
npm install
```

Créez un fichier `.env` à partir de `.env.example` :

```bash
cp .env.example .env
```

Éditez `.env` et configurez :

```env
# Le fichier Firebase existe déjà à la racine du projet
FIREBASE_SERVICE_ACCOUNT_PATH=../prout-5e6ec-firebase-adminsdk-fbsvc-dcd4c23717.json
API_KEY=votre_cle_secrete_ici
PORT=3000
```

**⚠️ IMPORTANT** : Changez `API_KEY` par une clé secrète forte !

### 2. Configuration du Frontend

Éditez `lib/sendProutBackend.ts` et remplacez :

```typescript
const API_URL = 'https://TON_BACKEND_URL/prout'; // ← Remplacez par votre URL
const API_KEY = 'change_me_to_a_secret_key';     // ← Doit matcher backend .env
```

### 3. Tokens FCM vs Expo Push Tokens

**Problème** : Firebase Admin SDK nécessite des **tokens FCM natifs**, pas des tokens Expo Push.

**Solutions possibles** :

#### Option A : Utiliser des tokens FCM natifs (recommandé)

1. Installez `@react-native-firebase/messaging` :
```bash
npm install @react-native-firebase/messaging
```

2. Modifiez votre code pour obtenir le token FCM :
```typescript
import messaging from '@react-native-firebase/messaging';

const fcmToken = await messaging().getToken();
// Stockez ce token au lieu de expo_push_token
```

3. Utilisez ce token FCM dans `sendProutViaBackend`

#### Option B : Modifier le backend pour utiliser Expo Push API

Si vous préférez garder les tokens Expo Push, modifiez `backend/src/prout/prout.service.ts` pour utiliser l'API Expo Push Notifications au lieu de Firebase Admin SDK.

### 4. Démarrage du Backend

```bash
cd backend
npm run start:dev
```

Le serveur écoute sur le port configuré (défaut: 3000).

### 5. Test

1. Démarrez votre app Expo
2. Assurez-vous que les canaux Android sont créés (via `ensureAndroidNotificationChannel()`)
3. Envoyez un prout depuis l'app
4. Vérifiez que la notification arrive avec le bon son

## 🔍 Débogage

### Vérifier les canaux Android

```bash
adb shell dumpsys notification_service | grep -A 5 "prout"
```

### Logs backend

Les logs du backend indiquent si Firebase est initialisé correctement :
- ✅ `Firebase admin initialized` = OK
- ⚠️ `FIREBASE SERVICE ACCOUNT not found` = Vérifiez le chemin dans `.env`

### Logs Android

```bash
adb logcat | grep -i "ringtone\|prout\|notification"
```

## 📝 Notes

- Les fichiers son sont déjà dans `android/app/src/main/res/raw/`
- Le fichier XML des canaux est créé dans `android/app/src/main/res/xml/`
- Les canaux sont aussi créés dynamiquement via `expo-notifications` au démarrage de l'app
- Pour que les modifications Android prennent effet, vous devez reconstruire l'app native

## 🚀 Déploiement

Pour déployer le backend en production :

1. Build :
```bash
cd backend
npm run build
```

2. Déployez le dossier `dist/` sur votre serveur (Heroku, Railway, etc.)

3. Configurez les variables d'environnement sur votre plateforme de déploiement

4. Mettez à jour `API_URL` dans `lib/sendProutBackend.ts` avec l'URL de production

