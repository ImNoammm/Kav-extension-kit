package org.example;

import android.content.Context;
import android.view.Gravity;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;

import kav.kavapp.api.Kav;
import kav.kavapp.api.KavExtension;
import kav.kavapp.api.KavUi;

// A sample native extension: a Home body and a tab of its own, made of Kav's pieces and a view of its own.
public class MyHome implements KavExtension {
    @Override public void start(final Kav kav) {
        kav.home((context, args) -> home(kav, context));
        kav.screen("clock", (context, args) -> clock(kav, context));
        kav.log("My Home started");
    }

    private View home(Kav kav, Context c) {
        KavUi ui = kav.ui();
        LinearLayout box = new LinearLayout(c);
        box.setOrientation(LinearLayout.VERTICAL);
        box.addView(ui.header(c, "My Home, in Java"));
        box.addView(ui.card(c, text(kav, c, "This Home is a native extension's own view.", "body")));
        box.addView(ui.button(c, "Say hello", true, () -> ui.dialog(c, "My Home", "Hello from native code.", "OK", () -> {})));
        return box;
    }

    private View clock(Kav kav, Context c) {
        LinearLayout box = new LinearLayout(c);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER_HORIZONTAL);
        final TextView t = text(kav, c, "", "largeTitle");
        box.addView(t);
        box.addView(kav.ui().row(c, "info", "A tab of its own", "Drawn by the extension, ticking every second", null));
        Runnable tick = new Runnable() {
            @Override public void run() {
                t.setText(new java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.ROOT).format(new java.util.Date()));
                t.postDelayed(this, 1000);
            }
        };
        t.post(tick);
        return box;
    }

    private static TextView text(Kav kav, Context c, String s, String style) {
        TextView t = new TextView(c);
        t.setText(s);
        t.setTextColor(kav.ui().color("text"));
        t.setTextSize(kav.ui().textSize(style));
        t.setPadding(0, 24, 0, 24);
        return t;
    }
}
