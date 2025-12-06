# 📋 Plan des Services - ProutApp

Ce document répertorie tous les services utilisés dans l'application ProutApp, leurs rôles, configurations et URLs.

---

## 🎯 Vue d'ensemble

| Service | Rôle | Statut | Coût |
|---------|------|--------|------|
| **Render** | Backend NestJS (API) | ✅ Actif | Gratuit (avec limitations) |
| **Supabase** | Base de données + Auth + Realtime | ✅ Actif | Gratuit (avec limitations) |
| **Firebase** | Notifications Push (FCM Android) | ✅ Actif | Gratuit |
| **Expo** | Framework React Native + Push iOS | ✅ Actif | Gratuit |
| **EAS (Expo)** | Build & Distribution | ⚠️ Configuré | Payant si utilisé |

---

## 1. 🖥️ Render (Backend NestJS)

### Rôle
- **API Backend** : Gère l'envoi des notifications push
- **Détection automatique** : iOS (Expo Push) ou Android (FCM)

### Configuration
- **URL** : `https://prout-backend.onrender.com`
- **Endpoint** : `/prout`
- **Plan** : Free (peut être en veille après inactivité)
- **Build Command** : `npm install --legacy-peer-deps && npm run build`
- **Start Command** : `npm start`

### Variables d'environnement (Render Dashboard)
- `FIREBASE_SERVICE_ACCOUNT_JSON` : JSON Firebase en une ligne (Secret)
- `API_KEY` : `82d6d94d97ad501a596bf866c2831623` (Secret)
- `PORT` : Auto-défini par Render

### Technologies utilisées
- **NestJS** : Framework backend
- **Firebase Admin SDK** : Pour FCM Android
- **expo-server-sdk** : Pour Expo Push iOS
- **Supabase JS** : Pour accès base de données (si nécessaire)

### Fichiers de configuration
- `backend/render.yaml` : Configuration Render
- `backend/src/prout/prout.service.ts` : Service principal
- `backend/src/prout/prout.controller.ts` : Controller API

### Limitations (Plan Free)
- ⚠️ **Sleep Mode** : Le service se met en veille après 15 min d'inactivité
- ⚠️ **Cold Start** : 30-60 secondes pour se réveiller
- ⚠️ **Build Time** : Limité

---

## 2. 🗄️ Supabase (Base de données + Auth)

### Rôle
- **Base de données PostgreSQL** : Stockage des utilisateurs, amis, profils
- **Authentification** : Gestion des comptes (email, OAuth Google)
- **Realtime** : Synchronisation en temps réel des amis
- **Storage** : (Non utilisé actuellement)

