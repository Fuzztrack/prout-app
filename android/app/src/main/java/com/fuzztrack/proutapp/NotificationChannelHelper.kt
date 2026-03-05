package com.fuzztrack.proutapp

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.os.Build

/**
 * Crée les 20 canaux "prout-prout{i}-v5" au démarrage (idempotent).
 *
 * Objectif: éviter les "ratés de son" quand un prout arrive sur un canal non créé.
 * Important: on référence explicitement R.raw.prout1..20 pour empêcher R8/shrinker
 * de supprimer des ressources raw en release (AAB).
 */
object NotificationChannelHelper {
    // Référence explicite aux ressources pour éviter le shrink en AAB
    private val PROUT_RAW_RES = intArrayOf(
        R.raw.prout1, R.raw.prout2, R.raw.prout3, R.raw.prout4, R.raw.prout5,
        R.raw.prout6, R.raw.prout7, R.raw.prout8, R.raw.prout9, R.raw.prout10,
        R.raw.prout11, R.raw.prout12, R.raw.prout13, R.raw.prout14, R.raw.prout15,
        R.raw.prout16, R.raw.prout17, R.raw.prout18, R.raw.prout19, R.raw.prout20
    )

    // Soundcheck (bzzz/trrl) : références explicites pour éviter le shrink en release
    private val EXTRA_SOUND_KEYS = arrayOf(
        "bzzz1", "bzzz2",
        "trrl1", "trrl2", "trrl3"
    )
    private val EXTRA_RAW_RES = intArrayOf(
        R.raw.bzzz1, R.raw.bzzz2,
        R.raw.trrl1, R.raw.trrl2, R.raw.trrl3
    )

    private const val CHANNEL_PREFIX = "prout-"
    private const val CHANNEL_VERSION = "v5"

    fun createChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            android.util.Log.d("NotificationChannelHelper", "⚠️ Android < O, pas de canaux")
            return
        }

        val notificationManager =
            context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val audioAttributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()

        var createdCount = 0
        var skippedCount = 0

        for (i in 1..20) {
            val proutKey = "prout$i"
            // Doit correspondre EXACTEMENT à ProutMessagingService.kt (prefix + key + -v5)
            val channelId = "$CHANNEL_PREFIX$proutKey-$CHANNEL_VERSION" // ex: prout-prout8-v5

            // Idempotent: si déjà créé, on passe
            if (notificationManager.getNotificationChannel(channelId) != null) {
                skippedCount++
                continue
            }

            val channelName = "Prout $proutKey"

            // Résolution du son via res/raw + ref explicite pour éviter le shrink
            val resId = PROUT_RAW_RES.getOrNull(i - 1) ?: 0
            if (resId == 0) {
                android.util.Log.e("NotificationChannelHelper", "❌ Ressource raw non trouvée pour $proutKey")
            }
            val resolvedName =
                if (resId != 0) context.resources.getResourceEntryName(resId) else proutKey
            val soundUri =
                android.net.Uri.parse("android.resource://${context.packageName}/raw/${resolvedName}")

            val channel = NotificationChannel(
                channelId,
                channelName,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications personnalisées pour $proutKey"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 250, 250, 250)
                enableLights(true)
                // Couleur (approx #ebb89b)
                lightColor = 0xFFEBB89B.toInt()
                setBypassDnd(true)
                setSound(soundUri, audioAttributes)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            }

            notificationManager.createNotificationChannel(channel)
            createdCount++
            android.util.Log.d("NotificationChannelHelper", "✅ Canal créé: $channelId (son: $soundUri)")
        }

        // Créer aussi les canaux Soundcheck (idempotent)
        for (idx in EXTRA_SOUND_KEYS.indices) {
            val proutKey = EXTRA_SOUND_KEYS[idx]
            val channelId = "$CHANNEL_PREFIX$proutKey-$CHANNEL_VERSION"
            if (notificationManager.getNotificationChannel(channelId) != null) {
                skippedCount++
                continue
            }

            val channelName = "Prout $proutKey"
            val resId = EXTRA_RAW_RES.getOrNull(idx) ?: 0
            val resolvedName =
                if (resId != 0) context.resources.getResourceEntryName(resId) else proutKey
            val soundUri =
                android.net.Uri.parse("android.resource://${context.packageName}/raw/${resolvedName}")

            val channel = NotificationChannel(
                channelId,
                channelName,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications personnalisées pour $proutKey"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 250, 250, 250)
                enableLights(true)
                lightColor = 0xFFEBB89B.toInt()
                setBypassDnd(true)
                setSound(soundUri, audioAttributes)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            }

            notificationManager.createNotificationChannel(channel)
            createdCount++
            android.util.Log.d("NotificationChannelHelper", "✅ Canal créé: $channelId (son: $soundUri)")
        }

        android.util.Log.d(
            "NotificationChannelHelper",
            "📊 Canaux créés: $createdCount, ignorés: $skippedCount/(20 + ${EXTRA_SOUND_KEYS.size})"
        )
    }
}
