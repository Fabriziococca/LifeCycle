package com.fabriziococca.lifecycle;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LifeCycleAudioRecorderPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
