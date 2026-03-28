package com.fuzztrack.proutapp

import android.content.Intent
import android.provider.Settings
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class SoundSettingsModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        var activeReactContext: ReactApplicationContext? = null
        var activeChatFriendId: String? = null
        var isAppInForeground: Boolean = false
    }

    init {
        activeReactContext = reactContext
    }

    override fun getName(): String {
        return "SoundSettingsModule"
    }

    @ReactMethod
    fun setActiveChatFriendId(friendId: String) {
        activeChatFriendId = friendId
    }

    @ReactMethod
    fun clearActiveChatFriendId() {
        activeChatFriendId = null
    }

    @ReactMethod
    fun setAppInForeground(isForeground: Boolean) {
        isAppInForeground = isForeground
    }

    @ReactMethod
    fun openSoundSettings() {
        val intent = Intent(Settings.ACTION_SOUND_SETTINGS)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
        reactApplicationContext.startActivity(intent)
    }
}
