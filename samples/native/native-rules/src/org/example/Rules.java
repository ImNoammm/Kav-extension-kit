package org.example;

import org.json.JSONArray;
import org.json.JSONObject;

import kav.kavapp.api.Kav;
import kav.kavapp.api.KavExtension;

// A sample native extension with the hooks a script has: a planner of its own (an invented shuttle, four rides an
// hour apart), three route rules (hide the last of the routes, the latest first, a tag on each), and a stop board
// for two stops of its own.
public class Rules implements KavExtension {
    @Override public void start(final Kav kav) {
        kav.provide("plan.provide", Rules::plan);
        // The search: {"query", "routes", "walks", "transfers"}; each rule answers one entry per route.
        kav.provide("results.filter", in -> {
            JSONArray routes = new JSONObject(in).getJSONArray("routes"), out = new JSONArray();
            for (int i = 0; i < routes.length(); i++) out.put(i == routes.length() - 1 && i > 0 ? (Object) "Too late for the sample" : (Object) true);
            return out.toString();
        });
        kav.provide("results.rank", in -> {
            JSONArray routes = new JSONObject(in).getJSONArray("routes"), out = new JSONArray();
            for (int i = routes.length() - 1; i >= 0; i--) out.put(i);
            return out.toString();
        });
        kav.provide("results.annotate", in -> {
            JSONArray routes = new JSONObject(in).getJSONArray("routes"), out = new JSONArray();
            for (int i = 0; i < routes.length(); i++) out.put(new JSONArray().put("Java says hi"));
            return out.toString();
        });
        kav.provide("board.stops", in -> new JSONObject()
            .put("stops", new JSONArray()
                .put(new JSONObject().put("id", "east").put("name", "Shuttle East").put("lat", 32.0741).put("lon", 34.7922).put("code", "SE").put("mode", 3))
                .put(new JSONObject().put("id", "west").put("name", "Shuttle West").put("lat", 32.0700).put("lon", 34.7700).put("code", "SW").put("mode", 3)))
            .put("lines", new JSONObject().put("s1", new JSONObject().put("number", "S1").put("name", "Shuttle").put("mode", 3)))
            .toString());
        kav.provide("board.departures", in -> {
            JSONObject q = new JSONObject(in);
            long t = (q.getLong("from") / 600 + 1) * 600;
            JSONArray out = new JSONArray();
            for (int i = 0; i < Math.min(q.getInt("limit"), 6); i++)
                out.put(new JSONObject().put("line", "s1").put("trip", "s1-" + (t + i * 600)).put("time", t + i * 600).put("headsign", "Native shuttle"));
            return out.toString();
        });
        kav.log("Native planner started");
    }

    // A walk to the shuttle stop beside "from", the ride, a walk from the stop beside "to". Plan v2, as a script's.
    private static String plan(String in) throws Exception {
        JSONObject q = new JSONObject(in);
        double fa = q.getJSONArray("from").getDouble(0), fo = q.getJSONArray("from").getDouble(1);
        double ta = q.getJSONArray("to").getDouble(0), to = q.getJSONArray("to").getDouble(1);
        double sa = fa + 0.002, so = fo, ea = ta - 0.002, eo = to;
        long at = q.getLong("at");
        JSONArray its = new JSONArray();
        for (int n = 0; n < 4; n++) {
            long dep = at + 300 + n * 3600, board = dep + 300, off = board + 900, arr = off + 300;
            its.put(new JSONObject().put("dep", dep).put("arr", arr).put("tags", new JSONArray()).put("legs", new JSONArray()
                .put(new JSONObject().put("k", "w").put("dep", dep).put("arr", board).put("m", 220).put("shape", line(fa, fo, sa, so)))
                .put(new JSONObject().put("k", "r").put("line", "s1").put("trip", "s1-" + board).put("dep", board).put("arr", off)
                    .put("sdep", board).put("sarr", off).put("live", false).put("first", board)
                    .put("stops", new JSONArray().put("a").put("b")).put("shape", line(sa, so, ea, eo)))
                .put(new JSONObject().put("k", "w").put("dep", off).put("arr", arr).put("m", 220).put("shape", line(ea, eo, ta, to)))));
        }
        return new JSONObject().put("it", its)
            .put("stops", new JSONObject().put("a", new JSONArray().put("A1").put("Shuttle start").put(sa).put(so).put(""))
                .put("b", new JSONArray().put("B1").put("Shuttle end").put(ea).put(eo).put("")))
            .put("lines", new JSONObject().put("s1", new JSONArray().put("S1").put("Shuttle end").put("").put("Shuttle start").put("").put("sample").put(3).put("")))
            .put("agencies", new JSONObject().put("sample", "Sample shuttles"))
            .toString();
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
