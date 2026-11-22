package org.example.pay;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import kav.kavapp.api.Kav;
import kav.kavapp.api.KavExtension;

// Every Pay in Kav (Home's "Pay for a ride", a ride's "Pay for this ride", the trip's notification) opens this
// extension's own question instead of Kav's. Its answer is a pretend ticket in Kav's own tickets, which Kav then opens.
// "Kav's own" lets Kav pay as it would without the extension.
public class PaySample implements KavExtension {
    @Override public void start(Kav kav) {
        kav.action("pay", (Context activity, String args) -> {
            JSONObject ride = read(args);
            String line = ride.optString("line", "");
            String what = line.isEmpty() ? "A pretend bus ticket" : "A pretend ticket for line " + line;
            kav.ui().dialog(activity, "Pay sample", what + ". Kav keeps it until it ends, in 90 minutes.", "Buy", () -> buy(kav, activity, ride));
            return true;
        });
    }

    private static void buy(Kav kav, Context activity, JSONObject ride) {
        long now = System.currentTimeMillis();
        String id = "t" + now;
        String section = ride.optString("section", "bus");
        try {
            JSONObject ticket = new JSONObject()
                .put("key", id)
                .put("kind", section.equals("train") ? "TRAIN" : section.equals("lightrail") ? "LIGHT_RAIL" : "BUS")
                .put("line", ride.optString("line", "Sample"))
                .put("from", name(ride, "from"))
                .put("to", name(ride, "to"))
                .put("boughtAt", now)
                .put("validUntil", now + 90 * 60_000L)
                .put("riders", 1)
                .put("price", 800)
                .put("number", "SAMPLE-" + (now % 100000))
                .put("codes", new JSONArray().put("pay-sample:" + id))
                .put("needsExit", section.equals("train"));
            kav.addTicket(ticket.toString());
            // Kav's own ticket screen, on the ticket just added (its key, as Kav keeps it).
            kav.kavAction("ticket.open", activity, new JSONObject().put("key", "ext:" + kav.id() + ":" + id).toString());
        } catch (JSONException e) {
            kav.log("couldn't make the ticket: " + e);
        }
    }

    private static String name(JSONObject ride, String end) {
        JSONObject o = ride.optJSONObject(end);
        return o == null ? "" : o.optString("name", "");
    }

    private static JSONObject read(String args) {
        try { return new JSONObject(args); } catch (JSONException e) { return new JSONObject(); }
    }
}
