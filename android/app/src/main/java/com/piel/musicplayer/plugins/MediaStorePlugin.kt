package com.piel.musicplayer.plugins

import android.content.ContentUris
import android.provider.MediaStore
import android.util.Log
import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONArray
import org.json.JSONObject

@CapacitorPlugin(name = "MediaStorePlugin")
class MediaStorePlugin : Plugin() {

    @PluginMethod
    fun getAudioFiles(call: PluginCall) {
        Log.d("MediaStorePlugin", "Query started using MediaStore.Files")
        val resolver = context.contentResolver
        val uri = MediaStore.Files.getContentUri("external")

        val projection = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_VERSION_CODES.Q) {
            arrayOf(
                MediaStore.Files.FileColumns._ID,
                MediaStore.Files.FileColumns.DISPLAY_NAME,
                MediaStore.Files.FileColumns.MEDIA_TYPE,
                MediaStore.Files.FileColumns.RELATIVE_PATH,
                MediaStore.Files.FileColumns.SIZE
            )
        } else {
            arrayOf(
                MediaStore.Files.FileColumns._ID,
                MediaStore.Files.FileColumns.DISPLAY_NAME,
                MediaStore.Files.FileColumns.MEDIA_TYPE,
                MediaStore.Files.FileColumns.SIZE,
                MediaStore.Files.FileColumns.TITLE
            )
        }

        val selection = "${MediaStore.Files.FileColumns.MEDIA_TYPE} = ?"
        val selectionArgs = arrayOf(MediaStore.Files.FileColumns.MEDIA_TYPE_AUDIO.toString())

        val cursor = resolver.query(
            uri,
            projection,
            selection,
            selectionArgs,
            "${MediaStore.Files.FileColumns.DATE_ADDED} DESC"
        )
        Log.d("MediaStorePlugin", "Cursor object: $cursor")
        Log.d("MediaStorePlugin", "Row count: ${cursor?.count ?: 0}")

        if (cursor == null) {
            Log.d("MediaStorePlugin", "Query failed (cursor is null)")
        } else if (cursor.count == 0) {
            Log.d("MediaStorePlugin", "No media found (row count is 0)")
        }

        val result = JSONArray()

        cursor?.use {
            val idIndex = it.getColumnIndexOrThrow(MediaStore.Files.FileColumns._ID)
            val nameIndex = it.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DISPLAY_NAME)
            val pathIndex = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_VERSION_CODES.Q) {
                it.getColumnIndex(MediaStore.Files.FileColumns.RELATIVE_PATH)
            } else {
                -1
            }

            while (it.moveToNext()) {
                Log.d("MediaStorePlugin", "Reading row...")
                val obj = JSONObject()
                val id = it.getLong(idIndex)
                val contentUri = ContentUris.withAppendedId(uri, id)

                obj.put("uri", contentUri.toString())
                obj.put("name", it.getString(nameIndex))
                obj.put("artist", "Unknown Artist")
                obj.put("album", "Unknown Album")
                obj.put("duration", 0L)
                
                if (pathIndex != -1) {
                    obj.put("path", it.getString(pathIndex))
                }

                result.put(obj)
            }
        }

        val ret = JSObject()
        ret.put("files", result)

        call.resolve(ret)
    }
}
