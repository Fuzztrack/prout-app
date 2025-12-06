# 📚 Documentation Complète : Sons de Notification Android

Ce document explique **toute la logique et tous les fichiers** utilisés pour gérer les sons de notification personnalisés sur Android dans l'application ProutApp.

---

## 🎯 Vue d'Ensemble du Système

Le système de notifications sonores Android fonctionne en **5 étapes principales** :

1. **Configuration des fichiers** (`app.json`) - Expo inclut les fichiers audio
2. **Création des canaux** (`lib/notifications.ts`) - Création des canaux Android avec les sons
3. **Initialisation** (`app/_layout.tsx`) - Appel de la création des canaux au démarrage
4. **Envoi** (`backend/src/prout/prout.service.ts`) - Le backend envoie avec le bon `channelId`
5. **Résolution** (Android OS) - Android joue le son défini dans le canal

---

## 📁 Fichiers Impliqués

### 1. **`app.json`** - Configuration des Fichiers Audio

**Rôle** : Déclarer les fichiers audio à inclure dans le build Android.

**Localisation** : Racine du projet

**Section clé** :
```json
"plugins": [
  [
    "expo-notifications",
    {
      "icon": "./assets/images/icon.png",
      "color": "#ffffff",
      "sounds": [
        "./assets/sounds/prout1.wav",
        "./assets/sounds/prout2.wav",
        // ... prout3 à prout20.wav
      ]
    }
  ]
]
```

**Ce que ça fait** :
- ✅ Expo inclut ces fichiers dans l'APK/AAB lors du build
- ✅ Les fichiers sont copiés dans `res/raw/` du projet Android natif
- ✅ Le fichier `prout1.wav` devient accessible comme ressource Android `prout1` (sans extension)

**Format des fichiers** :
- Format supporté : `.wav` (ou `.ogg`, `.mp3`)
- Emplacement source : `assets/sounds/prout1.wav` à `prout20.wav`
- Emplacement dans l'APK : `res/raw/prout1.wav` à `res/raw/prout20.wav`

**⚠️ Point critique** : Android identifie les ressources par leur nom **SANS extension**. Le fichier `prout1.wav` devient la ressource `prout1`.

---

### 2. **`lib/notifications.ts`** - Gestion des Canaux Android

**Rôle** : Créer et configurer les canaux de notification Android avec les sons personnalisés.

**Localisation** : `lib/notifications.ts`

**Fonction principale** : `configureAndroidNotificationChannels()`

**Code clé** :
```typescript
const PROUT_SOUNDS = [
  'prout1','prout2','prout3',...,'prout20'
];

async function configureAndroidNotificationChannels() {
  if (Platform.OS !== 'android') return;

  for (const soundName of PROUT_SOUNDS) {
    const channelId = soundName; // "prout1", "prout2", etc.
    const soundResourceName = soundName; // "prout1" (SANS extension)
    
    await Notifications.setNotificationChannelAsync(channelId, {
      name: `Prout ${soundName}`,
      importance: Notifications.AndroidImportance.MAX,
      sound: soundResourceName, // ⚠️ Nom SANS extension
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      enableVibrate: true,
      bypassDnd: true,
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.NOTIFICATION,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
      }
    });
  }
}
```

**Ce que ça fait** :
1. ✅ Crée 20 canaux Android (un par son prout)
2. ✅ Chaque canal a un ID = nom du son (`prout1`, `prout2`, etc.)
3. ✅ Chaque canal est configuré avec le son correspondant (`sound: "prout1"`)
4. ✅ Configure la vibration, la visibilité, etc.

**Fonctions exportées** :
- `ensureAndroidNotificationChannel()` : Fonction principale appelée par l'app
- `getChannelIdForSound(soundName)` : Retourne le channelId pour un son
- `registerForPushNotificationsAsync()` : Enregistre le token et configure les canaux

**⚠️ Point critique** : 
- Le `sound` dans le canal doit être le nom **SANS extension** (`"prout1"` pas `"prout1.wav"`)
- Android résout automatiquement `"prout1"` vers `res/raw/prout1.wav`

---

### 3. **`app/_layout.tsx`** - Initialisation au Démarrage

**Rôle** : Appeler la création des canaux Android au démarrage de l'application.

**Localisation** : `app/_layout.tsx`

