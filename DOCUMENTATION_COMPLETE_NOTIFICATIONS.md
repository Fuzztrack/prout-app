# Documentation Complète : Système de Notifications et Lecture des Sons - ProutApp

## Table des matières
1. [Vue d'ensemble](#vue-densemble)
2. [Architecture](#architecture)
3. [Fichiers et Code Sources](#fichiers-et-code-sources)
4. [Flux d'exécution](#flux-dexécution)
5. [Configuration Backend (CRITIQUE)](#configuration-backend-critique)
6. [Problèmes connus et solutions](#problèmes-connus-et-solutions)
7. [Commandes de débogage](#commandes-de-débogage)

---

## Vue d'ensemble

Le système de notifications ProutApp utilise Firebase Cloud Messaging (FCM) pour recevoir les notifications push. La lecture des sons est gérée **uniquement par les canaux de notification Android** (méthode native recommandée par Google).

**Architecture simplifiée et universelle** :
- **Android < 8.0** : Utilise `setSound()` dans le builder de notification
- **Android 8.0+** : Utilise le son configuré dans le canal de notification (toutes versions, y compris Android 14+)
- **Pas de MediaPlayer manuel** : On laisse Android gérer le son nativement via les canaux

**Version des canaux** : **v5** (pour réinitialiser proprement sur le Pixel 8)

---

## Architecture

### Composants principaux

1. **ChannelInitProvider** : Crée les 20 canaux au démarrage (très tôt)
2. **NotificationChannelHelper** : Logique de création des canaux avec nettoyage des anciennes versions
3. **ProutMessagingService** : Service FCM qui reçoit et traite les notifications (Data Messages uniquement)
4. **Backend** : Envoie uniquement des Data Messages pour Android (pas de champ `notification`)

---

## Fichiers et Code Sources

### 1. ChannelInitProvider.kt

**Chemin** : `android/app/src/main/java/com/fuzztrack/proutapp/ChannelInitProvider.kt`

**Rôle** : ContentProvider qui initialise les 20 canaux de notification au démarrage de l'app, avant même que l'Application ne soit créée.

```kotlin
package com.fuzztrack.proutapp

import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.net.Uri
import android.util.Log
import androidx.annotation.Keep

/**
 * Provider d'initialisation ultra-tôt (avant Application.onCreate)
 * pour s'assurer que les 20 canaux sont créés dès la première installation,
 * y compris avec les AAB (où certaines ressources peuvent être différées).
 */
@Keep
class ChannelInitProvider : ContentProvider() {
    override fun onCreate(): Boolean {
        return try {
            context?.let {
                NotificationChannelHelper.createChannels(it.applicationContext)
                Log.d("ChannelInitProvider", "✅ Canaux initialisés au plus tôt (ContentProvider)")
            }
            true
        } catch (e: Exception) {
            Log.e("ChannelInitProvider", "❌ Échec init canaux via ContentProvider", e)
            false
        }
    }

    // Les méthodes suivantes ne sont pas utilisées ; stubs requis par ContentProvider.
    override fun query(uri: Uri, projection: Array<out String>?, selection: String?, selectionArgs: Array<out String>?, sortOrder: String?): Cursor? = null
    override fun getType(uri: Uri): String? = null
    override fun insert(uri: Uri, values: ContentValues?): Uri? = null
    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0
    override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?): Int = 0
}
```

---

### 2. NotificationChannelHelper.kt

**Chemin** : `android/app/src/main/java/com/fuzztrack/proutapp/NotificationChannelHelper.kt`

**Rôle** : Crée les 20 canaux de notification avec leurs sons respectifs. Nettoie les anciennes versions (v4).

```kotlin
package com.fuzztrack.proutapp

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.ContentResolver
import android.content.Context
import android.media.AudioAttributes
import android.os.Build

object NotificationChannelHelper {
    // Référence explicite aux ressources pour éviter le shrink en AAB
    private val PR0UT_RAW_RES = intArrayOf(
        R.raw.prout1, R.raw.prout2, R.raw.prout3, R.raw.prout4, R.raw.prout5,
        R.raw.prout6, R.raw.prout7, R.raw.prout8, R.raw.prout9, R.raw.prout10,
        R.raw.prout11, R.raw.prout12, R.raw.prout13, R.raw.prout14, R.raw.prout15,
        R.raw.prout16, R.raw.prout17, R.raw.prout18, R.raw.prout19, R.raw.prout20
    )

    fun createChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Nettoyage des vieilles versions (v4) pour ne pas polluer les settings de l'utilisateur
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            notificationManager.notificationChannels.forEach { channel ->
                if (channel.id.contains("-v4")) {
                    notificationManager.deleteNotificationChannel(channel.id)
                    android.util.Log.d("NotificationChannelHelper", "🗑️ Ancien canal supprimé: ${channel.id}")
                }
            }
        }

        for (i in 1..20) {
            val proutKey = "prout$i"
            // v5 pour réinitialiser proprement sur le Pixel 8
            val channelId = "prout-$proutKey-v5"
            
            // Vérifier si le canal existe déjà
            val existingChannel = notificationManager.getNotificationChannel(channelId)
            if (existingChannel != null) {
                // Le canal existe déjà, on passe au suivant
                continue
            }

            val channelName = "Son : $proutKey"
            val channelDescription = "Canal dédié au son $proutKey"
            // Utiliser directement l'ID de ressource pour construire l'URI
            val resId = if (i in 1..PR0UT_RAW_RES.size) PR0UT_RAW_RES[i - 1] else PR0UT_RAW_RES[0]
            // Format URI le plus robuste pour Android
            val soundUri = android.net.Uri.parse("${ContentResolver.SCHEME_ANDROID_RESOURCE}://${context.packageName}/${resId}")
            val audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()

            val channel = NotificationChannel(
                channelId,
                channelName,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = channelDescription
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 250, 250, 250)
                enableLights(true)
                lightColor = 0xFFEBB89B.toInt()
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
                // 🔥 CONFIGURATION AUDIO CRITIQUE
                setSound(soundUri, audioAttributes)
            }

            notificationManager.createNotificationChannel(channel)
            android.util.Log.d("NotificationChannelHelper", "✅ Canal créé avec son natif : $channelId -> $soundUri")
        }
    }
}
```

---

### 3. ProutMessagingService.kt

**Chemin** : `android/app/src/main/java/com/fuzztrack/proutapp/ProutMessagingService.kt`

**Rôle** : Service Firebase Cloud Messaging qui reçoit les notifications push et gère la lecture des sons via les canaux natifs.

**Code complet** :

```kotlin
package com.fuzztrack.proutapp

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import org.json.JSONObject

class ProutMessagingService : FirebaseMessagingService() {
    
    // Mapping direct pour éviter la réflexion (plus rapide et sûr pour R8/Proguard)
    private val PROUT_RESOURCE_IDS = mapOf(
        "prout1" to R.raw.prout1, "prout2" to R.raw.prout2, "prout3" to R.raw.prout3,
        "prout4" to R.raw.prout4, "prout5" to R.raw.prout5, "prout6" to R.raw.prout6,
        "prout7" to R.raw.prout7, "prout8" to R.raw.prout8, "prout9" to R.raw.prout9,
        "prout10" to R.raw.prout10, "prout11" to R.raw.prout11, "prout12" to R.raw.prout12,
        "prout13" to R.raw.prout13, "prout14" to R.raw.prout14, "prout15" to R.raw.prout15,
        "prout16" to R.raw.prout16, "prout17" to R.raw.prout17, "prout18" to R.raw.prout18,
        "prout19" to R.raw.prout19, "prout20" to R.raw.prout20
    )

    companion object {
        private const val TAG = "ProutMessagingService"
        private const val CHANNEL_PREFIX = "prout-"
        // 🔥 CHANGEMENT DE VERSION : v5 pour réinitialiser proprement sur le Pixel 8
        private const val CHANNEL_VERSION = "v5"
        private const val DEFAULT_CHANNEL_ID = "prout-default"
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        Log.d(TAG, "🔥🔥🔥 ProutMessagingService.onMessageReceived appelé !")
        Log.d(TAG, "📨 Message reçu: ${remoteMessage.data}")

        // On traite uniquement les Data Messages.
        // Si "notification" est présent dans le payload, Android prend la main et ignore ce code en background.
        val data = remoteMessage.data
        if (data.isEmpty()) {
            Log.w(TAG, "⚠️ Payload data vide - notification ignorée (utiliser data messages uniquement)")
            return
        }

        val messageType = data["type"]
        Log.d(TAG, "Message Type: $messageType")

        if (messageType == "identity_request" || messageType == "identity_response") {
            handleIdentityNotification(messageType ?: "identity_request", data.toMutableMap())
            return
        }

        // Parsing du proutKey depuis body si nécessaire
        val mutableData = data.toMutableMap()
        if (mutableData["proutKey"].isNullOrEmpty() && !mutableData["body"].isNullOrEmpty()) {
            try {
                val json = JSONObject(mutableData["body"])
                mutableData["proutKey"] = json.optString("proutKey", mutableData["proutKey"])
                mutableData["title"] = json.optString("title", mutableData["title"])
                mutableData["message"] = json.optString("message", mutableData["message"])
                mutableData["sender"] = json.optString("sender", mutableData["sender"])
                mutableData["proutName"] = json.optString("proutName", mutableData["proutName"])
                Log.d(TAG, "Parsed proutKey from body: ${mutableData["proutKey"]}")
            } catch (e: Exception) {
                Log.e(TAG, "❌ Erreur parsing body JSON: ${e.message}")
            }
        }

        val proutKey = mutableData["proutKey"]?.lowercase() ?: "prout1"
        val title = mutableData["title"] ?: "PROUT ! 💨"
        val proutName = mutableData["proutName"] ?: mutableData["message"] ?: "Prout mystère"
        val sender = mutableData["sender"] ?: "Un ami"
        val body = "$sender t'a envoyé : $proutName"

        // 1. Résolution du son
        val soundUri = resolveSoundUri(proutKey)
        
        // 2. Création/Vérification du canal (Le système gère le son ici)
        val channelId = ensureChannel(this, proutKey, soundUri)
        
        // 3. Affichage
        showNotification(channelId, title, body, soundUri, proutKey, sender)
    }

    private fun resolveSoundUri(proutKey: String): Uri {
        val resId = PROUT_RESOURCE_IDS[proutKey.lowercase()] ?: R.raw.prout1
        // Format URI le plus robuste pour Android
        return Uri.parse("${ContentResolver.SCHEME_ANDROID_RESOURCE}://$packageName/$resId")
    }

    private fun ensureChannel(context: Context, proutKey: String, soundUri: Uri): String {
        // Pour Android < 8 (Oreo), pas de canaux
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return "default_legacy_channel"
        }

        val channelId = "$CHANNEL_PREFIX$proutKey-$CHANNEL_VERSION"
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Vérification si le canal existe
        val existingChannel = manager.getNotificationChannel(channelId)
        if (existingChannel != null) {
            // Optionnel : Vérifier si l'utilisateur a coupé le son de ce canal spécifique
            if (existingChannel.importance == NotificationManager.IMPORTANCE_NONE) {
                Log.w(TAG, "⚠️ L'utilisateur a désactivé ce canal de prout : $channelId")
            }
            Log.d(TAG, "✅ Canal existe déjà: $channelId")
            return channelId
        }

        // Création du canal
        val channelName = "Son : $proutKey"
        val channelDescription = "Canal dédié au son $proutKey"
        
        val channel = NotificationChannel(channelId, channelName, NotificationManager.IMPORTANCE_HIGH).apply {
            description = channelDescription
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 250, 250, 250)
            enableLights(true)
            lightColor = 0xFFEBB89B.toInt()
            lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            
            // 🔥 CONFIGURATION AUDIO CRITIQUE
            val audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            
            setSound(soundUri, audioAttributes)
        }

        manager.createNotificationChannel(channel)
        Log.d(TAG, "✅ Canal créé avec son natif : $channelId -> $soundUri")
        return channelId
    }

    private fun showNotification(
        channelId: String,
        title: String,
        body: String,
        soundUri: Uri,
        proutKey: String,
        sender: String
    ) {
        val intent = Intent(this, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = Uri.parse("proutapp://")
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("proutKey", proutKey)
            putExtra("sender", sender)
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            System.currentTimeMillis().toInt(), // ID unique pour chaque notif
            intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )

        // Icône : assure-toi d'avoir un drawable transparent pour la status bar
        val iconId = resources.getIdentifier("notification_icon", "drawable", packageName).takeIf { it != 0 }
            ?: android.R.drawable.ic_dialog_info

        val builder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(iconId)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)

        // Pour les vieux Android (< 8.0), on attache le son au builder
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            builder.setSound(soundUri)
            Log.d(TAG, "🔊 setSound() appelé (Android < 8.0) avec URI: $soundUri")
        } else {
            // Sur Android 8.0+, le son du canal sera utilisé automatiquement
            Log.d(TAG, "🔊 Son du canal utilisé automatiquement pour: $channelId (URI: $soundUri)")
        }

        try {
            // ID unique pour ne pas écraser les notifs précédentes
            val notificationId = System.currentTimeMillis().toInt()
            NotificationManagerCompat.from(this).notify(notificationId, builder.build())
            Log.d(TAG, "🚀 Notification envoyée (ID: $notificationId) sur $channelId")
        } catch (e: SecurityException) {
            Log.e(TAG, "❌ Erreur permission notification : ${e.message}")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Erreur fatale notification : ${e.message}")
        }
    }

    private fun handleIdentityNotification(type: String, payload: MutableMap<String, String>) {
        val isRequest = type == "identity_request"
        val title = if (isRequest) "Demande d'identité" else "Identité révélée"
        val pseudo = if (isRequest) {
            payload["requesterPseudo"] ?: payload["sender"] ?: "Un ami"
        } else {
            payload["sender"] ?: "Un ami"
        }
        val body = if (isRequest) {
            "$pseudo souhaite savoir qui tu es."
        } else {
            "$pseudo a partagé son identité."
        }

        val intent = Intent(this, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            setData(Uri.parse("proutapp://"))
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("notificationType", type)
            putExtra("requesterId", payload["requesterId"])
            putExtra("requesterPseudo", payload["requesterPseudo"])
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            System.currentTimeMillis().toInt(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val channelId = "identity-channel"
        ensureIdentityChannel(channelId)

        val builder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)

        NotificationManagerCompat.from(this).notify((channelId + type).hashCode(), builder.build())
    }

    private fun ensureIdentityChannel(channelId: String) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java)
        val existing = manager.getNotificationChannel(channelId)
        if (existing != null) return

        val channel = NotificationChannel(
            channelId,
            "Identité",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Notifications de demande/réponse d'identité"
            enableVibration(true)
        }
        manager.createNotificationChannel(channel)
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "🔑 Nouveau token FCM: $token")
    }
}
```

**Fonctions principales** :
- `onMessageReceived()` : Point d'entrée pour les notifications FCM (Data Messages uniquement)
- `resolveSoundUri()` : Résout le proutKey vers l'URI du son (utilise `ContentResolver.SCHEME_ANDROID_RESOURCE`)
- `ensureChannel()` : Crée/vérifie le canal avec son natif
- `showNotification()` : Affiche la notification (le son est géré par le canal)
- `handleIdentityNotification()` : Gère les notifications d'identité

---

### 4. AndroidManifest.xml

**Chemin** : `android/app/src/main/AndroidManifest.xml`

**Rôle** : Enregistre les services et providers nécessaires.

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools">
  <!-- Permissions -->
  <uses-permission android:name="android.permission.INTERNET"/>
  <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
  <uses-permission android:name="android.permission.VIBRATE"/>
  <!-- ... autres permissions ... -->
  
  <application>
    <!-- Initialise les 20 canaux de notification au démarrage de l'appli -->
    <provider 
        android:name=".ChannelInitProvider" 
        android:authorities="${applicationId}.channelinitprovider" 
        android:exported="false" 
        android:initOrder="100"/>
    
    <!-- Service FCM pour recevoir les notifications -->
    <service 
        android:name=".ProutMessagingService" 
        android:exported="false">
      <intent-filter>
        <action android:name="com.google.firebase.MESSAGING_EVENT"/>
      </intent-filter>
    </service>
    
    <!-- ... autres composants ... -->
  </application>
</manifest>
```

---

## Flux d'exécution

### Cas 1 : Android 8.0+ (toutes versions, y compris Android 14+)

1. **FCM reçoit la notification** → `ProutMessagingService.onMessageReceived()`
   - ⚠️ **CRITIQUE** : Le backend doit envoyer uniquement des **Data Messages** (pas de champ `notification`)
2. **Parsing du payload** → Extraction de `proutKey`, `sender`, `proutName`, `type` depuis `data`
3. **Résolution du son** → `resolveSoundUri(proutKey)` → URI avec `ContentResolver.SCHEME_ANDROID_RESOURCE`
4. **Création/Vérification du canal** → `ensureChannel()` → Vérifie/crée le canal avec son natif
5. **Dans `showNotification()`** :
   - Utilise le canal normal (avec son configuré)
   - **Ne pas** appeler `setSound()` dans le builder (le canal gère le son)
   - Envoie la notification
   - **Résultat** : Son joué automatiquement par le canal natif Android

### Cas 2 : Android < 8.0

1. **FCM reçoit la notification** → `ProutMessagingService.onMessageReceived()`
2. **Parsing du payload** → Extraction de `proutKey`, `sender`, etc.
3. **Résolution du son** → `resolveSoundUri(proutKey)` → URI de la ressource
4. **Création du canal** → `ensureChannel()` → Retourne `"default_legacy_channel"` (canaux n'existent pas avant Android 8.0)
5. **Dans `showNotification()`** :
   - Détecte Android < 8.0
   - Appelle `builder.setSound(soundUri)` explicitement
   - Envoie la notification
   - **Résultat** : Son joué via `setSound()`

---

## Configuration Backend (CRITIQUE)

### ⚠️ Pour que `onMessageReceived` soit toujours appelé

Le backend **DOIT** envoyer uniquement des **Data Messages** pour Android. Si le champ `notification` est présent, Android prend la main et ignore `onMessageReceived` en background.

### Payload JSON Correct (Backend)

**Pour Android** :
```json
{
  "token": "TOKEN_DU_DEVICE",
  "priority": "high",
  "content_available": true,
  "android": {
    "priority": "high"
  },
  "data": {
    "type": "prout",
    "proutKey": "prout12",
    "title": "PROUT ! 💨",
    "sender": "Batman",
    "proutName": "Le discret",
    "message": "Batman t'a envoyé : Le discret",
    "senderId": "...",
    "receiverId": "..."
  }
  // ⚠️ PAS de clé "notification" ici pour Android !
}
```

**Code Backend (TypeScript)** :
```typescript
// Dans sendViaFCM() - backend/src/prout/prout.service.ts
const message: admin.messaging.Message = {
  token,
  // ⚠️ notification supprimé pour Android - le code natif gère tout
  android: {
    priority: 'high',
    // ⚠️ PAS de champ "notification" ici
  },
  data: {
    type: 'prout',
    proutKey,
    title: 'PROUT ! 💨',
    sender,
    proutName,
    message: notificationBody,
    ...(customMessage && { customMessage }),
    ...(extraData?.senderId && { senderId: extraData.senderId }),
    ...(extraData?.receiverId && { receiverId: extraData.receiverId }),
  }
};
```

---

## Problèmes connus et solutions

### Problème 1 : `onMessageReceived` n'est pas appelé en background

**Symptôme** : Les notifications arrivent mais `onMessageReceived` n'est jamais appelé quand l'app est fermée.

**Cause** : Le backend envoie un champ `notification` dans le payload FCM. Android prend alors la main et ignore `onMessageReceived`.

**Solution** : Supprimer le champ `notification` pour Android. Utiliser uniquement des Data Messages.

**Code** : Voir section [Configuration Backend](#configuration-backend-critique).

---

### Problème 2 : Pas de son sur certains appareils Android 14+

**Symptôme** : Le son ne joue pas même si le canal est configuré correctement.

**Cause** : Le canal peut être désactivé par l'utilisateur ou mal configuré.

**Solution** : 
- Utiliser `ContentResolver.SCHEME_ANDROID_RESOURCE` pour les URIs (plus robuste)
- Vérifier que le canal existe et est activé avant d'envoyer la notification
- Passer à la version v5 pour réinitialiser les canaux

**Code** : Voir `resolveSoundUri()` et `ensureChannel()` dans `ProutMessagingService.kt`.

---

### Problème 3 : Double son

**Symptôme** : Le son joue deux fois.

**Cause** : Ancien code avec MediaPlayer + canal sonore.

**Solution** : Utiliser uniquement le canal natif. Pas de MediaPlayer manuel.

**Code** : Le code actuel utilise uniquement les canaux natifs.

---

## Mapping des ressources sonores

Les fichiers sons sont dans `assets/sounds/` :
- `prout1.wav` → `R.raw.prout1` → Canal `prout-prout1-v5`
- `prout2.wav` → `R.raw.prout2` → Canal `prout-prout2-v5`
- ...
- `prout20.wav` → `R.raw.prout20` → Canal `prout-prout20-v5`

**Mapping dans le code** :
```kotlin
private val PROUT_RESOURCE_IDS = mapOf(
    "prout1" to R.raw.prout1,
    "prout2" to R.raw.prout2,
    // ... jusqu'à prout20
)
```

**Format URI** : `android.resource://{packageName}/{resId}` (utilise `ContentResolver.SCHEME_ANDROID_RESOURCE`)

---

## Commandes de débogage

### Voir les logs en temps réel

```bash
adb logcat -v time ProutMessagingService:D ChannelInitProvider:D NotificationManager:D | grep -E "ProutMessagingService|ChannelInitProvider|setSound|Canal"
```

### Nettoyer les logs avant de tester

```bash
adb logcat -c
adb logcat -v time ProutMessagingService:D ChannelInitProvider:D
```

### Sauvegarder les logs dans un fichier

```bash
adb logcat -v time ProutMessagingService:D ChannelInitProvider:D > ~/Desktop/pixel8_logs.txt
```

### Logs importants à surveiller

- `🔥🔥🔥 ProutMessagingService.onMessageReceived appelé !` : Notification reçue (Data Message)
- `⚠️ Payload data vide` : Le backend envoie un Notification Message au lieu d'un Data Message
- `🔊 Résolution son pour {proutKey}` : Son résolu
- `✅ Canal existe déjà` : Canal valide, pas de recréation
- `✅ Canal créé avec son natif` : Canal créé avec son
- `🔊 Son du canal utilisé automatiquement` : Le son du canal sera joué
- `🚀 Notification envoyée` : Notification envoyée avec succès

---

## Constantes importantes

- **CHANNEL_PREFIX** : `"prout-"`
- **CHANNEL_VERSION** : `"v5"` (pour réinitialiser proprement sur le Pixel 8)
- **Format canal** : `prout-{proutKey}-v5`
- **Nombre de canaux** : 20 (prout1 à prout20)
- **Package** : `com.fuzztrack.proutapp`
- **Format URI** : `android.resource://{packageName}/{resId}` (utilise `ContentResolver.SCHEME_ANDROID_RESOURCE`)

---

## Résumé des fonctions principales

### ProutMessagingService

- `onMessageReceived()` : Point d'entrée pour les notifications FCM (Data Messages uniquement)
- `resolveSoundUri()` : Résout le proutKey vers l'URI du son (utilise `ContentResolver.SCHEME_ANDROID_RESOURCE`)
- `ensureChannel()` : Crée/vérifie le canal avec son natif
- `showNotification()` : Affiche la notification (le son est géré par le canal)
- `handleIdentityNotification()` : Gère les notifications d'identité

### NotificationChannelHelper

- `createChannels()` : Crée les 20 canaux au démarrage et nettoie les anciennes versions (v4)

### ChannelInitProvider

- `onCreate()` : Appelé très tôt pour initialiser les canaux

---

## Notes importantes

1. **Les canaux sont créés deux fois** :
   - Une fois au démarrage via `ChannelInitProvider` (tous les 20 canaux)
   - Une fois à la réception d'une notification si nécessaire (canal individuel)

2. **Backend doit envoyer uniquement des Data Messages** pour Android :
   - Pas de champ `notification` dans le payload
   - Tout doit être dans `data`
   - Sinon, `onMessageReceived` n'est pas appelé en background

3. **Le mapping des sons** doit être identique dans `ProutMessagingService` et `NotificationChannelHelper`.

4. **Version v5** : Les anciennes versions (v4) sont automatiquement supprimées au démarrage pour éviter la pollution des paramètres utilisateur.

---

**Dernière mise à jour** : 13 janvier 2025  
**Version** : v5 (canaux)  
**Système** : Natif Android (Kotlin) avec FCM - Architecture simplifiée (canaux natifs uniquement)
