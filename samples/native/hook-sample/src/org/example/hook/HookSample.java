package org.example.hook;

import java.lang.reflect.Method;

import kav.kavapp.api.Kav;
import kav.kavapp.api.KavExtension;

// A raw hook on Kav's own code: durMinutes in ui/Common.kt, which writes "12 min" on results and trip pages, found by
// its name in Kav's own ClassLoader. It may break when Kav's code changes; switched off, the hook is gone at once.
public class HookSample implements KavExtension {
    @Override public void start(Kav kav) throws Exception {
        Class<?> common = Class.forName("uk.noammm.kav.ui.CommonKt", false, kav.kavClassLoader());
        Method minutes = common.getDeclaredMethod("durMinutes", int.class);
        kav.hook(minutes, null, call -> {
            if (call.result() instanceof String) call.setResult(call.result() + " (hooked)");
        });
        kav.log("hooked " + minutes);
    }
}