**Code clé** :
```typescript
import { ensureAndroidNotificationChannel } from '../lib/notifications';

useEffect(() => {
  // 📢 CONFIGURATION DES CANAUX ANDROID AU DÉMARRAGE
  if (Platform.OS === 'android') {
    ensureAndroidNotificationChannel();
  }
  
  // ... reste du code
}, []);
```

**Ce que ça fait** :
- ✅ Appelle `ensureAndroidNotificationChannel()` au démarrage
- ✅ Seulement sur Android (ignoré sur iOS)
- ✅ Les canaux sont créés une seule fois (Android les cache)

**Configuration globale des notifications** :
```typescript
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true, // Son système (pas le son personnalisé)
    shouldSetBadge: false,
  }),
});
```

**⚠️ Point important** : 
- Les canaux Android sont **persistants** une fois créés
- Pour les modifier, il faut **désinstaller complètement** l'app
- C'est pourquoi on supprime d'abord les anciens canaux avant de les recréer

---

### 4. **`backend/src/prout/prout.service.ts`** - Envoi des Notifications

**Rôle** : Envoyer les notifications push avec le bon `channelId` pour Android.

**Localisation** : `backend/src/prout/prout.service.ts`

**Code clé** :
```typescript
async sendProut(token: string, senderPseudo: string, proutKey: string) {
  // proutKey = "prout1", "prout2", etc.
  
  const message = {
    to: token,
    title: 'PROUT ! 💨',
    body: `${senderPseudo} t'a envoyé : ${proutName}`,
    
    // 🍎 iOS : Nom avec extension .wav
    sound: `${proutKey}.wav`, // "prout1.wav"
    
    // 🤖 ANDROID : Le channelId détermine le son
    android: {
      channelId: proutKey, // "prout1" (doit correspondre au canal créé)
      icon: './assets/images/icon.png',
      color: '#ebb89b',
      vibrate: [0, 250, 250, 250],
      // ❌ PAS de champ "sound" ici - le canal le gère
    },
    
    data: { 
      type: 'prout',
      proutKey: proutKey,
      sender: senderPseudo,
      proutName: proutName
    },
    priority: 'high' as const,
  };

  await this.expo.sendPushNotificationsAsync([message]);
}
```

**Ce que ça fait** :
1. ✅ Construit le payload Expo Push
2. ✅ Pour iOS : utilise `sound: "prout1.wav"` (avec extension)
3. ✅ Pour Android : utilise `android.channelId: "prout1"` (sans extension)
4. ✅ Android utilise le son défini dans le canal `prout1`

**⚠️ Points critiques** :
- Le `channelId` doit **correspondre exactement** au canal créé dans `lib/notifications.ts`
- Pas de champ `sound` dans `android` - le canal gère le son
- Expo Server SDK route automatiquement vers APNs (iOS) ou FCM (Android)

---

## 🔄 Flux Complet d'une Notification

### Étape par étape :

```
1. BUILD TIME (EAS Build)
   └─> app.json déclare les fichiers .wav
   └─> Expo les inclut dans l'APK/AAB
   └─> Fichiers copiés dans res/raw/prout1.wav, etc.

2. APP STARTUP (Premier lancement)
   └─> app/_layout.tsx s'exécute
   └─> Appelle ensureAndroidNotificationChannel()
   └─> lib/notifications.ts crée 20 canaux
   └─> Chaque canal = { id: "prout1", sound: "prout1" }
   └─> Android stocke ces canaux dans les paramètres système

3. NOTIFICATION SENT (Backend)
   └─> backend/src/prout/prout.service.ts reçoit une demande
   └─> Construit le payload avec channelId: "prout1"
   └─> Envoie via Expo Server SDK
   └─> Expo route vers FCM (Android) ou APNs (iOS)

4. NOTIFICATION RECEIVED (App Android)
   └─> Android reçoit la notification via FCM
   └─> Android lit le channelId: "prout1"
   └─> Android cherche le canal "prout1" dans les paramètres
   └─> Android trouve sound: "prout1" dans le canal
   └─> Android résout "prout1" → res/raw/prout1.wav
   └─> Android joue le fichier prout1.wav ✅

5. APP STATE
   ├─> App fermée : Android joue le son automatiquement ✅
   ├─> App en background : Android joue le son automatiquement ✅
   └─> App en foreground : Le handler dans _layout.tsx peut jouer un son aussi
