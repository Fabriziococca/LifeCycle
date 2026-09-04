package com.fabriziococca.lifecycle;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class LifeCycleAudioContractTest {
    @Test
    public void recorderActionsStayScopedToTheApplication() {
        assertEquals(
            "com.fabriziococca.lifecycle.audio.START",
            LifeCycleAudioRecorderService.ACTION_START
        );
        assertEquals(
            "com.fabriziococca.lifecycle.audio.STOP",
            LifeCycleAudioRecorderService.ACTION_STOP
        );
        assertTrue(
            LifeCycleAudioRecorderService.ACTION_INTERRUPTED
                .startsWith("com.fabriziococca.lifecycle.")
        );
    }
}
