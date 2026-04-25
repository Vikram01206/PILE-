package com.piel.musicplayer.plugins

import android.Manifest
import android.content.ContentUris
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.DocumentsContract
import android.provider.MediaStore
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.documentfile.provider.DocumentFile
import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import org.json.JSONArray
import org.json.JSONObject

@CapacitorPlugin(
    name = "MediaStorePlugin",
    permissions = [
        Permission(
            alias = "audio",
            strings = [ Manifest.permission.READ_MEDIA_AUDIO ]
        ),
        Permission(
            alias = "legacy_storage",
            strings = [ Manifest.permission.READ_EXTERNAL_STORAGE ]
        )
    ]
)
class MediaStorePlugin : Plugin() {

    @PluginMethod
    fun checkPermissions(call: PluginCall) {
        val result = JSObject()
        val hasAudio = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(context, Manifest.permission.READ_MEDIA_AUDIO) == PackageManager.PERMISSION_GRANTED
        } else {
            ContextCompat.checkSelfPermission(context, Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED
        }
        
        result.put("audio", if (hasAudio) "granted" else "prompt")
        result.put("storage", if (hasAudio) "granted" else "prompt")
        call.resolve(result)
    }

    @PluginMethod
    override fun requestPermissions(call: PluginCall) {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_VERSION_CODES.TIRAMISU) {
            requestPermissionForAlias("audio", call, "permissionCallback")
        } else {
            requestPermissionForAlias("legacy_storage", call, "permissionCallback")
        }
    }

    @PermissionCallback
    private fun permissionCallback(call: PluginCall) {
        checkPermissions(call)
    }

    @PluginMethod
    fun getAudioFiles(call: PluginCall) {
        Log.d("MediaStorePlugin", "Multi-volume Query started")
        val resolver = context.contentResolver
        
        val urisToQuery = mutableListOf<android.net.Uri>()
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_VERSION_CODES.Q) {
            try {
                // Try all commonly used volume names on special ROMs like OxygenOS
                urisToQuery.add(MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL))
                urisToQuery.add(MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY))
                urisToQuery.add(MediaStore.Audio.Media.getContentUri("internal"))
                
                // Querying volume names might help
                val volumes = MediaStore.getExternalVolumeNames(context)
                for (volume in volumes) {
                    Log.d("MediaStorePlugin", "Discovered volume: $volume")
                    urisToQuery.add(MediaStore.Audio.Media.getContentUri(volume))
                }
            } catch (e: Exception) {
                Log.w("MediaStorePlugin", "Failed to add volume-specific URIs: ${e.message}")
            }
        }
        
        // Always include default
        urisToQuery.add(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI)
        urisToQuery.add(MediaStore.Audio.Media.INTERNAL_CONTENT_URI)

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

            if (cursor != null && cursor.count > 0) {
                cursor.use {
                    queryMediaStoreCursor(it, queryUri, processedUris, result)
                }
            }
        }

        // FALLBACK: Query MediaStore.Files if no songs found yet
        if (result.length() == 0) {
            Log.d("MediaStorePlugin", "Falling back to MediaStore.Files query...")
            val filesUri = MediaStore.Files.getContentUri("external")
            val filesProjection = arrayOf(
                MediaStore.Files.FileColumns._ID,
                MediaStore.Files.FileColumns.DISPLAY_NAME,
                MediaStore.Files.FileColumns.MEDIA_TYPE,
                MediaStore.Files.FileColumns.SIZE
            )
            val filesSelection = "${MediaStore.Files.FileColumns.MEDIA_TYPE} = ${MediaStore.Files.FileColumns.MEDIA_TYPE_AUDIO}"
            val filesCursor = resolver.query(filesUri, filesProjection, filesSelection, null, null)
            filesCursor?.use {
                Log.d("MediaStorePlugin", "MediaStore.Files count: ${it.count}")
                val idIndex = it.getColumnIndexOrThrow(MediaStore.Files.FileColumns._ID)
                val nameIndex = it.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DISPLAY_NAME)
                
                while (it.moveToNext()) {
                    val id = it.getLong(idIndex)
                    val contentUri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id)
                    val uriString = contentUri.toString()
                    
                    if (processedUris.contains(uriString)) continue
                    processedUris.add(uriString)
                    
                    val obj = JSONObject()
                    obj.put("uri", uriString)
                    obj.put("name", it.getString(nameIndex))
                    obj.put("artist", "Unknown Artist")
                    obj.put("album", "Unknown Album")
                    obj.put("duration", 0L)
                    result.put(obj)
                }
            }
        }

        Log.d("MediaStorePlugin", "Total songs detected: ${result.length()}")
        val ret = JSObject()
        ret.put("files", result)
        call.resolve(ret)
    }

    private fun queryMediaStoreCursor(it: android.database.Cursor, queryUri: Uri, processedUris: MutableSet<String>, result: JSONArray) {
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
    fun deepScan(call: PluginCall) {
        val uriString = call.getString("uri") ?: return call.reject("URI is required")
        val rootUri = Uri.parse(uriString)
        val result = JSONArray()
        
        try {
            val rootFolder = DocumentFile.fromTreeUri(context, rootUri)
            if (rootFolder == null) {
                return call.reject("Could not access root folder")
            }

            val foldersMap = mutableMapOf<String, JSONObject>()
            
            scanRecursiveGrouped(rootFolder, foldersMap)
            
            for (folder in foldersMap.values) {
                result.put(folder)
            }
            
            val ret = JSObject()
            ret.put("folders", result)
            call.resolve(ret)
        } catch (e: Exception) {
            Log.e("MediaStorePlugin", "Deep Scan error", e)
            call.reject("Deep Scan failed: ${e.message}")
        }
    }

    private fun scanRecursiveGrouped(dir: DocumentFile, foldersMap: MutableMap<String, JSONObject>) {
        val files = dir.listFiles()
        val songsInThisFolder = JSONArray()
        
        for (file in files) {
            if (file.isDirectory) {
                scanRecursiveGrouped(file, foldersMap)
            } else if (isAudio(file)) {
                val songObj = JSONObject()
                songObj.put("uri", file.uri.toString())
                songObj.put("name", file.name ?: "Unknown Signal")
                songsInThisFolder.put(songObj)
            }
        }
        
        if (songsInThisFolder.length() > 0) {
            val folderObj = JSONObject()
            folderObj.put("folderName", dir.name ?: "Unknown Sector")
            folderObj.put("folderUri", dir.uri.toString())
            folderObj.put("songCount", songsInThisFolder.length())
            folderObj.put("songs", songsInThisFolder)
            
            // Generate a unique key for the folder to avoid duplicates if name is same but path is different
            val key = dir.uri.toString()
            foldersMap[key] = folderObj
        }
    }

    @PluginMethod
    fun openSettings(call: PluginCall) {
        val intent = Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
        intent.data = Uri.fromParts("package", context.packageName, null)
        context.startActivity(intent)
        call.resolve()
    }

    @PluginMethod
    fun openAllFilesAccess(call: PluginCall) {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_VERSION_CODES.R) {
            val intent = Intent(android.provider.Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION)
            intent.data = Uri.fromParts("package", context.packageName, null)
            context.startActivity(intent)
        } else {
            openSettings(call)
            return
        }
        call.resolve()
    }

    private fun isAudio(file: DocumentFile): Boolean {
        val type = file.type ?: return false
        val name = file.name?.lowercase() ?: ""
        return type.startsWith("audio/") || 
               name.endsWith(".mp3") ||
               name.endsWith(".m4a") ||
               name.endsWith(".wav") ||
               name.endsWith(".flac") ||
               name.endsWith(".aac") ||
               name.endsWith(".ogg")
    }
}
