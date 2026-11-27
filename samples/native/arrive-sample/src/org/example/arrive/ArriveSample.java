package org.example.arrive;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.view.View;
import android.widget.ImageView;
import android.widget.LinearLayout;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.InputStream;

import kav.kavapp.api.Kav;
import kav.kavapp.api.KavExtension;
import kav.kavapp.api.KavUi;

// Kav 5.2's calls in place of hooks: Kav's own planner (Kav.plan) with its routes first in Kav's results
// ("results.add"), the trip's arrival as Kav estimates it (the "eta" event), an alarm that wakes Kav with it closed
// (Kav.alarm, Kav.onAlarm), and Android's photo picker over Kav's screen (Kav.pickFile).
public class ArriveSample implements KavExtension {
    private static final String CHANNEL = "arrive-sample";
    private Uri photo;

    @Override public void start(Kav kav) {
        // Once Kav's routes are on screen: the same search at the fast pace, its first two routes put first.
        kav.provide("results.add", input -> {
            JSONObject query = new JSONObject(input).getJSONObject("query");
            String answer = kav.plan(query.put("settings", "fnnt").toString());
            JSONArray added = new JSONArray();
            if (answer == null) return added.toString();
            JSONArray routes = new JSONObject(answer).getJSONArray("routes");
            for (int i = 0; i < Math.min(2, routes.length()); i++)
                added.put(new JSONObject().put("ref", routes.getJSONObject(i).getString("ref")));
            return added.toString();
        });

        // The alarm follows Kav's estimate: five minutes before the trip gets there, moved each time the estimate does.
        kav.onTrip(event -> {
            JSONObject e;
            try { e = new JSONObject(event); } catch (JSONException x) { return; }
            if (e.optString("event").equals("end")) kav.alarm("arrive", 0);
            else if (e.optLong("eta") > 0) kav.alarm("arrive", (e.optLong("eta") - 300) * 1000);
        });

        // Told with Kav closed too: a notification of its own.
        kav.onAlarm(id -> {
            Context c = kav.context();
            NotificationManager nm = c.getSystemService(NotificationManager.class);
            nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Arrive", NotificationManager.IMPORTANCE_DEFAULT));
            nm.notify(1, new Notification.Builder(c, CHANNEL).setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle("Five minutes to go").setContentText("Your trip gets there soon").build());
        });

        kav.screen("settings", (context, args) -> settings(kav, context));
    }

    // A photo the rider chooses, read with Kav's Context while Kav runs.
    private View settings(Kav kav, Context c) {
        KavUi ui = kav.ui();
        LinearLayout box = new LinearLayout(c);
        box.setOrientation(LinearLayout.VERTICAL);
        ImageView shown = new ImageView(c);
        shown.setAdjustViewBounds(true);
        show(c, shown);
        box.addView(ui.button(c, "Choose a photo", true, () -> kav.pickFile(new String[] {"image/*"}, picked -> {
            if (picked == null) return;
            photo = Uri.parse(picked);
            show(c, shown);
        })));
        box.addView(shown);
        return box;
    }

    private void show(Context c, ImageView into) {
        if (photo == null) return;
        try (InputStream in = c.getContentResolver().openInputStream(photo)) {
            into.setImageBitmap(BitmapFactory.decodeStream(in));
        } catch (Exception e) {
            photo = null;
        }
    }
}
