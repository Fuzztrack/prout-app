package com.fuzztrack.proutapp
import expo.modules.splashscreen.SplashScreenManager

import android.os.Build
import android.os.Bundle
import android.content.Intent
import android.util.Log
import android.app.NotificationManager
import android.content.Context

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  private val TAG = "MainActivity"
  
  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    // setTheme(R.style.AppTheme);
    // @generated begin expo-splashscreen - expo prebuild (DO NOT MODIFY) sync-f3ff59a738c56c9a6119210cb55f0b613eb8b6af
    SplashScreenManager.registerOnActivity(this)
    // @generated end expo-splashscreen
    super.onCreate(null)
    // Vérification défensive : si les canaux manquent (cas AAB first install), on les recrée
    ensureNotificationChannels()
    
    // Traiter l'Intent initial si l'app est lancée depuis une notification
    // Traiter l'Intent initial si l'app est lancée depuis une notification
    intent?.let { handleNotificationIntent(it) }
  }
  
  override fun onResume() {
    super.onResume()
  }
  
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    handleNotificationIntent(intent)
  }
  
  private fun handleNotificationIntent(intent: Intent) {
    // Ancienne logique désactivée : on ne relaye plus les données via intent/DeviceEventEmitter
    val senderId = intent.getStringExtra("senderId")
    if (senderId != null) {
      Log.d(TAG, "📨 Notification Intent reçu (ignored for RN bridge) senderId: $senderId")
    }
  }

  private fun ensureNotificationChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    var missing = false
    for (i in 1..20) {
      val proutKey = "prout$i"
      val channelId = "prout-$proutKey-v3"
      if (nm.getNotificationChannel(channelId) == null) {
        missing = true
        break
      }
    }
    if (missing) {
      NotificationChannelHelper.createChannels(applicationContext)
      Log.d(TAG, "✅ Canaux recréés (fallback first install)")
    }
  }
  

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }
}
