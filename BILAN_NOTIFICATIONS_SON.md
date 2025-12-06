# 📊 Bilan Complet : Notifications avec Son - iOS vs Android

## 🎯 Objectif
Comprendre pourquoi les notifications avec sons personnalisés fonctionnent sur iOS mais pas sur Android.

---

## 📋 Flux Complet des Notifications

### 1️⃣ **Backend - Envoi de la Notification**

**Fichier :** `backend/src/prout/prout.service.ts`

```typescript
const message = {
  to: token,
  title: 'PROUT ! 💨',
  body: `${senderPseudo} t'a envoyé : ${proutName}`,
  sound: soundFile,  // "prout4.wav" pour iOS
  android: {
    channelId: proutKey,  // "prout4" pour Android
    icon: './assets/images/icon.png',
    color: '#ebb89b',
    vibrate: [0, 250, 250, 250],
  },
  data: { 
    type: 'prout',
    proutKey: proutKey,
    sender: senderPseudo,
    proutName: proutName
  },
  priority: 'high',
};
```

**Ce qui est envoyé :**
- **iOS** : `sound: "prout4.wav"` → APNs utilise directement ce fichier
- **Android** : `android.channelId: "prout4"` → Firebase doit utiliser le canal `prout4`

---

## 🍎 iOS - Pourquoi ça fonctionne

### **Architecture iOS**

1. **Payload envoyé :**
   ```
   {
     "sound": "prout4.wav",
     "title": "PROUT ! 💨",
     "body": "..."
   }
   ```

2. **APNs (Apple Push Notification service) :**
   - Reçoit le payload avec `sound: "prout4.wav"`
   - Vérifie que le fichier `prout4.wav` existe dans le bundle de l'app
   - ✅ **Les fichiers sont déclarés dans `app.json`** (lignes 66-87)
   - ✅ **APNs joue directement le son** quand l'app est fermée

3. **Configuration iOS :**
   - **Fichier :** `app.json`
   ```json
   "expo-notifications": {
     "sounds": [
       "./assets/sounds/prout1.wav",
       "./assets/sounds/prout2.wav",
       ...
     ]
   }
   ```
   - ✅ Les sons sont inclus dans le bundle iOS lors du build
   - ✅ APNs peut les utiliser directement

4. **Quand l'app est fermée :**
   - APNs affiche la notification
   - APNs joue le son `prout4.wav` directement depuis le bundle
   - ✅ **Pas besoin de code JavaScript ou natif**

### **Résumé iOS :**
- ✅ **Simple** : APNs gère tout automatiquement
- ✅ **Fonctionne quand l'app est fermée** : Pas besoin d'exécution de code
- ✅ **Le son est dans le bundle** : Accessible directement par APNs

---

## 🤖 Android - Pourquoi ça ne fonctionne pas

### **Architecture Android**

1. **Payload envoyé :**
   ```
   {
     "android": {
       "channelId": "prout4"
     },
     "sound": "prout4.wav",
     "title": "PROUT ! 💨",
     "body": "..."
   }
   ```

2. **Firebase Cloud Messaging (FCM) :**
   - Reçoit le payload avec `android.channelId: "prout4"`
   - ✅ **MAIS** : Quand l'app est fermée, Firebase utilise le canal par défaut défini dans `AndroidManifest.xml`
   - ❌ **Ignore le `channelId` du payload**

3. **Configuration Android :**

   **a) AndroidManifest.xml (ligne 19) :**
   ```xml
   <meta-data 
     android:name="com.google.firebase.messaging.default_notification_channel_id" 
     android:value="prout1" />
   ```
   - ❌ **Canal par défaut = `prout1`** → Toujours utilisé quand l'app est fermée

   **b) Création des canaux (JavaScript) :**
   - **Fichier :** `lib/notifications.ts`
   - **Fichier :** `app/_layout.tsx` (ligne 40)
   - ✅ Les canaux sont créés au démarrage de l'app
   - ❌ **Mais trop tard** : Firebase a déjà utilisé le canal par défaut

4. **Problème principal :**

   **Quand l'app est fermée :**
   ```
   1. Notification arrive → Firebase reçoit le payload
   2. Firebase cherche le canal "prout4" → ❌ N'existe pas encore (app fermée)
   3. Firebase utilise le canal par défaut "prout1" → ✅ Existe dans le manifeste
   4. Notification affichée avec le son de "prout1" → ❌ Mauvais son
   ```

   **Quand l'app est ouverte :**
   ```
   1. Notification arrive → Expo Notifications reçoit le payload
   2. Expo Notifications utilise le canal "prout4" → ✅ Existe (créé au démarrage)
   3. Notification affichée avec le bon son → ✅ Fonctionne
   ```

### **Pourquoi les canaux ne sont pas créés au bon moment ?**

1. **Création JavaScript (trop tard) :**
   - **Fichier :** `lib/notifications.ts` → `configureAndroidNotificationChannels()`
   - **Appelé dans :** `app/_layout.tsx` → `useEffect()` (ligne 40)
   - ❌ **S'exécute APRÈS** que l'app démarre
   - ❌ **Si l'app est fermée** → Le code JavaScript ne s'exécute pas

2. **Création native (tentative échouée) :**
   - **Fichier :** `android/app/src/main/java/com/fuzztrack/proutapp/MainApplication.kt`
   - ❌ **Fichier supprimé** : `NotificationChannelHelper.kt` n'existe plus
   - ❌ **Même si créé natif** : Firebase vérifie les canaux AVANT que l'app démarre

### **Résumé Android :**
- ❌ **Complexe** : Besoin de canaux de notification
- ❌ **Problème de timing** : Les canaux doivent exister AVANT que Firebase les utilise
- ❌ **Firebase ignore le `channelId` du payload** quand l'app est fermée

---

## 📁 Fichiers Impliqués

### **Backend**
- `backend/src/prout/prout.service.ts` : Envoi des notifications via Expo Push API
  - Ligne 43 : `soundFile = "${proutKey}.wav"` (ex: "prout4.wav")
  - Ligne 56 : `sound: soundFile` (pour iOS)
  - Ligne 59 : `android.channelId: proutKey` (ex: "prout4" pour Android)

### **Configuration**
- `app.json` : Configuration Expo (sons iOS, plugins)
  - Lignes 66-87 : Déclaration des 20 fichiers sons (`./assets/sounds/prout1.wav` à `prout20.wav`)
  - Ligne 48 : Plugin `withAndroidNotificationMetadata`
- `withAndroidNotificationMetadata.js` : Plugin Expo pour injecter le canal par défaut dans AndroidManifest.xml
  - Ligne 30 : Canal par défaut = `"prout1"`
- `android/app/src/main/AndroidManifest.xml` : Manifeste Android (canal par défaut)
  - Ligne 19 : `<meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="prout1" />`

### **Fichiers Sons**
- `assets/sounds/prout1.wav` à `prout20.wav` : 20 fichiers audio
  - ✅ **iOS** : Copiés dans le bundle iOS lors du build
  - ✅ **Android** : Copiés dans `res/raw/prout1.wav` à `res/raw/prout20.wav` lors du build
  - ⚠️ **Important** : Android identifie les ressources par leur nom SANS extension (`prout1` pas `prout1.wav`)

### **Code Client**
- `lib/notifications.ts` : Création des canaux Android (JavaScript)
  - Lignes 5-10 : Liste des 20 sons (`prout1` à `prout20`)
  - Lignes 20-91 : `configureAndroidNotificationChannels()` - Crée les 20 canaux avec leurs sons
  - Ligne 51 : `sound: soundResourceName` (ex: `"prout1"` SANS extension)
  - Ligne 93 : `ensureAndroidNotificationChannel()` - Fonction exportée
- `app/_layout.tsx` : Appel de la création des canaux au démarrage
  - Ligne 40 : `ensureAndroidNotificationChannel()` appelé dans `useEffect()`
  - ⚠️ **Problème** : S'exécute APRÈS le démarrage de l'app

### **Code Natif Android** (supprimé)
- ~~`android/app/src/main/java/com/fuzztrack/proutapp/NotificationChannelHelper.kt`~~ : Création native des canaux (supprimé)
- ~~`android/app/src/main/java/com/fuzztrack/proutapp/CustomFirebaseMessagingService.kt`~~ : Service personnalisé Firebase (supprimé)
- `android/app/src/main/java/com/fuzztrack/proutapp/MainApplication.kt` : Point d'entrée Android
  - Lignes 41-50 : `onCreate()` - Pas de création de canaux actuellement

---

## 🔍 Analyse du Problème

### **Pourquoi iOS fonctionne :**
1. ✅ **APNs gère les sons directement** : Pas besoin de canaux
2. ✅ **Les sons sont dans le bundle** : Accessibles même quand l'app est fermée
3. ✅ **Le payload `sound` est respecté** : APNs joue le bon son

### **Pourquoi Android ne fonctionne pas :**
1. ❌ **Firebase utilise le canal par défaut** : Ignore le `channelId` du payload quand l'app est fermée
2. ❌ **Les canaux sont créés trop tard** : JavaScript s'exécute après le démarrage de l'app
3. ❌ **Firebase vérifie les canaux avant l'app** : Quand l'app est fermée, Firebase ne peut pas attendre que l'app démarre

### **Le problème fondamental :**
```
Firebase Messaging (quand l'app est fermée) :
  → Reçoit notification avec channelId="prout4"
  → Cherche le canal "prout4" dans le système Android
  → ❌ Canal n'existe pas (app fermée, code JavaScript non exécuté)
  → Utilise le canal par défaut "prout1" du manifeste
  → ❌ Mauvais son joué
```

---

## 💡 Solutions Possibles

### **Solution 1 : Créer les canaux au niveau natif AVANT le démarrage**
- Créer `NotificationChannelHelper.kt` qui crée les canaux dans `MainApplication.onCreate()`
- ✅ Les canaux existent dès le démarrage de l'app
- ❌ **MAIS** : Si l'app n'a jamais été démarrée, les canaux n'existent toujours pas

### **Solution 2 : Utiliser un BroadcastReceiver pour intercepter les notifications**
- Intercepter les notifications Firebase avant leur affichage
- Modifier le canal selon le `channelId` dans les `data`
- ✅ Fonctionne même quand l'app est fermée
- ⚠️ **Complexe** : Nécessite du code natif Android

### **Solution 3 : Envoyer uniquement des notifications `data` (pas de `notification`)**
- Modifier le backend pour envoyer uniquement `data`
- Laisser Expo Notifications gérer l'affichage côté client
- ✅ Expo Notifications respecte le `channelId`
- ❌ **MAIS** : Sur iOS, les notifications `data` ne s'affichent pas quand l'app est fermée

### **Solution 4 : Créer tous les canaux au build time**
- Utiliser un plugin Expo pour créer les canaux dans le manifeste
- ✅ Les canaux existent dès l'installation
- ⚠️ **Limité** : Android ne permet pas de créer des canaux dans le manifeste (seulement le canal par défaut)

---

## 🎯 Conclusion

### **iOS :**
- ✅ **Fonctionne parfaitement** : APNs gère les sons directement
- ✅ **Simple** : Pas besoin de canaux ou de code spécial
- ✅ **Fiable** : Fonctionne même quand l'app est fermée

### **Android :**
- ❌ **Ne fonctionne pas** : Firebase ignore le `channelId` du payload quand l'app est fermée
- ❌ **Problème de timing** : Les canaux sont créés trop tard
- ⚠️ **Solution complexe** : Nécessite du code natif ou une modification de l'architecture

### **Recommandation :**
Implémenter la **Solution 2** (BroadcastReceiver) pour intercepter les notifications Firebase et utiliser le bon canal selon le `channelId` dans les `data`. C'est la seule solution qui fonctionne à la fois sur iOS et Android sans compromis.

---

## 📊 Diagramme de Flux

### **iOS - Flux Réussi**

```
Backend
  └─> Expo Push API
      └─> APNs (Apple Push Notification service)
          └─> Payload: { sound: "prout4.wav", title: "...", body: "..." }
              └─> ✅ APNs vérifie que "prout4.wav" existe dans le bundle
                  └─> ✅ APNs affiche la notification
                      └─> ✅ APNs joue "prout4.wav" depuis le bundle
                          └─> ✅ SON CORRECT JOUÉ
```

### **Android - Flux Actuel (Échec)**

```
Backend
  └─> Expo Push API
      └─> Firebase Cloud Messaging (FCM)
          └─> Payload: { android: { channelId: "prout4" }, sound: "prout4.wav", ... }
              └─> App FERMÉE ?
                  ├─> OUI → Firebase cherche le canal "prout4"
                  │   └─> ❌ Canal "prout4" n'existe pas (app fermée, code JS non exécuté)
                  │       └─> Firebase utilise le canal par défaut "prout1" (du manifeste)
                  │           └─> Notification affichée avec le son de "prout1"
                  │               └─> ❌ MAUVAIS SON JOUÉ
                  │
                  └─> NON → Expo Notifications reçoit le payload
                      └─> Expo Notifications cherche le canal "prout4"
                          └─> ✅ Canal "prout4" existe (créé au démarrage)
                              └─> Notification affichée avec le son de "prout4"
                                  └─> ✅ BON SON JOUÉ
```

### **Android - Flux Idéal (Solution)**

```
Backend
  └─> Expo Push API
      └─> Firebase Cloud Messaging (FCM)
          └─> Payload: { android: { channelId: "prout4" }, data: { proutKey: "prout4" }, ... }
              └─> BroadcastReceiver intercepte la notification
                  └─> Extrait "proutKey" depuis data
                      └─> Vérifie que le canal "prout4" existe
                          ├─> Existe → Utilise le canal "prout4"
                          │   └─> ✅ BON SON JOUÉ
                          └─> N'existe pas → Crée le canal "prout4" puis l'utilise
                              └─> ✅ BON SON JOUÉ
```

---

## 🔑 Points Clés à Retenir

1. **iOS** : Les sons sont dans le bundle, APNs les joue directement → ✅ Simple et fiable
2. **Android** : Les sons nécessitent des canaux de notification → ⚠️ Complexe
3. **Problème Android** : Firebase utilise le canal par défaut quand l'app est fermée → ❌ Ignore le `channelId` du payload
4. **Solution** : Intercepter les notifications Firebase avec un BroadcastReceiver → ✅ Utiliser le bon canal selon les `data`

