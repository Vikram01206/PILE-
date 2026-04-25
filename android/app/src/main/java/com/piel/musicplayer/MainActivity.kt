package com.piel.musicplayer

import android.os.Bundle
import com.getcapacitor.BridgeActivity
import com.piel.musicplayer.plugins.MediaStorePlugin

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        registerPlugin(MediaStorePlugin::class.java)
    }
}
