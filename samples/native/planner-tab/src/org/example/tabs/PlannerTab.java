package org.example.tabs;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;
import java.util.concurrent.ConcurrentHashMap;

import org.json.JSONArray;
import org.json.JSONObject;

import kav.kavapp.api.Kav;
import kav.kavapp.api.KavExtension;

// API 5: a planner that gets a results tab of its own beside Kav's (an invented line, T1, every 10 minutes), with what
// a planner can add to its rides: live times from its stop board, where the bus is (for Live location), an alert, and
// a photo of its stops in place of Street View's. It writes times the way the rider reads them (Kav.prefs).
public class PlannerTab implements KavExtension {
    private static final long EVERY = 600;
    private static final long LATE = 120;
    // Kav's own icon, standing in for a photo of the stop. Any https address of a JPEG, PNG or WebP image works.
    private static final String PHOTO = "https://raw.githubusercontent.com/ImNoammm/kav/main/site/public/img/icon-512.png";
    // Every stop it has planned, by id: its name. An id says where the stop is (id), so the board and the photos know
    // a stop of its own by its id or its place.
    private static final Map<String, String> stops = new ConcurrentHashMap<>();

    @Override public void start(final Kav kav) {
        // prefs() is API 5: an older Kav has no such method (this manifest says "api": 5, so an older Kav never starts it).
        if (kav.apiVersion() >= 5) kav.log("display settings: " + kav.prefs());
        kav.provide("plan.provide", PlannerTab::plan);
        kav.provide("board.stops", in -> {
            JSONArray list = new JSONArray();
            for (Map.Entry<String, String> s : stops.entrySet()) {
                double[] at = place(s.getKey());
                list.put(new JSONObject().put("id", s.getKey()).put("name", s.getValue()).put("lat", at[0]).put("lon", at[1]).put("mode", 3));
            }
            return new JSONObject().put("stops", list)
                .put("lines", new JSONObject().put("t1", new JSONObject().put("number", "T1").put("name", "Sample line").put("mode", 3))).toString();
        });
        // The board: each bus two minutes late, and where it is, a little before the stop and getting nearer.
        kav.provide("board.departures", in -> {
            JSONObject q = new JSONObject(in);
            double[] at = place(q.getString("stop"));
            long now = System.currentTimeMillis() / 1000;
            long t = (q.getLong("from") / EVERY + 1) * EVERY;
            JSONArray out = new JSONArray();
            for (int i = 0; i < Math.min(q.getInt("limit"), 6); i++) {
                long time = t + i * EVERY;
                JSONObject d = new JSONObject().put("line", "t1").put("trip", "t1-" + time).put("time", time).put("estimated", time + LATE);
                if (at != null && i == 0) d.put("vehicle", vehicle(at, time + LATE - now, now));
                out.put(d);
            }
            return out.toString();
        });
        // A photo of its own stops only; Kav shows Street View's for every other.
        kav.provide("stop.photo", in -> {
            JSONObject q = new JSONObject(in);
            for (String id : stops.keySet()) {
                double[] s = place(id);
                if (Math.abs(s[0] - q.getDouble("lat")) < 0.0005 && Math.abs(s[1] - q.getDouble("lon")) < 0.0005) return JSONObject.quote(PHOTO);
            }
            return "null";
        });
    }

    // The bus before the stop: about 100 m for each minute it still has to go, south of it.
    private static JSONObject vehicle(double[] stop, long inS, long now) throws Exception {
        double back = Math.max(0, Math.min(inS, 1200)) / 60.0 * 0.0009;
        return new JSONObject().put("lat", stop[0] - back).put("lon", stop[1]).put("at", now).put("bearing", 0);
    }

