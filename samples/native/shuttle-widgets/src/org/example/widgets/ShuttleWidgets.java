package org.example.widgets;

import android.content.Context;
import android.view.View;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import kav.kavapp.api.Kav;
import kav.kavapp.api.KavExtension;

// API 5: two home screen widgets. Kav owns the widgets on the home screen; the rider places one of Kav's and chooses one
// of these for it, and Kav asks this code for its content (Kav.widget) and draws it in Kav's own look.
//   next: the next departures of an invented shuttle from the stop chosen in its settings, a tap on the widget showing the
//         next stop ({"call"}), a tap on a row opening its line's page, and asked again when the setting changes
//         (Kav.refreshWidget) and when the first shuttle has left ("next").
//   trips: the rider's recent trips (Kav.trips, once the rider allows it on its page), a tap on one planning it again.
public class ShuttleWidgets implements KavExtension {
    private static final String[] STOPS = {"harbor", "market", "campus"};
    // An invented shuttle: two lines, each leaving every few minutes from 06:00 to 23:00, a few minutes later at each stop.
    private static final String[] LINES = {"1", "2"};
    private static final int[] EVERY_MIN = {12, 20};

    private Kav kav;

    @Override public void start(final Kav kav) {
        this.kav = kav;
        kav.widget("next", new Kav.Widget() {
            @Override public String content(String args) throws JSONException {
                return next(new JSONObject(args).getInt("rows")).toString();
            }

            // The widget tapped: the next stop, chosen as if in its settings. Kav asks for the content again after it.
            @Override public void tapped(String tap) {
                stop = STOPS[(index(stop()) + 1) % STOPS.length];
            }
        });
        kav.widget("trips", args -> trips(new JSONObject(args).getInt("rows")).toString());
        // Its stop changed in its settings: the widget shows the new one now, not at its next update.
        kav.onSettings(settings -> { stop = null; kav.refreshWidget("next"); });
        // A line's page, opened from a row: its departures from the stop, made of Kav's blocks.
        kav.screen("line", (Context c, String args) -> {
            try {
                JSONObject a = new JSONObject(args);
                return kav.ui().blocks(c, linePage(a.optString("line", "1"), a.optString("stop", stop())).toString());
            } catch (JSONException e) {
                return null;
            }
        });
    }

    // The stop chosen by a tap on the widget, else the one in its settings.
    private volatile String stop;

    private String stop() {
        String s = stop;
        if (s != null) return s;
        try { return new JSONObject(kav.settings()).optString("stop", "harbor"); } catch (JSONException e) { return "harbor"; }
    }

    private static int index(String stop) {
        for (int i = 0; i < STOPS.length; i++) if (STOPS[i].equals(stop)) return i;
        return 0;
    }

    private boolean hebrew() { return "he".equals(kav.locale()); }

    private String say(String en, String he) { return hebrew() ? he : en; }

    private String stopName(String stop) {
        switch (stop) {
            case "market": return say("Market", "השוק");
            case "campus": return say("Campus", "הקמפוס");
            default: return say("Harbor", "הנמל");
        }
    }

    // Where each line goes from a stop: the stop after it on its loop.
    private String towards(int line, String stop) {
        return stopName(STOPS[(index(stop) + 1 + line) % STOPS.length]);
    }

    private boolean twelveHour() {
        try { return new JSONObject(kav.prefs()).optInt("clock", 24) == 12; } catch (JSONException e) { return false; }
    }

    private String clock(int minuteOfDay) {
        int h = minuteOfDay / 60 % 24, m = minuteOfDay % 60;
        if (!twelveHour()) return String.format(java.util.Locale.US, "%02d:%02d", h, m);
        return String.format(java.util.Locale.US, "%d:%02d", h % 12 == 0 ? 12 : h % 12, m);
    }

    // The next departures from a stop after now, soonest first: {line, minute of the day}.
    private static List<int[]> departures(String stop, int now, int most) {
        List<int[]> out = new ArrayList<>();
        int offset = index(stop) * 4;
        for (int t = now + 1; t < 23 * 60 + 1 && out.size() < most; t++)
            for (int l = 0; l < LINES.length; l++)
                if (t >= 6 * 60 && (t - 6 * 60 - offset) % EVERY_MIN[l] == 0 && t - 6 * 60 - offset >= 0) out.add(new int[]{l, t});
        return out.size() > most ? out.subList(0, most) : out;
    }

