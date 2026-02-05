package com.fuzztrack.proutapp

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
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

    companion object {
        private const val TAG = "ProutMessagingService"
        private const val CHANNEL_PREFIX = "prout-"
        private const val CHANNEL_VERSION = "v5"
        private const val DEFAULT_CHANNEL_ID = "prout-default"
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        Log.d(TAG, "🔥🔥🔥 ProutMessagingService.onMessageReceived appelé !")
        Log.d(TAG, "📨 Message reçu: " + remoteMessage.data)

        val data = remoteMessage.data.toMutableMap()
        if (data.isEmpty()) {
            Log.d(TAG, "Payload data is empty, checking notification field.")
            remoteMessage.notification?.let {
                showNotification(
                    ensureChannel(DEFAULT_CHANNEL_ID, Uri.EMPTY),
                    it.title ?: "PROUT ! 💨",
                    it.body ?: "Tu as reçu un prout !",
                    Uri.EMPTY,
                    null,
                    null
                )
            }
            return
        }

        val messageType = data["type"]
        Log.d(TAG, "Message Type: " + messageType)

        if (messageType == "identity_request" || messageType == "identity_response") {
            handleIdentityNotification(messageType ?: "identity_request", data)
            return
        }

        if (data["proutKey"].isNullOrEmpty() && !data["body"].isNullOrEmpty()) {
            try {
                val json = JSONObject(data["body"])
                data["proutKey"] = json.optString("proutKey", data["proutKey"])
                data["title"] = json.optString("title", data["title"])
                data["message"] = json.optString("message", data["message"])
                data["sender"] = json.optString("sender", data["sender"])
                data["proutName"] = json.optString("proutName", data["proutName"])
                Log.d(TAG, "Parsed proutKey from body: " + data["proutKey"])
            } catch (e: Exception) {
                Log.e(TAG, "❌ Erreur parsing body JSON: " + e.message)
            }
        }

        val proutKey = data["proutKey"]?.lowercase() ?: "prout1"
        val title = data["title"] ?: "PROUT ! 💨"
        val proutName = data["proutName"] ?: "Un prout surprise"
        val sender = data["sender"] ?: "Un ami"
        
        // Utiliser le message complet envoyé par le backend s'il existe
        // Sinon, construire le message par défaut
        val body = data["message"] ?: (sender + " t'a envoyé : " + proutName)

        val soundUri = resolveSoundUri(proutKey)
        val channelId = ensureChannel(proutKey, soundUri)
        Log.d(TAG, "Resolved Sound URI: " + soundUri + " for proutKey: " + proutKey)
        showNotification(channelId, title, body, soundUri, proutKey, sender)
    }

    private fun resolveSoundUri(proutKey: String): Uri {
        val resId = resources.getIdentifier(proutKey, "raw", packageName)
        return if (resId != 0) {
            Uri.parse("android.resource://" + packageName + "/" + resId)
        } else {
            Uri.parse("android.resource://" + packageName + "/" + R.raw.prout1)
        }
    }

    private fun ensureChannel(proutKeyInput: String, soundUri: Uri): String {
        val proutKey = proutKeyInput.ifBlank { DEFAULT_CHANNEL_ID }
        val channelId = CHANNEL_PREFIX + proutKey + "-" + CHANNEL_VERSION
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return channelId
        }

        val manager = getSystemService(NotificationManager::class.java)
        val existing = manager.getNotificationChannel(channelId)
        if (existing != null) {
            return channelId
        }

        val attrs = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()

        val channel = NotificationChannel(channelId, "Prout " + proutKey, NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Notifications personnalisées pour " + proutKey
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 250, 250, 250)
            setSound(soundUri, attrs)
            lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
        }

        manager.createNotificationChannel(channel)
        Log.d(TAG, "✅ Canal créé: " + channelId + " avec son: " + soundUri)
        return channelId
    }

    private fun showNotification(
        channelId: String,
        title: String,
        body: String,
        soundUri: Uri,
        proutKey: String?,
        sender: String?
    ) {
        val iconId = resources.getIdentifier("notification_icon", "drawable", packageName)
        val smallIcon = if (iconId != 0) iconId else android.R.drawable.ic_dialog_info

        val intent = Intent(this, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = Uri.parse("proutapp://")
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("proutKey", proutKey)
            putExtra("sender", sender)
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            System.currentTimeMillis().toInt(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(smallIcon)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setSound(soundUri)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)

        NotificationManagerCompat.from(this).notify(channelId.hashCode(), builder.build())
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
