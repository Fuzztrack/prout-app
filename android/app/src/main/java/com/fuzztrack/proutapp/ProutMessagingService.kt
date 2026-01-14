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
        
        // ✅ AJOUT : Compteur unique pour garantir qu'aucun ID ne se chevauche
        // System.currentTimeMillis() peut générer des doublons en cas de rafale
        private val notificationIdCounter = java.util.concurrent.atomic.AtomicInteger(0)
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
        val proutName = mutableData["proutName"] ?: "Prout mystère"
        val sender = mutableData["sender"] ?: "Un ami"
        // ✅ Utiliser le message complet du backend (qui inclut customMessage si présent)
        // Le backend envoie notificationBody dans data.message (ligne 455 du backend)
        val body = mutableData["message"] ?: "$sender t'a envoyé : $proutName"

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
        val uri = Uri.parse("${ContentResolver.SCHEME_ANDROID_RESOURCE}://$packageName/$resId")
        Log.d(TAG, "🔊 Résolution son pour $proutKey -> resId: $resId, URI: $uri")
        return uri
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

        // 1. GÉNÉRER UN ID UNIQUE
        // On utilise un compteur atomique (1, 2, 3...) pour être sûr qu'ils sont uniques
        // même s'ils arrivent dans la même milliseconde.
        val notificationId = notificationIdCounter.incrementAndGet()

        val pendingIntent = PendingIntent.getActivity(
            this,
            notificationId, // ⚠️ IMPORTANT : Utiliser l'ID unique ici aussi pour le RequestCode
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

            // 🔥🔥🔥 LA CORRECTION POUR LE PIXEL 8 EST ICI 🔥🔥🔥
            
            // 2. FORCER L'ALERTE SYSTÉMATIQUE
            // Par défaut, Android met à true si c'est rapproché. On force à false.
            .setOnlyAlertOnce(false)

            // 3. GROUPER MAIS FORCER LE SON
            // On met tout dans un groupe pour que ce soit propre visuellement...
            .setGroup("PROUT_GROUP_RAFALE")
            // ...MAIS on dit "Sonne pour TOUS les enfants du groupe", pas juste le résumé.
            .setGroupAlertBehavior(NotificationCompat.GROUP_ALERT_ALL)
            
            // 4. TIMEOUT DE SON
            // Petite astuce : définir un timeout force parfois le système à traiter l'urgence
            .setTimeoutAfter(60000) // 1 minute

        // Compatibilité anciens Android
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            builder.setSound(soundUri)
            Log.d(TAG, "🔊 setSound() appelé (Android < 8.0) avec URI: $soundUri")
        } else {
            // Sur Android 8.0+, le son du canal sera utilisé automatiquement
            Log.d(TAG, "🔊 Son du canal utilisé automatiquement pour: $channelId (URI: $soundUri)")
        }

        try {
            NotificationManagerCompat.from(this).notify(notificationId, builder.build())
            Log.d(TAG, "🚀 Notification envoyée (ID: $notificationId) - Alerte forcée sur $channelId")
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
            pseudo + " souhaite savoir qui tu es."
        } else {
            pseudo + " a partagé son identité."
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
        Log.d(TAG, "🔑 Nouveau token FCM: " + token)
    }
}
