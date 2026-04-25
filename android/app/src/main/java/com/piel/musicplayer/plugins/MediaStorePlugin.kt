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
        Log.d("MediaStorePlugin", "Multi-volume Query started")
        val resolver = context.contentResolver
        
        val urisToQuery = mutableListOf<android.net.Uri>()
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_VERSION_CODES.Q) {
            urisToQuery.add(MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL))
            urisToQuery.add(MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY))
        } else {
            urisToQuery.add(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI)
        }

        val projection = mutableListOf(
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.DISPLAY_NAME,
            MediaStore.Audio.Media.ARTIST,
            MediaStore.Audio.Media.ALBUM,
            MediaStore.Audio.Media.DURATION,
            MediaStore.Audio.Media.SIZE
        )
        
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_VERSION_CODES.Q) {
            projection.add(MediaStore.Audio.Media.RELATIVE_PATH)
        }

        val selection = "${MediaStore.Audio.Media.SIZE} > 0"
        val result = JSONArray()
        val processedUris = mutableSetOf<String>()

        for (queryUri in urisToQuery.distinct()) {
            Log.d("MediaStorePlugin", "Querying URI: $queryUri")
            val cursor = try {
                resolver.query(
                    queryUri,
                    projection.toTypedArray(),
                    selection,
                    null,
                    "${MediaStore.Audio.Media.DATE_ADDED} DESC"
                )
            } catch (e: Exception) {
                Log.e("MediaStorePlugin", "Query failed for $queryUri: ${e.message}")
                null
            }
            
            Log.d("MediaStorePlugin", "Cursor for $queryUri: $cursor, Count: ${cursor?.count ?: 0}")

            cursor?.use {
                val idIndex = it.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
                val nameIndex = it.getColumnIndexOrThrow(MediaStore.Audio.Media.DISPLAY_NAME)
                val artistIndex = it.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST)
                val albumIndex = it.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM)
                val durationIndex = it.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION)
                val pathIndex = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_VERSION_CODES.Q) {
                    it.getColumnIndex(MediaStore.Audio.Media.RELATIVE_PATH)
                } else {
                    -1
                }

                while (it.moveToNext()) {
                    val id = it.getLong(idIndex)
                    val contentUri = ContentUris.withAppendedId(queryUri, id)
                    val uriString = contentUri.toString()
                    
                    if (processedUris.contains(uriString)) continue
                    processedUris.add(uriString)
                    
                    val obj = JSONObject()
                    obj.put("uri", uriString)
                    obj.put("name", it.getString(nameIndex))
                    obj.put("artist", it.getString(artistIndex) ?: "Unknown Artist")
                    obj.put("album", it.getString(albumIndex) ?: "Unknown Album")
                    obj.put("duration", it.getLong(durationIndex))
                    
                    if (pathIndex != -1) {
                        obj.put("path", it.getString(pathIndex))
                    }

                    result.put(obj)
                }
            }
        }

        Log.d("MediaStorePlugin", "Total songs detected: ${result.length()}")
        val ret = JSObject()
        ret.put("files", result)
        call.resolve(ret)
    }
}
