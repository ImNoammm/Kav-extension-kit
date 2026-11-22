# Sample extensions

Eight small extensions in Java, here to be read and copied. Start with the kit's `starter-kotlin/`, then
`native/speed-card`.

Check one, or build it into a bundle and add it in Kav with Settings › Extensions › Sources › Add a bundle file
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

All the routes, stops and lines in the samples are invented.