    // A walk to the stop beside "from", the ride, a walk from the stop beside "to", on the next three buses.
    private static String plan(String in) throws Exception {
        JSONObject q = new JSONObject(in);
        JSONObject prefs = q.optJSONObject("prefs");
        double fa = q.getJSONArray("from").getDouble(0), fo = q.getJSONArray("from").getDouble(1);
        double ta = q.getJSONArray("to").getDouble(0), to = q.getJSONArray("to").getDouble(1);
        double sa = fa + 0.002, so = fo, ea = ta - 0.002, eo = to;
        String a = id(sa, so), b = id(ea, eo);
        if (stops.size() > 500) stops.clear();
        stops.put(a, "Sample start");
        stops.put(b, "Sample end");
        long at = q.getLong("at");
        long now = System.currentTimeMillis() / 1000;
        JSONArray its = new JSONArray();
        for (int n = 0; n < 3; n++) {
            long board = ((at + 300) / EVERY + 1 + n) * EVERY, leaves = board + LATE, off = leaves + 900, dep = leaves - 300, arr = off + 300;
            JSONObject ride = new JSONObject().put("k", "r").put("line", "t1").put("trip", "t1-" + board).put("dep", leaves).put("arr", off)
                .put("sdep", board).put("sarr", off - LATE).put("live", true)
                .put("next", new JSONArray().put(new JSONArray().put(board + EVERY + LATE).put("t1-" + (board + EVERY)).put(1)))
                .put("stops", new JSONArray().put(a).put(b)).put("shape", line(sa, so, ea, eo))
                .put("vehicle", vehicle(new double[] {sa, so}, leaves - now, now));
            if (n == 0) ride.put("alert", new JSONObject().put("severe", false).put("text",
                "Sample alert: board at the temporary stop. Leaves " + clock(leaves, prefs) + ", stop names in "
                    + (prefs == null ? "?" : prefs.optString("stopNames")) + "."));
            its.put(new JSONObject().put("dep", dep).put("arr", arr).put("legs", new JSONArray()
                .put(new JSONObject().put("k", "w").put("dep", dep).put("arr", leaves).put("m", 220).put("shape", line(fa, fo, sa, so)))
                .put(ride)
                .put(new JSONObject().put("k", "w").put("dep", off).put("arr", arr).put("m", 220).put("shape", line(ea, eo, ta, to)))));
        }
        return new JSONObject().put("it", its)
            .put("stops", new JSONObject().put(a, new JSONArray().put("T1A").put("Sample start").put(sa).put(so).put(""))
                .put(b, new JSONArray().put("T1B").put("Sample end").put(ea).put(eo).put("")))
            .put("lines", new JSONObject().put("t1", new JSONArray().put("T1").put("Sample end").put("").put("Sample start").put("").put("sample").put(3).put("")))
            .put("agencies", new JSONObject().put("sample", "Sample buses"))
            .toString();
    }

    // A stop's id from its place, to a metre or so, and back.
    private static String id(double lat, double lon) { return Math.round(lat * 1e5) + "_" + Math.round(lon * 1e5); }

    private static double[] place(String id) {
        String[] p = id.split("_");
        return new double[] {Long.parseLong(p[0]) / 1e5, Long.parseLong(p[1]) / 1e5};
    }

    // A time as the rider reads them: Kav's clock setting, 12 or 24 hours.
    private static String clock(long s, JSONObject prefs) {
        boolean twelve = prefs != null && prefs.optInt("clock", 24) == 12;
        SimpleDateFormat f = new SimpleDateFormat(twelve ? "h:mm a" : "HH:mm", Locale.US);
        f.setTimeZone(TimeZone.getTimeZone("Asia/Jerusalem"));
        return f.format(new Date(s * 1000));
    }

    // Two points as an encoded polyline (precision 5).
    private static String line(double a1, double o1, double a2, double o2) {
        StringBuilder s = new StringBuilder();
        long[] v = {Math.round(a1 * 1e5), Math.round(o1 * 1e5), Math.round(a2 * 1e5) - Math.round(a1 * 1e5), Math.round(o2 * 1e5) - Math.round(o1 * 1e5)};
        for (long x : v) {
            long e = x < 0 ? ~(x << 1) : x << 1;
            while (e >= 0x20) { s.append((char) ((0x20 | (e & 0x1f)) + 63)); e >>= 5; }
            s.append((char) (e + 63));
        }
        return s.toString();
    }
}
