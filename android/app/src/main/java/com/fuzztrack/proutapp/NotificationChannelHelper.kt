package com.fuzztrack.proutapp

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.os.Build

object NotificationChannelHelper {
    fun createChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        for (i in 1..20) {
            val proutKey = "prout$i"
            val channelId = "prout-$proutKey-v3" // Format correct : prout-prout1-v3
            
            // Vérifier si le canal existe déjà
            val existingChannel = notificationManager.getNotificationChannel(channelId)
            if (existingChannel != null) {
                // Le canal existe déjà, on passe au suivant
                continue
            }

            val channelName = "Prout $proutKey"
            val soundUri = android.net.Uri.parse("android.resource://${context.packageName}/raw/$proutKey")
            val audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()

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
                setSound(soundUri, audioAttributes)
            }

            notificationManager.createNotificationChannel(channel)
        }
    }
}


