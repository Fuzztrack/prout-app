package com.fuzztrack.proutapp

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
