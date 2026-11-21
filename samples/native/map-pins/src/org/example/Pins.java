package org.example;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;

import kav.kavapp.api.Kav;
import kav.kavapp.api.KavExtension;
import kav.kavapp.api.KavMap;

// A sample native extension: a star at Habima, a line along Rothschild Boulevard and an area over Meir Garden on the
// Live tab and trip maps, a dialog when one is tapped, and Kav's stops drawn green (every stop whose code ends in 0 as
// an orange square).
public class Pins implements KavExtension {
    @Override public void start(final Kav kav) {
        KavMap map = kav.map();
        float d = kav.context().getResources().getDisplayMetrics().density;
        map.marker("star", null, 32.0725, 34.7795, Color.RED, star((int) (28 * d)));
        map.line("rothschild", "live", new double[] {32.0628, 34.7711, 32.0665, 34.7750, 32.0705, 34.7770, 32.0733, 34.7788}, 0xFF7B1FA2, 6f);
        map.area("garden", null, new double[] {32.0705, 34.7710, 32.0720, 34.7725, 32.0708, 34.7742, 32.0693, 34.7726}, 0x5500C853, 0xFF00C853);
        map.onTap((id, context) -> kav.ui().dialog(context, "Map pins", "You tapped " + id + ".", "OK", () -> kav.log("tapped " + id)));
        final Bitmap square = square((int) (16 * d));
        map.stopLook((stop, name, lat, lon) -> stop.endsWith("0") ? new KavMap.Look(0, 0, square) : new KavMap.Look(0xFFC8E6C9, 0xFF1B5E20, null));
        kav.log("Map pins started");
    }

    private static Bitmap star(int px) {
        Bitmap b = Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(b);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        android.graphics.Path path = new android.graphics.Path();
        for (int i = 0; i < 10; i++) {
            double r = (i % 2 == 0 ? 0.5 : 0.22) * px, a = Math.PI / 5 * i - Math.PI / 2;
            float x = (float) (px / 2.0 + r * Math.cos(a)), y = (float) (px / 2.0 + r * Math.sin(a));
            if (i == 0) path.moveTo(x, y); else path.lineTo(x, y);
        }
        path.close();
        p.setColor(Color.RED);
        c.drawPath(path, p);
        p.setStyle(Paint.Style.STROKE); p.setStrokeWidth(px / 14f); p.setColor(Color.WHITE);
        c.drawPath(path, p);
        return b;
    }

    private static Bitmap square(int px) {
        Bitmap b = Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(b);
        Paint p = new Paint();
        p.setColor(Color.WHITE); c.drawRect(0, 0, px, px, p);
        p.setColor(0xFFFF6D00); c.drawRect(px / 6f, px / 6f, px * 5 / 6f, px * 5 / 6f, p);
        return b;
    }
}
