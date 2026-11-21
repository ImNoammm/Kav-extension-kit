<p align="center">
  <img src=".github/icon.png" width="112" alt="Kav">
</p>

<h1 align="center">Kav extension kit</h1>

<p align="center">
  Everything you need to build extensions for Kav.
</p>

<p align="center">
  <img alt="Node.js 22.2 or newer" src="https://img.shields.io/badge/Node.js-22.2%2B-339933?logo=nodedotjs&logoColor=white">
  <a href="LICENSE"><img alt="GPL-3.0" src="https://img.shields.io/badge/license-GPL--3.0-lightgrey"></a>
</p>

<p align="center">
  <a href="https://www.buymeacoffee.com/Noamm"><img alt="Buy Me A Coffee" src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png"></a>
</p>

Tools for writing extensions for [Kav](https://kavapp.link), the open-source Android transit app. An extension
changes what Kav does for the rider who switches it on: a card on Home, screens and a Home of its own, things on
Kav's maps, a trip planner, stops and timetables Kav has no data for, how long walks take, which routes are shown and
in what order, Kav's colors. You publish your extensions as one bundle on your own GitHub repository's releases;
riders add the repository to Kav as a source. Kav does not review, host or approve extensions: riders switch them on
at their own risk, and Kav lists what each one can do.

An extension is Android code, in Kotlin or Java, that runs inside Kav through a small Java API, with full access:
Kav's own components, its maps, the phone's GPS and notifications, anything Android offers.

The kit needs Node.js 22.2 or newer and has no dependencies. Building an extension also needs a JDK, the Android SDK
and, for Kotlin, the Kotlin compiler ([docs/native.md](docs/native.md) says where to get them). The kit makes no
network calls and collects nothing.

## Getting it

```sh
git clone https://github.com/ImNoammm/kav-extension-kit
cd kav-extension-kit
npm link                                   # puts kavx on your PATH
```

## Start here

```
cp -r starter-kotlin my-extension          # a Home card with a button, and a screen of its own
kavx check my-extension                    # builds it and prints what Kav and riders would see
kavx bundle my-extension                   # writes my-extension.kavb
```

Copy the `.kavb` to a phone or an emulator with Kav 5 or newer, open Settings › Extensions › Sources › Add a bundle
file, add it, and switch the extension on: the card is on Home. [docs/native.md](docs/native.md) has every method of
the API with an example, the crash guard, safe mode and how to see logs.

To publish, put the `.kavb` on a GitHub Release of your repository. `kavx link github owner/repo` prints the "Add to
Kav" link for it.

## What is here

- **`kavx`**, a command line:
  - `kavx check <folder>` builds one extension and checks it the way Kav does;
  - `kavx bundle <folder> [--out file.kavb] [--name name]` builds every extension under `<folder>/extensions/` (or
    the folder itself, when it is one extension) into one bundle;
  - `kavx verify <file.kavb>` reads a bundle the way Kav does;
  - `kavx link github <owner/repo>` prints the add-source links.
- **`starter-kotlin/`**, the starter, and **`api/`**, Kav's API as a jar to compile against (made from Kav's own
  sources by `tools/make-api-jar.js`), with its sources to read.
- **Samples** in `samples/native/`, in Java: a speed card with the GPS and a notification, map pins, a planner with
  route rules and a stop board, a Home and a tab, a crash test.
- **A template** for a source repository.

| Read | For |
|---|---|
| [docs/native.md](docs/native.md) | Building, the API, the crash guard, logs, trying it on a phone |
| [docs/hooks.md](docs/hooks.md) | Every hook, every field it is given, every answer it may give |
| [docs/screens.md](docs/screens.md) | Cards on Kav's screens, pages, settings, a Home body, block trees, themes |
| [docs/format.md](docs/format.md) | The bundle, the manifest field by field, sources and links |
| [docs/what-riders-see.md](docs/what-riders-see.md) | What Kav tells riders about your extension |
| [docs/riders-wording.md](docs/riders-wording.md) | The names of the screens and switches a rider meets, in English and Hebrew |
| [docs/testing.md](docs/testing.md) | Checking, unit-testing hooks, trying on a phone |
| [samples/](samples/) | Five small extensions to read |
| [template/](template/) | The repository to copy |

## What an extension can do

| You want to | In Kotlin or Java |
|---|---|
| Add a card to Home, a trip's page or a stop's board | `kav.card("home", ...)`, `"trip"`, `"stop"`: any Android view |
| Add a line under each search result | `kav.card("results", ...)` |
| Have screens of your own, a tab, or a Home of your own | `kav.screen(...)`, `kav.home(...)` |
| Draw on Kav's maps, and restyle its stops | `kav.map()` |
| Replace the planner | `kav.provide("plan.provide", ...)` |
| Add stops, timetables and stop boards Kav has no data for | `kav.provide("board.stops", ...)`, `"board.departures"` |
| Change how long walks take, how changes are judged, which routes show, their order, their tags | `kav.provide("walk.time", ...)` and the other route rules |
| Let the rider set things | `settings` in the manifest, read with `kav.settings()` |
| Reach the internet, the GPS, notifications | Android's own APIs |
| Change Kav's colors | `theme` in the manifest |

Adding a source installs its extensions switched off. The rider switches on the ones they want, each on its own,
and can turn each card off on the extension's page in Settings › Extensions.

## Developer terms

By publishing an extension for Kav you agree to these.

- You are the sole author and publisher of your extension and fully responsible for it, including any claim made
  about it.
- You must have the right to use every service, API and piece of data your extension touches, and must follow their
  terms. Kav gives you no rights to any third-party service.
- You may not present your extension as made, endorsed or approved by Kav, or use Kav's name or logo as your own
  branding. "for Kav" in a description is fine.
- You agree to hold Kav and its maintainer harmless for claims arising from your extension.
- Kav can block an extension on its security list, remove a directory listing, and change or drop extension points
  at any time.

Kav shows riders every extension as its publisher's own work, with the source it came from, and tells them Kav did
not make, review or approve it.

## License

GPL-3.0, like Kav: the kit, the template and the samples. An extension started from the template is GPL-3.0 too,
so riders can read what it does with their trips.
