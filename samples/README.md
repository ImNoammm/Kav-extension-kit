# Sample extensions

Thirteen small extensions in Java, and two themes (one with code, one without), here to be read and copied. Start with the kit's `starter-kotlin/`, then
`native/speed-card`.

Check one, or build it into a bundle and add it in Kav with Settings › Extensions › Sources › + › Add a bundle file
([docs/native.md](../docs/native.md)):

```
npm install
npx kavx check native/speed-card
npx kavx bundle native/speed-card
```

| Extension | What it shows |
|---|---|
| [speed-card](native/speed-card/src/org/example/speed/Speed.java) | A Home card made of Kav's components and a view of its own showing your speed from the phone's GPS, a button that posts a notification, and a settings screen made only of Kav's pieces. |
| [map-pins](native/map-pins/src/org/example/Pins.java) | A marker, a line and an area on Kav's maps, a dialog when one is tapped, and its own look for Kav's stop marks. |
| [native-rules](native/native-rules/src/org/example/Rules.java) | A trip planner (an invented shuttle), three route rules (a filter, a ranker, tags) and a stop board for two stops of its own, all through `Kav.provide`. |
| [my-home](native/my-home/src/org/example/MyHome.java) | A Home body and a tab of its own, made of Kav's pieces and a clock it draws itself. |
| [crash-test](native/crash-test/src/org/example/crash/Crash.java) | A Home card whose button throws, to see the crash guard: twice, and Kav turns it off at the next start. |
| [pay-sample](native/pay-sample/src/org/example/pay/PaySample.java) | API 4: takes over every Pay button in Kav with a pretend ticket, which it puts in Kav's own tickets and opens there. |
| [parts-sample](native/parts-sample/src/org/example/parts/PartsSample.java) | API 4: a row after Home's pay card, and each ride of a trip drawn its own way in place of Kav's. |
| [hook-sample](native/hook-sample/src/org/example/hook/HookSample.java) | API 4: a hook on one of Kav's own methods, found by its name. |
| [planner-tab](native/planner-tab/src/org/example/tabs/PlannerTab.java) | API 5: a planner in a results tab of its own beside Kav's, with live times from its stop board, a bus Live location follows, an alert on a ride, its own stop photos, and times written the way the rider reads them (`Kav.prefs`). |
| [shuttle-widgets](native/shuttle-widgets/src/org/example/widgets/ShuttleWidgets.java) | API 5: two home screen widgets. The next departures of an invented shuttle from the stop chosen in its settings, a tap on the widget for the next stop (a call into its code), a tap on a row for its line's page, asked again when the setting changes (`Kav.refreshWidget`) and when the first shuttle has left; and the rider's recent trips once the rider allows it, each a tap from Kav's planner. |
| [trip-companion](native/trip-companion/src/org/example/trips/TripCompanion.java) | API 5: the rider's trips, each once the rider allows it: every trip event in its log, with the trip's steps and the one navigation shows, a line in the navigation's wait and ride cards (`nav.wait.details`, `nav.ride.details`), a banner under its step dots (`nav.banner`), and the recent trips on its settings screen. |
| [quiet-home](native/quiet-home/src/org/example/quiet/QuietHome.java) | API 5: a theme (`"kind": "theme"`) with one setting, "Hide Home's suggestions", and the code that does it: a calm accent from its manifest, and Home's suggestions card replaced with nothing while the setting is on. |
| [night-sea](themes/night-sea/manifest.json) | API 5: a theme of colors only, with no code at all: deep blue pages, a sea-green accent, line badges on a strip, softer corners, a line round cards and buttons, and a sea-blue map at night. |
| [spots-sample](native/spots-sample/src/org/example/spots/SpotsSample.java) | API 5: Kav's named spots with no hook on its code: how many of a line's vehicles are live on its page (`line.live`, `Kav.vehicles`), a stop's next departure under its name (`stop.header`, `Kav.departures`), the train station nearest Home's nearest stop (`home.nearest`, `Kav.stops`), a line before Live's list (`live.list`), and a vehicle tapped on Live told first, then Kav's own card (`live.vehicle.open`, `Kav.kavAction`). |
| [arrive-sample](native/arrive-sample/src/org/example/arrive/ArriveSample.java) | API 5: Kav 5.2's calls in place of hooks: the same search at the fast pace, its first two routes first in Kav's results (`results.add`, `Kav.plan`), a notification five minutes before the trip you follow gets there that wakes Kav closed too (the `"eta"` event, `Kav.alarm`, `Kav.onAlarm`), and a photo you choose on its settings screen (`Kav.pickFile`). |

All the routes, stops and lines in the samples are invented.
