package com.fuzztrack.proutapp

import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.net.Uri
import android.util.Log
import androidx.annotation.Keep

/**
 * Provider d'initialisation ultra-tôt (avant Application.onCreate)
 * pour s'assurer que les 20 canaux sont créés dès la première installation,
 * y compris avec les AAB (où certaines ressources peuvent être différées).
 */
@Keep
class ChannelInitProvider : ContentProvider() {
    override fun onCreate(): Boolean {
        return try {
            context?.let {
                NotificationChannelHelper.createChannels(it.applicationContext)
                Log.d("ChannelInitProvider", "✅ Canaux initialisés au plus tôt (ContentProvider)")
            }
            true
        } catch (e: Exception) {
            Log.e("ChannelInitProvider", "❌ Échec init canaux via ContentProvider", e)
            false
        }
    }

    // Les méthodes suivantes ne sont pas utilisées ; stubs requis par ContentProvider.
    override fun query(uri: Uri, projection: Array<out String>?, selection: String?, selectionArgs: Array<out String>?, sortOrder: String?): Cursor? = null
    override fun getType(uri: Uri): String? = null
    override fun insert(uri: Uri, values: ContentValues?): Uri? = null
    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0
    override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?): Int = 0
}
