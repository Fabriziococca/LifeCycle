package com.fabriziococca.lifecycle;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;

import android.content.ComponentName;
import android.content.Context;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class LifeCycleManifestTest {
    @Test
    @SuppressWarnings("deprecation")
    public void applicationIdAndPrivateRecorderServiceMatchTheNativeContract() throws Exception {
        Context appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();

        assertEquals("com.fabriziococca.lifecycle", appContext.getPackageName());
        ComponentName recorder = new ComponentName(appContext, LifeCycleAudioRecorderService.class);
        assertFalse(
            appContext.getPackageManager()
                .getServiceInfo(recorder, 0)
                .exported
        );
    }
}
