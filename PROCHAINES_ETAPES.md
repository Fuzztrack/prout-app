# 🚀 Prochaines Étapes - Plan d'Action

## ✅ Ce qui est fait

- ✅ Backend Nest.js créé et structuré
- ✅ Backend poussé sur GitHub : https://github.com/Fuzztrack/prout-backend
- ✅ Fichiers Android natifs (sons + XML channels) créés
- ✅ Frontend modifié pour utiliser le backend
- ✅ Token API configuré (`82d6d94d97ad501a596bf866c2831623`)
- ✅ Code FCM préparé (mais nécessite installation)

---

## 📋 Étapes suivantes (par ordre de priorité)

### 🔴 ÉTAPE 1 : Tester le Backend Localement

**Objectif** : Vérifier que le backend fonctionne avant de le déployer

```bash
cd /Users/fuzz/ProutAppavecNest/backend
npm install
npm run start:dev
```

**Vérifications** :
- Le serveur démarre sur le port 3000
- Vous voyez : `✅ Firebase admin initialized`
- Pas d'erreur de chargement du fichier Firebase

**Test manuel** :
```bash
# Dans un autre terminal
curl -X POST http://localhost:3000/prout \
  -H "Content-Type: application/json" \
  -H "x-api-key: 82d6d94d97ad501a596bf866c2831623" \
  -d '{
    "token": "test-token",
    "sender": "Test",
    "proutKey": "prout1"
  }'
```

---

### 🟠 ÉTAPE 2 : Déployer le Backend en Production

**Options de déploiement** :

#### Option A : Railway (Recommandé - Gratuit au début)
1. Allez sur https://railway.app
2. Créez un compte (avec GitHub)
3. "New Project" → "Deploy from GitHub repo"
4. Sélectionnez `prout-backend`
5. Configurez les variables d'environnement :
   - `FIREBASE_SERVICE_ACCOUNT_PATH` → Upload le fichier JSON Firebase
   - `API_KEY` → `82d6d94d97ad501a596bf866c2831623`
   - `PORT` → Railway définit automatiquement
6. Railway vous donne une URL : `https://votre-app.railway.app`

#### Option B : Heroku
1. Installez Heroku CLI
2. `heroku create prout-backend`
3. Configurez les variables d'environnement
4. `git push heroku main`

#### Option C : Render
1. Allez sur https://render.com
2. Créez un "Web Service"
3. Connectez votre repo GitHub
4. Configurez les variables d'environnement

**⚠️ Important** : Après déploiement, notez l'URL de votre backend !

---

### 🟡 ÉTAPE 3 : Mettre à Jour l'URL du Backend dans l'App

Une fois le backend déployé, mettez à jour `lib/sendProutBackend.ts` :

```typescript
const API_URL = 'https://votre-backend.railway.app/prout'; // ← Votre URL réelle
```

---

### 🟢 ÉTAPE 4 : Configurer FCM dans l'App

**Actuellement** : Le code FCM est prêt mais nécessite installation

#### 4.1 Installer les dépendances

```bash
cd /Users/fuzz/ProutAppavecNest
npm install
```

#### 4.2 Installer expo-dev-client (si pas déjà fait)

```bash
npx expo install expo-dev-client
```

#### 4.3 Rebuild l'app native

```bash
npx expo prebuild
npm run android  # ou npm run ios
```

#### 4.4 Vérifier que FCM fonctionne

- L'app doit obtenir un token FCM
- Le token doit être stocké dans Supabase (`expo_push_token`)
- Vérifiez les logs : `✅ Token FCM mis à jour`

---

### 🔵 ÉTAPE 5 : Tester l'Envoi de Prouts avec Sons Différents

1. **Sur l'app A** : Envoyez un prout à un ami
2. **Sur l'app B** (destinataire) : 
   - Fermez l'app complètement
   - Attendez la notification
   - Vérifiez que le bon son est joué

3. **Vérification** :
   - Le son correspond au `proutKey` envoyé
   - La notification arrive même si l'app est fermée
   - Les logs backend montrent l'envoi réussi

---

## 🐛 Dépannage

### Backend ne démarre pas
- Vérifiez que `node_modules` est installé : `npm install`
- Vérifiez le chemin du fichier Firebase dans `.env`
- Vérifiez que le port 3000 n'est pas utilisé

### FCM ne fonctionne pas
- Vérifiez que `google-services.json` est dans `android/app/`
- Vérifiez que vous utilisez un dev client (pas Expo Go)
- Rebuild l'app après installation de FCM

### Les sons ne fonctionnent pas
- Vérifiez que les fichiers `.ogg` sont dans `android/app/src/main/res/raw/`
- Vérifiez que `notification_channels.xml` existe
- Supprimez et réinstallez l'app pour réinitialiser les channels

---

## 📝 Checklist Finale

- [ ] Backend testé localement
- [ ] Backend déployé en production
- [ ] URL backend mise à jour dans `sendProutBackend.ts`
- [ ] FCM installé et configuré
- [ ] App rebuild avec dev client
- [ ] Token FCM obtenu et stocké
- [ ] Test d'envoi de prout réussi
- [ ] Sons différents fonctionnent correctement

---

## 🎯 Objectif Final

Envoyer un prout depuis l'app A → Notification reçue sur l'app B (fermée) → Son correspondant joué ✅


