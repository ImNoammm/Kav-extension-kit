package org.example.speed;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Looper;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.ScrollView;

import kav.kavapp.api.Kav;
import kav.kavapp.api.KavExtension;
import kav.kavapp.api.KavUi;

// A sample native extension: a card on Kav's Home with your speed from the phone's GPS (a view it draws itself) and a
// button that posts a notification, and a settings screen made only of Kav's own pieces.
public class Speed implements KavExtension {
    private static final String CHANNEL = "speed-card";

    @Override public void start(final Kav kav) {
        kav.card("home", (context, about) -> card(kav, context));
        kav.screen("settings", (context, args) -> settings(kav, context));
        kav.log("Speed started, API " + kav.apiVersion());
    }

    private static SharedPreferences prefs(Context c) { return c.getSharedPreferences("speed-card", Context.MODE_PRIVATE); }

    private View card(final Kav kav, final Context c) {
        KavUi ui = kav.ui();
        LinearLayout box = new LinearLayout(c);
        box.setOrientation(LinearLayout.VERTICAL);
        final SpeedView speed = new SpeedView(c, ui, prefs(c).getBoolean("mph", false));
        box.addView(speed, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, (int) (96 * c.getResources().getDisplayMetrics().density)));
        box.addView(ui.button(c, "Notify me", true, () -> notify(c, speed.text())));
        return ui.card(c, box);
    }

    private View settings(final Kav kav, final Context c) {
        KavUi ui = kav.ui();
        final SharedPreferences p = prefs(c);
        LinearLayout box = new LinearLayout(c);
        box.setOrientation(LinearLayout.VERTICAL);
        box.addView(ui.header(c, "Units"));
        box.addView(ui.switchRow(c, "Miles per hour", "Show your speed in mph instead of km/h", p.getBoolean("mph", false),
            on -> p.edit().putBoolean("mph", on).apply()));
        box.addView(ui.header(c, "Notification"));
        box.addView(ui.textField(c, p.getString("title", "Your speed"), "Notification title", t -> p.edit().putString("title", t).apply()));
        box.addView(ui.row(c, "info", "Where the speed comes from", "Your phone's GPS, while the card is on the screen", null));
        box.addView(ui.button(c, "Send a test notification", false, () -> notify(c, "a test")));
        ScrollView scroll = new ScrollView(c);
        scroll.addView(box);
        return scroll;
    }

    private static void notify(Context c, String text) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Speed", NotificationManager.IMPORTANCE_DEFAULT));
        Notification n = new Notification.Builder(c, CHANNEL).setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle(prefs(c).getString("title", "Your speed")).setContentText(text).build();
        nm.notify(1, n);
    }

    // The extension's own view: the speed, drawn in Kav's colours and type size, updated from the GPS while shown.
    static class SpeedView extends View implements LocationListener {
        private final Paint big = new Paint(Paint.ANTI_ALIAS_FLAG), small = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final boolean mph;
        private String value = "--", note = "Waiting for GPS";

        SpeedView(Context c, KavUi ui, boolean mph) {
            super(c);
            this.mph = mph;
            float sp = c.getResources().getDisplayMetrics().scaledDensity;
            big.setColor(ui.color("text")); big.setTextSize(ui.textSize("largeTitle") * 1.8f * sp); big.setTypeface(Typeface.DEFAULT_BOLD);
            small.setColor(ui.color("textSecondary")); small.setTextSize(ui.textSize("subhead") * sp);
        }

        String text() { return value + (mph ? " mph" : " km/h"); }

        @Override protected void onAttachedToWindow() {
            super.onAttachedToWindow();
            if (getContext().checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                note = "Kav has no location permission"; invalidate(); return;
            }
            LocationManager lm = getContext().getSystemService(LocationManager.class);
            lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000, 0, this, Looper.getMainLooper());
        }

        @Override protected void onDetachedFromWindow() {
            super.onDetachedFromWindow();
            getContext().getSystemService(LocationManager.class).removeUpdates(this);
        }

        @Override public void onLocationChanged(Location l) {
            float s = l.hasSpeed() ? l.getSpeed() * (mph ? 2.23694f : 3.6f) : 0f;
            value = String.valueOf(Math.round(s));
            note = "From your phone's GPS";
            invalidate();
        }

        @Override protected void onDraw(Canvas c) {
            float y = big.getTextSize();
            c.drawText(text(), 0, y, big);
            c.drawText(note, 0, y + small.getTextSize() * 1.6f, small);
        }
    }
}
