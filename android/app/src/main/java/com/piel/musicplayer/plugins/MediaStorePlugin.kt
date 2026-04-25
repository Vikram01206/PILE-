package com.piel.musicplayer.plugins

import android.content.ContentUris
import android.provider.MediaStore
import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONArray
import org.json.JSONObject

@CapacitorPlugin(name = "MediaStorePlugin")
class MediaStorePlugin : Plugin() {

    @PluginMethod
    fun getAudioFiles(call: PluginCall) {
        val resolver = context.contentResolver
        val uri = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI

        val projection = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_VERSION_CODES.Q) {
            arrayOf(
                MediaStore.Audio.Media._ID,
                MediaStore.Audio.Media.DISPLAY_NAME,
                MediaStore.Audio.Media.ARTIST,
                MediaStore.Audio.Media.ALBUM,
                MediaStore.Audio.Media.DURATION,
                MediaStore.Audio.Media.SIZE,
                MediaStore.Audio.Media.RELATIVE_PATH
            )
        } else {
            arrayOf(
                MediaStore.Audio.Media._ID,
                MediaStore.Audio.Media.DISPLAY_NAME,
                MediaStore.Audio.Media.ARTIST,
                MediaStore.Audio.Media.ALBUM,
                MediaStore.Audio.Media.DURATION,
                MediaStore.Audio.Media.SIZE,
                MediaStore.Audio.Media.DATA
            )
        }

        val selection = "${MediaStore.Audio.Media.SIZE} > 0"

        val cursor = resolver.query(uri, projection, selection, null, null)

        val result = JSONArray()

        cursor?.use {
            val idIndex = it.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
            val nameIndex = it.getColumnIndexOrThrow(MediaStore.Audio.Media.DISPLAY_NAME)
            val artistIndex = it.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST)
            val albumIndex = it.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM)
            val durationIndex = it.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION)
            val pathIndex = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_VERSION_CODES.Q) {
                it.getColumnIndex(MediaStore.Audio.Media.RELATIVE_PATH)
            } else {
                it.getColumnIndex(MediaStore.Audio.Media.DATA)
            }

            while (it.moveToNext()) {
                val obj = JSONObject()
                val id = it.getLong(idIndex)
                val contentUri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id)

                obj.put("uri", contentUri.toString())
                obj.put("name", it.getString(nameIndex))
                obj.put("artist", it.getString(artistIndex))
                obj.put("album", it.getString(albumIndex))
                obj.put("duration", it.getLong(durationIndex))
                
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
