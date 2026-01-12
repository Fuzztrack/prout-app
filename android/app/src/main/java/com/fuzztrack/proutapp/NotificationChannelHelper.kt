package com.fuzztrack.proutapp

import android.app.NotificationChannel
import android.app.NotificationManager
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
            // Utiliser directement l'ID de ressource pour construire l'URI
            val resId = if (i in 1..PR0UT_RAW_RES.size) PR0UT_RAW_RES[i - 1] else PR0UT_RAW_RES[0]
            val soundUri = android.net.Uri.parse("android.resource://${context.packageName}/${resId}")
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
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            }

            notificationManager.createNotificationChannel(channel)
        }
    }
}
