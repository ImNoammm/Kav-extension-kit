package org.example.crash;

import android.content.Context;
import android.view.View;

import kav.kavapp.api.Kav;
import kav.kavapp.api.KavExtension;

// A test extension for Kav's crash guard: a Home card whose button throws, closing Kav.
public class Crash implements KavExtension {
    @Override public void start(Kav kav) {
        kav.card("home", (Context c, String about) -> kav.ui().card(c, kav.ui().button(c, "Crash Kav", true, () -> {
            throw new IllegalStateException("crash test: a tap on its own button");
        })));
    }
}