### Configuration
- **URL** : `https://utfwujyymaikraaigvuv.supabase.co`
- **Anon Key** : `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (dans `lib/supabase.ts`)
- **Plan** : Free (avec limitations)

### Tables principales
- `auth.users` : Comptes utilisateurs (géré par Supabase Auth)
- `user_profiles` : Profils utilisateurs (pseudo, téléphone, token FCM/Expo)
- `friends` : Relations d'amitié entre utilisateurs
- `friend_requests` : Demandes d'amitié en attente

### Fonctions SQL utilisées
- `sync_contacts` : Synchronisation des contacts téléphoniques
- `create_profile_safe` : Création sécurisée de profil (si utilisé)

### Realtime Subscriptions
- **Channel** : `friends` - Synchronisation des amis en temps réel

### Fichiers de configuration
- `lib/supabase.ts` : Client Supabase
- `backend/src/supabase/supabase.service.ts` : Service backend Supabase

### Limitations (Plan Free)
- ⚠️ **500 MB** de base de données
- ⚠️ **2 GB** de bande passante
- ⚠️ **50 000** utilisateurs actifs par mois

---

## 3. 🔥 Firebase (Notifications Push Android)

### Rôle
- **FCM (Firebase Cloud Messaging)** : Notifications push pour Android
- **Service Account** : Authentification backend pour envoyer des notifications

### Configuration
- **Project ID** : `prout-5e6ec`
- **Project Number** : `575093596108`
- **Service Account** : `firebase-adminsdk-fbsvc@prout-5e6ec.iam.gserviceaccount.com`
- **Plan** : Free (Spark Plan)

### Fichiers de configuration
- `google-services.json` : Configuration Android (dans `android/app/`)
- `GoogleService-Info.plist` : Configuration iOS (dans `ios/`)
- `prout-5e6ec-firebase-adminsdk-fbsvc-dcd4c23717.json` : Service Account (local)
- `backend/FIREBASE_SERVICE_ACCOUNT_ONE_LINE.txt` : Service Account pour Render

### Utilisation
- **Frontend** : `@react-native-firebase/messaging` pour obtenir les tokens FCM
- **Backend** : `firebase-admin` pour envoyer les notifications

### Canaux Android (20 canaux)
- Format : `{proutKey}-v14` (ex: `prout1-v14`, `prout2-v14`, etc.)
- Chaque canal correspond à un son de prout différent

---

## 4. 📱 Expo (Framework + Push iOS)

### Rôle
- **Framework React Native** : Développement cross-platform
- **Expo Push Notifications** : Notifications push pour iOS
- **EAS Build** : Build et distribution (configuré mais optionnel)

### Configuration
- **Project ID (EAS)** : `f2545544-14d4-4739-96a1-1fb75515e1e9`
- **Slug** : `ProutApp`
- **Bundle ID iOS** : `com.prout.app`
- **Package Android** : `com.fuzztrack.proutapp`

### Services Expo utilisés
- `expo-notifications` : Gestion des notifications
- `expo-contacts` : Accès aux contacts téléphoniques
- `expo-audio` : Lecture des sons de prout
- `expo-router` : Navigation
- `expo-device` : Détection de l'appareil
- `expo-constants` : Configuration et constantes

### Push Notifications iOS
- **Token Format** : `ExponentPushToken[...]`
- **API** : Expo Push Notification API (via `expo-server-sdk` dans le backend)

### Fichiers de configuration
- `app.json` : Configuration Expo principale
- `eas.json` : Configuration EAS Build (si utilisé)
- `lib/fcmToken.ts` : Gestion des tokens (FCM Android + Expo iOS)

---

## 5. 🔔 Notifications Push - Architecture

### Android (FCM)
```
App → @react-native-firebase/messaging → Token FCM natif
     ↓
Backend → firebase-admin → FCM API → Notification Android
```

### iOS (Expo Push)
```
App → expo-notifications → Expo Push Token
     ↓
