package org.example.trips;

import android.content.Context;
import android.view.View;
import android.widget.LinearLayout;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import kav.kavapp.api.Kav;
import kav.kavapp.api.KavExtension;

// API 5: the rider's trips, each only once the rider allows it on this extension's page. It follows the trip under way
// (Kav.onTrip) and writes each event in its log, with the trip's steps and the one navigation shows, adds a line to the
// wait card for each line there and to the ride card (the parts nav.wait.details and nav.ride.details) and a banner
// under navigation's step dots with the step after the rider's (nav.banner), and lists the recent trips on its settings
// screen (Kav.trips).
public class TripCompanion implements KavExtension {
    // The last trip event, for the lines on the cards.
    private static volatile String last = "none yet";
    // The trip's steps, from the last trip event, for the banner.
    private static volatile JSONArray steps = new JSONArray();

    @Override public void start(final Kav kav) {
        // event: {"event", "trip", "from", "to", "step": {"index", "count", "kind", "leg", "legIndex", "shown"},
        // "steps": [{"kind", "legIndex", "line", "place"}], "reason"}.
        kav.onTrip(event -> {
            try {
                JSONObject e = new JSONObject(event);
                JSONObject step = e.getJSONObject("step");
                String what = e.getString("event") + ", step " + (step.getInt("index") + 1) + " of " + step.getInt("count")
                    + " (" + step.getString("kind") + ")" + (e.has("reason") ? ", " + e.getString("reason") : "");
                last = what;
                kav.log("trip " + what + ": " + e.optString("from") + " to " + e.optString("to"));
                // Every step, the trip's marked "now" and the card on screen "shown" (-1: navigation isn't open).
                JSONArray all = e.optJSONArray("steps");
                if (all != null) {
                    steps = all;
                    int now = step.getInt("index"), shown = step.optInt("shown", -1);
                    StringBuilder list = new StringBuilder("steps:");
                    for (int i = 0; i < all.length(); i++) {
                        list.append(i == 0 ? " " : ", ").append(i + 1).append(' ').append(describe(all.getJSONObject(i)));
                        if (i == now) list.append(" [now]");
                        if (i == shown) list.append(" [shown]");
                    }
                    kav.log(list.toString());
                }
            } catch (JSONException ex) {
                kav.log("a trip event it couldn't read: " + ex.getMessage());
            }
        });
        // about: {"trip", "leg", "index", "option"}: once for each line the rider can wait for.
        kav.part("nav.wait.details", "after", (Context c, String about) -> {
            try {
                JSONObject a = new JSONObject(about);
                String line = a.getJSONObject("leg").optString("lineNumber");
                return kav.ui().row(c, "info", "Option " + (a.getInt("option") + 1) + ": line " + line, "Last trip event: " + last, null);
            } catch (JSONException ex) {
                return null;
            }
        });
        // about: {"trip", "leg", "index"}: the line ridden.
        kav.part("nav.ride.details", "after", (Context c, String about) -> {
            try {
                JSONObject leg = new JSONObject(about).getJSONObject("leg");
                String to = leg.getJSONObject("to").optString("name");
                return kav.ui().row(c, "bus", "Riding " + leg.optString("lineNumber") + " to " + to, "Last trip event: " + last, null);
            } catch (JSONException ex) {
                return null;
            }
        });
        // about: {"trip", "step", "kind", "leg", "index"}: under the step dots, the step the rider is on and the one after.
        kav.part("nav.banner", "after", (Context c, String about) -> {
            try {
                JSONObject a = new JSONObject(about);
                int step = a.getInt("step");
                String kind = a.getString("kind");
                String icon = "ride".equals(kind) || "wait".equals(kind) ? "bus" : "walk".equals(kind) ? "walk" : "pin";
                JSONObject leg = a.optJSONObject("leg");
                String line = leg == null || leg.isNull("lineNumber") ? "" : leg.getString("lineNumber");
                JSONArray all = steps;
                String next = step + 1 < all.length() ? "Then: " + describe(all.getJSONObject(step + 1)) : "Last step";
                return kav.ui().row(c, icon, "Step " + (step + 1) + ": " + kind + (line.isEmpty() ? "" : " " + line), next, null);
            } catch (JSONException ex) {
                return null;
            }
        });
        // The recent trips, or what to allow first.
        kav.settingsScreen((Context c, String args) -> {
            LinearLayout list = new LinearLayout(c);
            list.setOrientation(LinearLayout.VERTICAL);
            list.addView(kav.ui().header(c, "Recent trips"));
            String trips = kav.trips();
            if (trips == null) {
                list.addView(kav.ui().row(c, "info", "Not allowed yet", "Switch on Read your trip history above", null));
                return list;
            }
            try {
                JSONArray a = new JSONArray(trips);
                SimpleDateFormat day = new SimpleDateFormat("d MMM HH:mm", Locale.US);
                for (int i = 0; i < Math.min(a.length(), 5); i++) {
                    JSONObject t = a.getJSONObject(i);
                    String from = t.isNull("from") ? "Where you were" : t.getJSONObject("from").optString("name");
                    list.addView(kav.ui().row(c, "clock", from + " to " + t.getJSONObject("to").optString("name"),
                        day.format(new Date(t.getLong("at") * 1000)), null));
                }
                if (a.length() == 0) list.addView(kav.ui().row(c, "info", "No trips yet", null, null));
            } catch (JSONException ex) {
                list.addView(kav.ui().row(c, "info", "Couldn't read the trips", ex.getMessage(), null));
            }
            return list;
        });
    }

    // A step of the trip event's steps in a few words: "ride 18 to Herzl".
    private static String describe(JSONObject s) {
        String kind = s.optString("kind");
        String line = s.isNull("line") ? "" : " " + s.optString("line");
        String place = s.isNull("place") ? "" : ("ride".equals(kind) || "walk".equals(kind) ? " to " : " at ") + s.optString("place");
        return kind + line + place;
    }
}
