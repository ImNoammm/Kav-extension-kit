package org.example.hello

import android.content.Context
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import kav.kavapp.api.Kav
import kav.kavapp.api.KavExtension

// Kav makes this class (the manifest's "native" entry) and calls start once each time Kav starts, on a background
// thread. Everything the extension adds to Kav is registered here.
class Hello : KavExtension {
    override fun start(kav: Kav) {
        // The Home card: the manifest declares it as the contribution "slot.home". Kav asks for a view each time Home
        // shows it, on the main thread.
        kav.card("home") { context, _ -> card(kav, context) }
        // The screen for the page "about": Settings › Extensions › Hello Kotlin › About opens it.
        kav.screen("about") { context, _ -> about(kav, context) }
        // A line in its log, on its page in Settings › Extensions.
        kav.log("Hello Kotlin started, API ${kav.apiVersion()}, language ${kav.locale()}")
    }

    private var taps = 0

    // Kav's own card, button and dialog, so it looks like the rest of Kav in light, dark and Hebrew.
    private fun card(kav: Kav, c: Context): View {
        val ui = kav.ui()
        val box = LinearLayout(c).apply { orientation = LinearLayout.VERTICAL }
        box.addView(text(kav, c, if (kav.locale() == "he") "שלום מקוטלין" else "Hello from Kotlin", "headline"))
        box.addView(ui.button(c, if (kav.locale() == "he") "לחצו כאן" else "Tap me", true) {
            taps++
            kav.log("tapped $taps times")
            ui.dialog(c, "Hello Kotlin", "You tapped $taps time${if (taps == 1) "" else "s"}.", "OK") {}
        })
        return ui.card(c, box)
    }

    private fun about(kav: Kav, c: Context): View {
        val ui = kav.ui()
        return LinearLayout(c).apply {
            orientation = LinearLayout.VERTICAL
            addView(ui.header(c, "About"))
            addView(ui.row(c, "info", "Hello Kotlin", "A starter extension for Kav", null))
            addView(ui.row(c, "check", "Your extension's id", kav.id(), null))
        }
    }

    // A text in Kav's colours and type sizes, for a view the extension draws itself.
    private fun text(kav: Kav, c: Context, s: String, style: String) = TextView(c).apply {
        text = s
        setTextColor(kav.ui().color("text"))
        textSize = kav.ui().textSize(style)
        setPadding(0, 0, 0, (kav.ui().dp("gap3") * c.resources.displayMetrics.density).toInt())
    }
}
