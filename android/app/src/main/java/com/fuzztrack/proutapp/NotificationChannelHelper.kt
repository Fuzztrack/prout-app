package com.fuzztrack.proutapp

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.os.Build

object NotificationChannelHelper {
    private val SOUND_KEYS = arrayOf(
        "bzzz1", "bzzz2", "bzzz3", "bzzz4", "bzzz5",
        "trrl1", "trrl2", "trrl3", "trrl4", "trrl5"
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

        for (soundKey in SOUND_KEYS) {
            val channelId = "$CHANNEL_PREFIX$soundKey-$CHANNEL_VERSION"

            if (notificationManager.getNotificationChannel(channelId) != null) {
                skippedCount++
                continue
            }

            val channelName = "Prrt $soundKey"
            val resId = context.resources.getIdentifier(soundKey, "raw", context.packageName)
            val resolvedName = if (resId != 0) soundKey else "trrl1"
            val soundUri =
                android.net.Uri.parse("android.resource://${context.packageName}/raw/${resolvedName}")

            val channel = NotificationChannel(
                channelId,
                channelName,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications personnalisées pour $soundKey"
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
            "📊 Canaux créés: $createdCount, ignorés: $skippedCount/${SOUND_KEYS.size}"
        )
    }
}
