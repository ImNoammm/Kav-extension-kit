# My Kav extensions

Extensions for [Kav](https://kavapp.link), the open-source transit app. Made and published by me, not by Kav.

[![Add to Kav](add-to-kav.svg)](https://kavapp.link/add-source?github=OWNER/REPO)

To add this source by hand: in Kav open Settings, Extensions, Sources, the plus, and enter `OWNER/REPO`. Its
extensions come in off: switch on the ones you want.

## What is here

| Extension | What it does |
|---|---|
| My extension | Say in a sentence what it does for a rider. |

Problems with these extensions go to this repository's issues, not to Kav.

## For developers

This repository was started from the Kav extension kit's template. Replace `OWNER/REPO` and the table above, and
delete this section when you no longer need it.

Each extension is a folder under `extensions/`: its `manifest.json` and its Kotlin or Java under `src/`. The kit's
`kavx` builds them all into one bundle (`.kavb`), and each GitHub Release of this repository carries it. Kav reads the
latest release's bundle.

```
kavx check extensions/my-extension     builds one extension and checks it the way Kav does
kavx bundle . --out my.kavb            builds the bundle; add it in Kav with Settings, Extensions, Sources, +, Add a bundle file
```

### Releasing

Raise `release` and `version` in the manifest of each extension that changed, commit, then tag and push
(`git tag v1 && git push origin v1`). `.github/workflows/release.yml` builds the bundle and attaches it to a release
for the tag. By hand: `kavx bundle . --out my.kavb`, then `gh release create v1 my.kavb`.

## License

GPL-3.0. See [LICENSE](LICENSE).
