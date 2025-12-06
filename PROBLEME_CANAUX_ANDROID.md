# 🔴 Problème : Canaux Android non créés au démarrage

## ❌ Symptôme

Dans les logs Android (ligne 599) :
```
W FirebaseMessaging: Notification Channel set in AndroidManifest.xml has not been created by the app. Default value will be used.
```

**Résultat** : Le son système est joué au lieu du son personnalisé.

## 🔍 Cause

Les canaux Android sont créés dans le code JavaScript (`lib/notifications.ts`), mais :

1. **Si l'app est fermée** : Le code JavaScript ne s'exécute pas
2. **Firebase reçoit la notification** : AVANT que l'app ne démarre
3. **Les canaux n'existent pas encore** : Firebase utilise le canal fallback avec le son système

## ✅ Solution

Les canaux doivent être créés **au niveau natif Android**, dans un fichier Java/Kotlin qui s'exécute au démarrage de l'app, **AVANT** que le code JavaScript ne s'exécute.

### Option 1 : Créer les canaux dans MainApplication.kt (Recommandé)

Créer un fichier natif qui crée les canaux au démarrage de l'app.

**Fichier** : `android/app/src/main/java/com/fuzztrack/proutapp/NotificationChannelHelper.kt`

```kotlin
package com.fuzztrack.proutapp

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.os.Build

object NotificationChannelHelper {
    fun createChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Créer les 20 canaux prout
        for (i in 1..20) {
            val channelId = "prout$i"
            val channelName = "Prout $channelId"
            
            val channel = NotificationChannel(
                channelId,
                channelName,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 250, 250, 250)
                enableLights(true)
                lightColor = 0xFFEBB89B.toInt()
                setBypassDnd(true)
                
                // Son personnalisé (sans extension)
                val soundUri = android.net.Uri.parse("android.resource://${context.packageName}/raw/$channelId")
                setSound(soundUri, AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build())
            }
            
            notificationManager.createNotificationChannel(channel)
        }
    }
}
```

**Modifier** : `android/app/src/main/java/com/fuzztrack/proutapp/MainApplication.kt`

```kotlin
// ... existing code ...

override fun onCreate() {
    super.onCreate()
    
    // Créer les canaux de notification au démarrage
    NotificationChannelHelper.createChannels(this)
    
    // ... rest of onCreate ...
}
```

### Option 2 : Utiliser un plugin Expo (Plus complexe)

Créer un plugin Expo qui génère le code natif automatiquement.

## 🚀 Prochaines étapes

1. Créer le fichier `NotificationChannelHelper.kt`
2. Modifier `MainApplication.kt` pour appeler `createChannels()` au démarrage
3. Rebuilder l'application
4. Tester avec l'app fermée

## 📋 Vérification

Après correction, les logs devraient montrer :
- ✅ Les canaux créés au démarrage (logs natifs Android)
- ✅ Firebase trouve le canal `prout1` au lieu du canal fallback
- ✅ Son personnalisé joué au lieu du son système


