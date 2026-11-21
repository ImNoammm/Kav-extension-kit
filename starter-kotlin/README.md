# Hello Kotlin: a starter extension for Kav

A card on Kav's Home with a button and a dialog, and a screen of its own, in one Kotlin file. Copy this folder,
change the names, and build it:

```
kavx check <this folder>       # builds it and prints what Kav and riders would see
kavx bundle <this folder>      # writes <folder name>.kavb
```

That compiles `src/` against Kav's API, makes the dex and writes a bundle with this one extension in it. You need a
JDK, the Android SDK and the Kotlin compiler; the kit's `docs/native.md` says where to get them, and explains every
method used here.

- `manifest.json`: what Kav and riders are told. Change `name`, `displayName`, `description`, and `native.entry` if
  you rename the class or its package. A card needs its `slot.home` contribution, a screen its page under `pages`.
- `src/org/example/hello/Hello.kt`: the code. `start` registers the card and the screen; Kav asks each for a view
  when its screen shows.

To try it: copy the `.kavb` to a phone or emulator with Kav 5 or newer, open Settings › Extensions › Sources › Add a
bundle file, add it, and switch Hello Kotlin on. The card is on Home, and the screen opens from the extension's page
in Settings › Extensions.
