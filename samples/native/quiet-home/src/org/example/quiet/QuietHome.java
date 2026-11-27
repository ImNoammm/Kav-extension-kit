package org.example.quiet;

import android.os.Handler;
import android.os.Looper;
import android.view.View;

import org.json.JSONException;
import org.json.JSONObject;

import kav.kavapp.api.Kav;
import kav.kavapp.api.KavExtension;

// A theme with one setting and one piece of behavior: its colors are in the manifest (Kav applies them), and its code
// takes Home's suggestions card away while "Hide Home's suggestions" is on. With the setting off it gives the card back.
public class QuietHome implements KavExtension {
    @Override public void start(final Kav kav) {
        hide(kav);
        // Told on a thread of Kav's; the part is asked again on the main thread, wherever Home's suggestions show.
        kav.onSettings((settings) -> new Handler(Looper.getMainLooper()).post(() -> hide(kav)));
    }

    // A replacement of nothing while the setting is on; null shows Kav's own card.
    private static void hide(final Kav kav) {
        kav.part("home.suggestions", "replace", (context, about) -> hidden(kav.settings()) ? new View(context) : null);
    }

    private static boolean hidden(String settings) {
        try { return new JSONObject(settings).optBoolean("hide", true); } catch (JSONException e) { return true; }
    }
}