```

---

## 🗂️ Structure des Fichiers dans l'APK

Après le build, voici où se trouvent les fichiers :

```
app-debug.apk ou app-release.aab
└── res/
    └── raw/
        ├── prout1.wav    ← Ressource Android: "prout1"
        ├── prout2.wav    ← Ressource Android: "prout2"
        ├── prout3.wav    ← Ressource Android: "prout3"
        └── ... (prout4 à prout20.wav)
```

**Comment Android les référence** :
- Fichier : `res/raw/prout1.wav`
- Ressource Android : `prout1` (nom sans extension)
- URI Android : `android.resource://com.fuzztrack.proutapp/raw/prout1`

---

## ⚙️ Configuration des Canaux

### Paramètres importants :

```typescript
{
  name: "Prout prout1",              // Nom visible dans les paramètres Android
  importance: AndroidImportance.MAX, // Priorité maximale
  sound: "prout1",                   // Nom de la ressource (SANS extension)
  vibrationPattern: [0, 250, 250, 250], // Motif de vibration
  lockscreenVisibility: PUBLIC,      // Visible sur écran verrouillé
  enableVibrate: true,               // Activer la vibration
  bypassDnd: true,                   // Contourner "Ne pas déranger"
  audioAttributes: {
    usage: NOTIFICATION,             // Usage = notification
    contentType: SONIFICATION,       // Type = son de notification
  }
}
```

---

## 🐛 Points de Dépannage

### Problème : Le son ne joue pas

**Causes possibles** :

1. **Canaux mal configurés**
   - ✅ Vérifier que `sound` dans le canal est SANS extension (`"prout1"` pas `"prout1.wav"`)
   - ✅ Vérifier que le `channelId` envoyé correspond au canal créé

2. **Fichiers non inclus dans l'APK**
   - ✅ Vérifier `app.json` : les fichiers doivent être dans `sounds`
   - ✅ Vérifier le build : `unzip -l app.apk | grep "res/raw/prout"`

3. **Canaux obsolètes**
   - ✅ Désinstaller complètement l'app
   - ✅ Les canaux Android sont persistants, même après mise à jour

4. **Build debug vs release**
   - ✅ Les sons peuvent fonctionner différemment en debug/release
   - ✅ Tester avec un build release (AAB)

### Commande de vérification :

```bash
# Vérifier les fichiers dans l'APK
unzip -l android/app/build/outputs/apk/debug/app-debug.apk | grep "res/raw.*\.wav"

# Vérifier les canaux créés (via logs Android)
adb logcat | grep -i "canal\|channel\|prout"
```

---

## 📊 Résumé des Correspondances

| Élément | Valeur | Format |
|---------|--------|--------|
| **Fichier source** | `assets/sounds/prout1.wav` | Avec extension |
| **Dans app.json** | `"./assets/sounds/prout1.wav"` | Avec extension |
| **Dans l'APK** | `res/raw/prout1.wav` | Avec extension |
| **Ressource Android** | `prout1` | **SANS extension** |
| **Channel ID** | `"prout1"` | **SANS extension** |
| **Sound dans canal** | `"prout1"` | **SANS extension** |
| **Backend channelId** | `"prout1"` | **SANS extension** |
| **iOS sound** | `"prout1.wav"` | Avec extension |

---

## 🎯 Règles d'Or

1. ✅ **Android = nom SANS extension** (`"prout1"`)
2. ✅ **iOS = nom AVEC extension** (`"prout1.wav"`)
3. ✅ **ChannelId = nom du son** (identique)
4. ✅ **Désinstaller l'app** pour réinitialiser les canaux
5. ✅ **Build release** pour tester les sons correctement

---

## 📝 Fichiers de Référence

Tous les fichiers modifiables :

1. **`app.json`** - Configuration des fichiers audio
2. **`lib/notifications.ts`** - Création des canaux Android
3. **`app/_layout.tsx`** - Initialisation des canaux
4. **`backend/src/prout/prout.service.ts`** - Envoi des notifications
5. **`assets/sounds/*.wav`** - Fichiers audio source (20 fichiers)

---

## 🔍 Logs Utiles

Les logs montrent :
- ✅ Création des canaux : `✅ [ANDROID] Canal créé: prout1 avec son: prout1`
- ✅ Vérification : `📋 [ANDROID] Canaux prout trouvés: 20`
- ✅ Configuration : `"sound": "prout1"` (dans les logs)

Si vous voyez `(son: custom)` dans les logs, c'est normal - cela signifie qu'un son personnalisé est configuré.

---

**Document créé le** : $(date)
**Version** : 1.0

