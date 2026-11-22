package org.example.parts;

import android.content.Context;

import org.json.JSONException;
import org.json.JSONObject;

import kav.kavapp.api.Kav;
import kav.kavapp.api.KavExtension;

// Two of Kav's screen parts: a row after Home's pay card, and each ride on a trip's page in place of Kav's own card.
public class PartsSample implements KavExtension {
    @Override public void start(Kav kav) {
        kav.part("home.pay", "after", (Context c, String about) ->
            kav.ui().card(c, kav.ui().row(c, "info", "After the pay card", "Added by the Parts sample", null)));
        // about: {"trip", "leg", "index"}. Returning null shows Kav's own card instead.
        kav.part("trip.ride", "replace", (Context c, String about) -> {
            JSONObject leg;
            try { leg = new JSONObject(about).getJSONObject("leg"); } catch (JSONException e) { return null; }
            String line = leg.optString("lineNumber", "");
            String from = leg.optJSONObject("from") == null ? "" : leg.optJSONObject("from").optString("name", "");
            String to = leg.optJSONObject("to") == null ? "" : leg.optJSONObject("to").optString("name", "");
            return kav.ui().card(c, kav.ui().row(c, "bus", "Line " + line, from + " to " + to, null));
        });
    }
}
