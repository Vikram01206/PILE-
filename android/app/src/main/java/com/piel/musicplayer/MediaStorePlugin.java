package com.piel.musicplayer;

import android.database.Cursor;
import android.provider.MediaStore;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "MediaStorePlugin")
public class MediaStorePlugin extends Plugin {

    @PluginMethod
    public void getAudioFiles(PluginCall call) {
        try {
            android.content.ContentResolver resolver = getContext().getContentResolver();
            android.net.Uri uri = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;

            String[] projection = {
                MediaStore.Audio.Media.DATA,
                MediaStore.Audio.Media.DISPLAY_NAME,
                MediaStore.Audio.Media.ARTIST,
                MediaStore.Audio.Media.ALBUM,
                MediaStore.Audio.Media.DURATION
            };

            String selection = MediaStore.Audio.Media.IS_MUSIC + " != 0";

            Cursor cursor = resolver.query(uri, projection, selection, null, null);

            JSONArray result = new JSONArray();

            if (cursor != null) {
                int pathIndex = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATA);
                int nameIndex = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DISPLAY_NAME);
                int artistIndex = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST);
                int albumIndex = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM);
                int durationIndex = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION);

                while (cursor.moveToNext()) {
                    JSONObject obj = new JSONObject();
                    obj.put("path", cursor.getString(pathIndex));
                    obj.put("name", cursor.getString(nameIndex));
                    obj.put("artist", cursor.getString(artistIndex));
                    obj.put("album", cursor.getString(albumIndex));
                    obj.put("duration", cursor.getLong(durationIndex));
                    result.put(obj);
                }
                cursor.close();
            }

            JSObject ret = new JSObject();
            ret.put("files", result);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error querying MediaStore: " + e.getMessage());
        }
    }
}
