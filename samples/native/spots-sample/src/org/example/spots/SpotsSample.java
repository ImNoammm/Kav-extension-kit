package org.example.spots;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

import kav.kavapp.api.Kav;
import kav.kavapp.api.KavExtension;

// API 5's named spots: parts on a line's page, a stop's board, Home and Live, an action of Live's taken over, and what
// Kav has of its timetable and live vehicles (Kav.stops, Kav.vehicles, Kav.departures), with no hook on Kav's code.
public class SpotsSample implements KavExtension {
    private final Handler main = new Handler(Looper.getMainLooper());

    @Override public void start(Kav kav) {
        // After a line's next departures: how many of its vehicles Kav sees live now. about: {"number", "operator"}.
        kav.part("line.live", "after", card((Context c, JSONObject about) -> {
            String number = about.optString("number", "");
            TextView text = line(c, kav, "Live vehicles: counting…");
            later(text, () -> {
                String buses = kav.vehicles(new JSONObject().put("line", number).toString());
                return buses == null ? "Live vehicles: Kav's live source can't be reached" : "Live vehicles of line " + number + ": " + new JSONArray(buses).length();
            });
            return kav.ui().card(c, text);
        }));

        // Under a stop's name and buttons: its next departure, from its board in Kav. about: {"stop", "name"}.
        kav.part("stop.header", "after", card((Context c, JSONObject about) -> {
            String stop = about.optString("stop", "");
            TextView text = line(c, kav, "Next departure: looking…");
            later(text, () -> {
                String board = kav.departures(new JSONObject().put("stop", stop).put("limit", 1).toString());
                if (board == null || new JSONArray(board).length() == 0) return "Next departure: none known";
                JSONObject d = new JSONArray(board).getJSONObject(0);
                long at = d.isNull("live") ? d.getLong("at") : d.getLong("live");
                return "Next departure: line " + d.optString("line") + " at " + new SimpleDateFormat("HH:mm", Locale.US).format(new Date(at * 1000))
                    + (d.isNull("live") ? "" : " (live)");
            });
            return text;
        }));

        // After Home's nearest station: the nearest train station to it, from Kav's timetable. about: {"stop", "name", "metres"}.
        kav.part("home.nearest", "after", card((Context c, JSONObject about) -> {
            String code = about.optString("stop", "").replace("il.mot/gtfs/stop/", "");
            String here = kav.stops(new JSONObject().put("code", Integer.parseInt(code.isEmpty() ? "0" : code)).toString());
            if (here == null || new JSONArray(here).length() == 0) return null;
            JSONObject s = new JSONArray(here).getJSONObject(0);
            String trains = kav.stops(new JSONObject().put("near", new JSONArray().put(s.getDouble("lat")).put(s.getDouble("lon")))
                .put("mode", 2).put("limit", 1).toString());
            if (trains == null || new JSONArray(trains).length() == 0) return null;
            JSONObject t = new JSONArray(trains).getJSONObject(0);
            // Inside Home's card: the padding of one of Kav's rows, so the words start where the card's own do.
            return pad(c, kav, line(c, kav, "Nearest train station: " + t.getString("name") + " (" + t.getLong("metres") + " m)"), "gap4", "gap3");
        }));

        // Before Live's list: how many vehicles it lists. about: {"vehicles"}.
        kav.part("live.list", "before", card((Context c, JSONObject about) ->
            pad(c, kav, line(c, kav, "Vehicles listed: " + about.optInt("vehicles")), "gap3", "gap3")));

        // A vehicle tapped on Live: told first, and Kav's own card after it. args: {"key", "plate", "line", "to", ...}.
        kav.action("live.vehicle.open", (Context activity, String args) -> {
            JSONObject v;
            try { v = new JSONObject(args); } catch (JSONException e) { return false; }
            kav.ui().dialog(activity, "Line " + v.optString("line"), "Vehicle " + v.optString("plate", "without a plate") +
                ". OK opens Kav's own card.", "OK", () -> kav.kavAction("live.vehicle.open", activity, args));
            return true;
        });
    }

    // Words in Kav's color and size, with no padding of their own: Kav starts a part's views where its own content
    // starts, and kav.ui().card pads what it holds as Kav's cards do.
    private TextView line(Context c, Kav kav, String words) {
        TextView t = new TextView(c);
        t.setText(words);
        t.setTextColor(kav.ui().color("text"));
        t.setTextSize(kav.ui().textSize("subhead"));
        return t;
    }

    // Kav's spacing around words: side at the start and end, ends above and below (names of Kav's gaps).
    private TextView pad(Context c, Kav kav, TextView t, String side, String ends) {
        float density = c.getResources().getDisplayMetrics().density;
        int x = (int) (kav.ui().dp(side) * density), y = (int) (kav.ui().dp(ends) * density);
        t.setPaddingRelative(x, y, x, y);
        return t;
    }

    interface Ask { String run() throws JSONException; }

    interface Make { View make(Context c, JSONObject about) throws JSONException; }

    // A part's view from its about, read as JSON; a throw goes to Kav's crash guard, which counts it.
    private static Kav.Card card(Make make) {
        return (c, about) -> {
            try { return make.make(c, new JSONObject(about)); } catch (JSONException e) { throw new IllegalStateException(e); }
        };
    }

    // vehicles and departures ask the network: on a thread of its own, the words set on the main thread.
    private void later(TextView text, Ask ask) {
        new Thread(() -> {
            String said;
            try { said = ask.run(); } catch (Exception e) { said = "Couldn't ask Kav: " + e.getMessage(); }
            String shown = said;
            main.post(() -> text.setText(shown));
        }).start();
    }
}
