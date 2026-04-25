package com.piel.musicplayer.plugins

import android.content.ContentUris
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import android.provider.MediaStore
import android.util.Log
import androidx.documentfile.provider.DocumentFile
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
            try {
                urisToQuery.add(MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL))
                urisToQuery.add(MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY))
            } catch (e: Exception) {
                Log.w("MediaStorePlugin", "Failed to add volume-specific URIs: ${e.message}")
            }
        }
        
        // Always include default
        urisToQuery.add(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI)

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

    @PluginMethod
    fun pickFolder(call: PluginCall) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE)
        startActivityForResult(call, intent, "pickFolderResult")
    }

    @ActivityCallback
    fun pickFolderResult(call: PluginCall, result: ActivityResult) {
        if (result.resultCode == android.app.Activity.RESULT_OK) {
            val data = result.data
            if (data != null && data.data != null) {
                val treeUri = data.data!!
                
                // Persist permissions
                val takeFlags: Int = Intent.FLAG_GRANT_READ_URI_PERMISSION or
                        Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                context.contentResolver.takePersistableUriPermission(treeUri, takeFlags)
                
                val ret = JSObject()
                ret.put("uri", treeUri.toString())
                call.resolve(ret)
            } else {
                call.reject("Data is empty")
            }
        } else {
            call.reject("User cancelled folder picker")
        }
    }

    @PluginMethod
    fun scanFolder(call: PluginCall) {
        val folderUriString = call.getString("uri") ?: return call.reject("URI is required")
        val folderUri = Uri.parse(folderUriString)
        val result = JSONArray()
        
        try {
            val rootFolder = DocumentFile.fromTreeUri(context, folderUri)
            if (rootFolder != null) {
                scanDocumentRecursive(rootFolder, result)
            }
            
            val ret = JSObject()
            ret.put("files", result)
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("Scan failed: ${e.message}")
        }
    }

    private fun scanDocumentRecursive(dir: DocumentFile, result: JSONArray) {
        for (file in dir.listFiles()) {
            if (file.isDirectory) {
                scanDocumentRecursive(file, result)
            } else if (isAudio(file)) {
                val obj = JSONObject()
                obj.put("uri", file.uri.toString())
                obj.put("name", file.name ?: "Unknown")
                obj.put("artist", "Unknown Artist")
                obj.put("album", "Unknown Album")
                obj.put("duration", 0L)
                obj.put("path", dir.name ?: "Music")
                result.put(obj)
            }
        }
    }

    private fun isAudio(file: DocumentFile): Boolean {
        val type = file.type ?: return false
        return type.startsWith("audio/") || 
               file.name?.endsWith(".mp3", true) == true ||
               file.name?.endsWith(".m4a", true) == true ||
               file.name?.endsWith(".wav", true) == true ||
               file.name?.endsWith(".flac", true) == true
    }
}
