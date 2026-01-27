const fs = require('fs');
const path = require('path');
const { 
  withAndroidManifest, 
  withDangerousMod,
  withAppBuildGradle 
} = require('@expo/config-plugins');

// Attention : platformProjectRoot pointe déjà sur /android, ne pas le doubler
const TARGET_SERVICE_PATH = 'app/src/main/java/com/fuzztrack/proutapp/ProutMessagingService.kt';
const TARGET_HELPER_PATH = 'app/src/main/java/com/fuzztrack/proutapp/NotificationChannelHelper.kt';
const TARGET_PROVIDER_PATH = 'app/src/main/java/com/fuzztrack/proutapp/ChannelInitProvider.kt';
const TARGET_MAIN_APP_PATH = 'app/src/main/java/com/fuzztrack/proutapp/MainApplication.kt';

// Contenu complet du fichier ProutMessagingService.kt
const PROUT_SERVICE_CONTENT = `package com.fuzztrack.proutapp

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
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
`;

// Contenu complet du fichier NotificationChannelHelper.kt
const NOTIFICATION_CHANNEL_HELPER_CONTENT = `package com.fuzztrack.proutapp

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
                android.net.Uri.parse("android.resource://\${context.packageName}/raw/\${resolvedName}")

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

        android.util.Log.d("NotificationChannelHelper", "📊 Canaux créés: $createdCount, ignorés: $skippedCount/20")
    }
}
`;

// Contenu complet du fichier ChannelInitProvider.kt
const CHANNEL_INIT_PROVIDER_CONTENT = `package com.fuzztrack.proutapp

import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.net.Uri
import android.util.Log
import androidx.annotation.Keep

/**
 * Provider d'initialisation ultra-tôt (avant Application.onCreate).
 *
 * Objectif: créer les 20 canaux au plus tôt possible après installation / au premier démarrage,
 * pour éviter les notifications sans son quand un prout arrive sur un canal non créé.
 */
@Keep
class ChannelInitProvider : ContentProvider() {
    override fun onCreate(): Boolean {
        return try {
            context?.let {
                NotificationChannelHelper.createChannels(it.applicationContext)
                Log.d("ChannelInitProvider", "✅ Canaux prout initialisés (ContentProvider)")
            }
            true
        } catch (e: Exception) {
            Log.e("ChannelInitProvider", "❌ Échec init canaux via ContentProvider", e)
            false
        }
    }

    // Stubs requis par ContentProvider (non utilisés)
    override fun query(
        uri: Uri,
        projection: Array<out String>?,
        selection: String?,
        selectionArgs: Array<out String>?,
        sortOrder: String?
    ): Cursor? = null

    override fun getType(uri: Uri): String? = null

    override fun insert(uri: Uri, values: ContentValues?): Uri? = null

    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0

    override fun update(
        uri: Uri,
        values: ContentValues?,
        selection: String?,
        selectionArgs: Array<out String>?
    ): Int = 0
}
`;