Backend → expo-server-sdk → Expo Push API → Notification iOS
```

### Détection automatique
Le backend détecte automatiquement le type de token :
- Si token commence par `ExponentPushToken[` → iOS → Expo Push API
- Sinon → Android → FCM API

---

## 6. 📊 Schéma de communication

```
┌─────────────┐
│   App iOS   │───Expo Push Token───┐
└─────────────┘                      │
                                     ▼
┌─────────────┐              ┌──────────────┐
│ App Android │───FCM Token──┤   Render     │
└─────────────┘              │   Backend    │
                             └──────┬───────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌───────────┐    ┌───────────┐  ┌───────────┐
            │  Expo    │    │  Firebase │  │ Supabase  │
            │ Push API │    │  FCM API  │  │   (DB)    │
            └───────────┘    └───────────┘  └───────────┘
```

---

## 7. 🔑 Clés et Secrets

### Clés publiques (dans le code)
- **Supabase URL** : `https://utfwujyymaikraaigvuv.supabase.co`
- **Supabase Anon Key** : Visible dans `lib/supabase.ts`
- **Backend API Key** : `82d6d94d97ad501a596bf866c2831623`
- **Backend URL** : `https://prout-backend.onrender.com`

### Secrets (variables d'environnement)
- **Firebase Service Account JSON** : Dans Render Dashboard (variable `FIREBASE_SERVICE_ACCOUNT_JSON`)
- **API_KEY** : Dans Render Dashboard (variable `API_KEY`)

---

## 8. 📝 Checklist de configuration

### Render (Backend)
- [ ] Service créé sur Render Dashboard
- [ ] Variables d'environnement configurées (`FIREBASE_SERVICE_ACCOUNT_JSON`, `API_KEY`)
- [ ] Build réussi (vérifier les logs)
- [ ] Backend accessible (test avec curl)

### Supabase
- [ ] Projet créé
- [ ] Tables créées (`user_profiles`, `friends`, `friend_requests`)
- [ ] Fonction `sync_contacts` créée
- [ ] RLS (Row Level Security) configuré
- [ ] Realtime activé pour le channel `friends`

### Firebase
- [ ] Projet créé (`prout-5e6ec`)
- [ ] Service Account créé et téléchargé
- [ ] `google-services.json` ajouté dans `android/app/`
- [ ] `GoogleService-Info.plist` ajouté dans `ios/`
- [ ] Service Account JSON configuré sur Render

### Expo
- [ ] Compte Expo créé
- [ ] EAS Project ID configuré (`f2545544-14d4-4739-96a1-1fb75515e1e9`)
- [ ] Permissions configurées dans `app.json`
- [ ] Sons de prout ajoutés dans `assets/sounds/`

---

## 9. 🚨 Points d'attention

### Render (Plan Free)
- ⚠️ Le backend peut être en veille → Premier appel peut prendre 30-60 secondes
- ⚠️ Limite de build time
- 💡 Solution : Upgrade vers plan payant ou utiliser un service de "keep-alive"

### Supabase (Plan Free)
- ⚠️ Limite de 500 MB de base de données
- ⚠️ Limite de 50 000 utilisateurs actifs/mois
- 💡 Surveiller l'utilisation dans le dashboard

### Firebase (Plan Free)
- ✅ Pas de limite significative pour FCM
- ✅ Gratuit pour les notifications push

### Expo (Plan Free)
- ✅ Gratuit pour le développement
- ⚠️ EAS Build peut nécessiter un plan payant pour les builds en production

---

## 10. 🔄 Mises à jour récentes

### Aujourd'hui (Support iOS)
- ✅ Ajout de `expo-server-sdk` dans le backend
- ✅ Modification de `lib/fcmToken.ts` pour supporter iOS
- ✅ Backend modifié pour détecter automatiquement iOS/Android
- ✅ Support des Expo Push Tokens pour iOS

---

## 11. 📞 URLs importantes

- **Render Dashboard** : https://dashboard.render.com
- **Supabase Dashboard** : https://app.supabase.com/project/utfwujyymaikraaigvuv
- **Firebase Console** : https://console.firebase.google.com/project/prout-5e6ec
- **Expo Dashboard** : https://expo.dev/accounts/[ton-compte]/projects/ProutApp
- **Backend API** : https://prout-backend.onrender.com/prout

---

## 12. 🛠️ Commandes utiles

### Tester le backend
```bash
curl -X POST "https://prout-backend.onrender.com/prout" \
  -H "Content-Type: application/json" \
  -H "x-api-key: 82d6d94d97ad501a596bf866c2831623" \
  -d '{"token": "TEST_TOKEN", "sender": "Test", "proutKey": "prout1"}'
```

### Redéployer le backend sur Render
```bash
cd backend
git add .
git commit -m "Update"
git push
# Render redéploiera automatiquement
```

### Vérifier les logs Render
1. Aller sur https://dashboard.render.com
2. Sélectionner le service `prout-backend`
3. Cliquer sur "Logs"

---

**Dernière mise à jour** : Aujourd'hui (après ajout du support iOS)





