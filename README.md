# Herdr layout: Javijec

This folder is a portable package for the Javijec layout. To install it on another PC, copy these contents into that PC's Herdr app home, preserving the folder structure:

- `layouts/javijec.json` → `<HERDR_APP_HOME>/layouts/javijec.json`
- `mods/*` → `<HERDR_APP_HOME>/mods/`
- `themes/*` → `<HERDR_APP_HOME>/themes/`
- `extensions/gentle-herdr-bridge.mjs` and `bridge/*` → keep together in this package and load the extension from your Pi/Gentle Shell setup
- `RECIPE.md` and `preview.png` are the layout's share-page description and preview.

Do not replace existing files with the same names without checking them first. After copying, run `herdr-app check mods/<name>` for each included mod, then switch with:

```powershell
herdr-app do layout.switch '{"name":"javijec"}'
```

The PR and Linear panels require their respective local CLI/helper and authentication. The optional Gentle Shell panel also needs the separate Pi bridge extension enabled; it is a read-only projection and does not provide live Gentle Agents task progress or 1:1 parity. See [RECIPE.md](RECIPE.md) for integrations and limitations.

The Gentle Shell selector is included in `layouts/javijec.json`. The Herdr mod lives at `mods/gentle-herdr-sidebar/`; its bridge is `extensions/gentle-herdr-bridge.mjs` with data helpers under `bridge/`. This package does not install or enable the extension automatically and does not edit user-level Herdr or Gentle Shell configuration.

Run the deterministic package checks with `npm test`. The bridge can be loaded from Pi through the package's `pi.extensions` declaration.

Before publishing this package publicly, review or replace `preview.png`: it is a live screenshot and may show current workspace names or terminal content.

## Check original Estro for updates

The original Estro repo keeps mod pointers under `estro/`; the mod source folders are at the repository root. `check-estro-updates.ps1` compares the saved upstream commit in `upstream-estro.json` with GitHub's current `main`, then prints patches for `estro/` and the original mods Estro depends on. It uses the public GitHub API and needs no Git clone or credentials.

```powershell
pwsh -File .\check-estro-updates.ps1
```

Review the diff before accepting it. Only then advance the checkpoint:

```powershell
pwsh -File .\check-estro-updates.ps1 -AdvanceBaseline
```

This watches the original upstream mods, not the customized copies in this package. The original Estro recipe's module list is recorded in `upstream-estro.json`; update that list if the upstream layout adds or removes modules.