    private static int nowMinute() {
        Calendar c = Calendar.getInstance();
        return c.get(Calendar.HOUR_OF_DAY) * 60 + c.get(Calendar.MINUTE);
    }

    // {"title", "rows": [{"line", "title", "subtitle", "value", "action"}], "note", "empty", "action", "next"}.
    private JSONObject next(int rows) throws JSONException {
        String stop = stop();
        int now = nowMinute();
        JSONArray list = new JSONArray();
        List<int[]> deps = departures(stop, now, rows);
        for (int[] d : deps) {
            int wait = d[1] - now;
            list.put(new JSONObject()
                .put("line", LINES[d[0]])
                .put("title", say("To ", "אל ") + towards(d[0], stop))
                .put("subtitle", wait <= 1 ? say("Leaving now", "יוצא עכשיו") : say("In " + wait + " min", "בעוד " + wait + " דק׳"))
                .put("value", clock(d[1]))
                .put("action", new JSONObject().put("page", "line").put("args", new JSONObject().put("line", LINES[d[0]]).put("stop", stop))));
        }
        JSONObject c = new JSONObject()
            .put("title", say("Shuttles from ", "הסעות מ") + stopName(stop))
            .put("rows", list)
            .put("note", say("Tap for the next stop · ", "הקישו לתחנה הבאה · ") + clock(now))
            .put("empty", say("No more shuttles today", "אין עוד הסעות היום"))
            .put("action", new JSONObject().put("call", "next-stop"));
        // Asked again once the first one has left (Kav waits at least five minutes).
        if (!deps.isEmpty()) c.put("next", (deps.get(0)[1] - now) * 60);
        return c;
    }

    // The recent trips, each a tap from Kav's planner with its destination filled in.
    private JSONObject trips(int rows) throws JSONException {
        JSONObject c = new JSONObject().put("title", say("Recent trips", "נסיעות אחרונות"));
        String text = kav.trips();
        if (text == null) {
            // Not allowed yet: the rider allows it on its page in Kav, which a tap opens.
            return c.put("empty", say("Allow reading your trips on its page in Kav", "אשרו קריאת נסיעות בעמוד התוסף ב-Kav"))
                .put("action", new JSONObject().put("settings", true));
        }
        JSONArray all = new JSONArray(text), list = new JSONArray();
        for (int i = 0; i < all.length() && list.length() < rows; i++) {
            JSONObject t = all.getJSONObject(i), to = t.getJSONObject("to");
            JSONObject from = t.optJSONObject("from");
            list.put(new JSONObject()
                .put("icon", "pin")
                .put("title", to.getString("name"))
                .put("subtitle", from == null ? say("From where you were", "ממקום שבו הייתם") : say("From ", "מ") + from.getString("name"))
                .put("action", new JSONObject().put("plan", new JSONObject().put("lat", to.getDouble("lat")).put("lon", to.getDouble("lon")).put("name", to.getString("name")))));
        }
        return c.put("rows", list).put("empty", say("No trips yet", "אין עדיין נסיעות"));
    }

    // A line's page: its next departures from the stop, in Kav's blocks.
    private JSONObject linePage(String line, String stop) throws JSONException {
        int l = "2".equals(line) ? 1 : 0;
        JSONArray blocks = new JSONArray().put(new JSONObject().put("type", "text").put("style", "caption")
            .put("text", say("Every " + EVERY_MIN[l] + " minutes, 06:00 to 23:00", "כל " + EVERY_MIN[l] + " דקות, 06:00 עד 23:00")));
        int now = nowMinute();
        for (int[] d : departures(stop, now, 12)) if (d[0] == l)
            blocks.put(new JSONObject().put("type", "row").put("icon", "bus").put("title", say("To ", "אל ") + towards(l, stop)).put("value", clock(d[1])));
        return new JSONObject().put("title", say("Line ", "קו ") + line + say(" from ", " מ") + stopName(stop))
            .put("sections", new JSONArray().put(new JSONObject().put("blocks", blocks)));
    }
}
