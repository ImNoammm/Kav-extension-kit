package org.example.hook;

import kav.kavapp.api.Kav;
import kav.kavapp.api.KavExtension;

// A raw hook on Kav's own code: durMinutes in ui/Common.kt, which writes "12 min" on results and trip pages, by the
// name its manifest declares under "hooks". A Kav without it leaves the hook out, and says this extension needs an
// update; nothing here fails. Switched off, the hook is gone at once.
public class HookSample implements KavExtension {
    @Override public void start(Kav kav) {
        kav.hook("uk.noammm.kav.ui.CommonKt", "durMinutes", new String[] {"int"}, null, call -> {
            if (call.result() instanceof String) call.setResult(call.result() + " (hooked)");
        });
        kav.log(kav.hooked("uk.noammm.kav.ui.CommonKt", "durMinutes", "int") ? "hooked durMinutes" : "durMinutes isn't in this Kav");
    }
}