const withAndroidProutMessaging = (config) => {
  // 1. Ajouter le service dans le manifest + métadonnées par défaut
  config = withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    
    // Ajouter namespace tools si absent
    if (!androidManifest.manifest.$) {
      androidManifest.manifest.$ = {};
    }
    androidManifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    
    // Ajouter permission RECORD_AUDIO avec remove
    if (!androidManifest.manifest['uses-permission']) {
      androidManifest.manifest['uses-permission'] = [];
    }
    
    // Supprimer les doublons de RECORD_AUDIO
    androidManifest.manifest['uses-permission'] = androidManifest.manifest['uses-permission'].filter(
      (perm) => !(perm.$ && perm.$['android:name'] === 'android.permission.RECORD_AUDIO')
    );
    
    // Ajouter la permission avec tools:node="remove"
    androidManifest.manifest['uses-permission'].push({
      $: {
        'android:name': 'android.permission.RECORD_AUDIO',
        'tools:node': 'remove',
      },
    });
    
    const mainApplication = androidManifest.manifest.application[0];
    
    if (!mainApplication.service) {
      mainApplication.service = [];
    }
    
    // Supprimer les doublons du service
    mainApplication.service = mainApplication.service.filter(
      (service) => !(service.$ && service.$['android:name'] === '.ProutMessagingService')
    );
    
    // Ajouter le service ProutMessagingService
    mainApplication.service.push({
      $: {
        'android:name': '.ProutMessagingService',
        'android:exported': 'false',
      },
      'intent-filter': [{
        action: [{
          $: {
            'android:name': 'com.google.firebase.MESSAGING_EVENT',
          },
        }],
      }],
    });

    // Définir le canal par défaut FCM sur le v5
    if (!mainApplication['meta-data']) {
      mainApplication['meta-data'] = [];
    }
    mainApplication['meta-data'] = mainApplication['meta-data'].filter(
      (meta) => !(meta.$ && meta.$['android:name'] === 'com.google.firebase.messaging.default_notification_channel_id')
    );
    mainApplication['meta-data'].push({
      $: {
        'android:name': 'com.google.firebase.messaging.default_notification_channel_id',
        'android:value': 'prout-prout1-v5',
        'tools:replace': 'android:value',
      },
    });

    // Ajouter le ChannelInitProvider pour créer les canaux au démarrage
    if (!mainApplication.provider) {
      mainApplication.provider = [];
    }
    // Supprimer les doublons du provider
    mainApplication.provider = mainApplication.provider.filter(
      (provider) => !(provider.$ && provider.$['android:name'] === '.ChannelInitProvider')
    );
    // Ajouter le provider ChannelInitProvider
    mainApplication.provider.push({
      $: {
        'android:name': '.ChannelInitProvider',
        'android:authorities': '${applicationId}.channel-init',
        'android:exported': 'false',
        'android:initOrder': '100',
      },
    });
    
    console.log('🔧 [withAndroidProutMessaging] Service et Provider ajoutés au manifest');
    return config;
  });

  // 2. Créer le fichier ProutMessagingService.kt directement avec le contenu complet
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const targetPath = path.join(config.modRequest.platformProjectRoot, TARGET_SERVICE_PATH);
      const targetDir = path.dirname(targetPath);
      
      // Créer le dossier si nécessaire
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
        console.log(`📁 [withAndroidProutMessaging] Dossier créé: ${targetDir}`);
      }
      
      // Écrire le fichier avec le contenu complet
      fs.writeFileSync(targetPath, PROUT_SERVICE_CONTENT, 'utf8');
      console.log(`✅ [withAndroidProutMessaging] ProutMessagingService.kt créé à ${targetPath}`);

      // Créer NotificationChannelHelper.kt
      const helperPath = path.join(config.modRequest.platformProjectRoot, TARGET_HELPER_PATH);
      const helperDir = path.dirname(helperPath);
      if (!fs.existsSync(helperDir)) {
        fs.mkdirSync(helperDir, { recursive: true });
      }
      fs.writeFileSync(helperPath, NOTIFICATION_CHANNEL_HELPER_CONTENT, 'utf8');
      console.log(`✅ [withAndroidProutMessaging] NotificationChannelHelper.kt créé à ${helperPath}`);

      // Créer ChannelInitProvider.kt
      const providerPath = path.join(config.modRequest.platformProjectRoot, TARGET_PROVIDER_PATH);
      const providerDir = path.dirname(providerPath);
      if (!fs.existsSync(providerDir)) {
        fs.mkdirSync(providerDir, { recursive: true });
      }
      fs.writeFileSync(providerPath, CHANNEL_INIT_PROVIDER_CONTENT, 'utf8');
      console.log(`✅ [withAndroidProutMessaging] ChannelInitProvider.kt créé à ${providerPath}`);

      // Mettre à jour MainApplication.kt pour appeler NotificationChannelHelper.createChannels()
      const mainAppPath = path.join(config.modRequest.platformProjectRoot, TARGET_MAIN_APP_PATH);
      if (fs.existsSync(mainAppPath)) {
        let mainAppContent = fs.readFileSync(mainAppPath, 'utf8');
        // Vérifier si l'appel existe déjà
        if (!mainAppContent.includes('NotificationChannelHelper.createChannels')) {
          // Trouver onCreate() et ajouter l'appel après super.onCreate()
          const onCreateMatch = mainAppContent.match(/override fun onCreate\(\)\s*\{[\s\S]*?super\.onCreate\(\)/);
          if (onCreateMatch) {
            const insertPos = onCreateMatch.index + onCreateMatch[0].length;
            const insertion = `
    // Créer les canaux de notification Android au démarrage natif (idempotent)
    // (évite les notifs sans son si un canal n'existe pas encore)
    NotificationChannelHelper.createChannels(this)`;
            mainAppContent = mainAppContent.slice(0, insertPos) + insertion + mainAppContent.slice(insertPos);
            fs.writeFileSync(mainAppPath, mainAppContent, 'utf8');
            console.log(`✅ [withAndroidProutMessaging] MainApplication.kt mis à jour pour créer les canaux`);
          }
        }
      } else {
        console.warn(`⚠️ [withAndroidProutMessaging] MainApplication.kt non trouvé à ${mainAppPath}`);
      }
      
      // Ajouter des keep rules proguard pour éviter le strip en release (EAS AAB)
      const proguardPath = path.join(config.modRequest.platformProjectRoot, 'app/proguard-rules.pro');
      let proguardContent = '';
      if (fs.existsSync(proguardPath)) {
        proguardContent = fs.readFileSync(proguardPath, 'utf8');
      } else {
        fs.mkdirSync(path.dirname(proguardPath), { recursive: true });
      }
      
      const keepRules = [
        '# Keep custom FCM service',
        '-keep class com.fuzztrack.proutapp.ProutMessagingService { *; }',
        '',
        '# Keep notification channel initialization classes (critical for EAS AAB builds)',
        '-keep class com.fuzztrack.proutapp.ChannelInitProvider { *; }',
        '-keep class com.fuzztrack.proutapp.NotificationChannelHelper { *; }',
        '-keepclassmembers class com.fuzztrack.proutapp.NotificationChannelHelper { *; }',
        '',
        '# Keep ContentProvider for early initialization',
        '-keep class * extends android.content.ContentProvider { *; }',
        '',
        '# Prevent R8 from removing raw sound resources (prout1..20.wav)',
        '-keepclassmembers class **.R$raw { public static final int prout*; }',
      ].join('\n');
      
      if (!proguardContent.includes('com.fuzztrack.proutapp.ProutMessagingService')) {
        proguardContent += `\n${keepRules}\n`;
        fs.writeFileSync(proguardPath, proguardContent, 'utf8');
        console.log('✅ [withAndroidProutMessaging] Règles proguard ajoutées pour ProutMessagingService, ChannelInitProvider, NotificationChannelHelper');
      } else if (!proguardContent.includes('ChannelInitProvider')) {
        // Mettre à jour si ProutMessagingService existe mais pas les autres
        proguardContent += `\n${keepRules.replace('# Keep custom FCM service\n-keep class com.fuzztrack.proutapp.ProutMessagingService { *; }\n\n', '')}\n`;
        fs.writeFileSync(proguardPath, proguardContent, 'utf8');
        console.log('✅ [withAndroidProutMessaging] Règles proguard mises à jour pour ChannelInitProvider et NotificationChannelHelper');
      }

      return config;
    },
  ]);

  // 3. Ajouter les dépendances Firebase dans build.gradle
  config = withAppBuildGradle(config, (config) => {
    let buildGradle = config.modResults.contents;
    
    // Vérifier si les dépendances Firebase sont déjà présentes
    if (!buildGradle.includes('com.google.firebase:firebase-bom')) {
      // Trouver la section dependencies
      const dependenciesIndex = buildGradle.indexOf('dependencies {');
      if (dependenciesIndex !== -1) {
        // Insérer les dépendances Firebase après la première ligne de dependencies
        const insertIndex = buildGradle.indexOf('\n', dependenciesIndex) + 1;
        const firebaseDeps = `
    // Firebase Cloud Messaging (pour ProutMessagingService)
    implementation(platform("com.google.firebase:firebase-bom:33.2.0"))
    implementation("com.google.firebase:firebase-messaging")
`;
        buildGradle = buildGradle.slice(0, insertIndex) + firebaseDeps + buildGradle.slice(insertIndex);
        
        // Vérifier si le plugin google-services est déjà appliqué
        if (!buildGradle.includes("apply plugin: 'com.google.gms.google-services'")) {
          buildGradle += "\napply plugin: 'com.google.gms.google-services'";
        }
        
        console.log('✅ [withAndroidProutMessaging] Dépendances Firebase ajoutées dans build.gradle');
      }
    }
    
    config.modResults.contents = buildGradle;
    return config;
  });

  return config;
};

module.exports = withAndroidProutMessaging;
