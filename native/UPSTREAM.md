# v0.12.0 — native pane body proof of concept

Base: herdrdev/herdr-app commit 1180a5cec3b8bd4dfebf4a9b217ab8cb59a96ffa (master when inspected).

Apply only to a clean checkout at that revision. This is a prototype, not a released binary or an upstream contribution.

```powershell
git clone https://github.com/herdrdev/herdr-app.git
cd herdr-app
git checkout 1180a5cec3b8bd4dfebf4a9b217ab8cb59a96ffa
git apply --check ../herdr-jec/native/herdr-app-pane-view.patch
git apply ../herdr-jec/native/herdr-app-pane-view.patch
cargo check --locked
```

The command is `pane.view {pane, mod?}`; omitting mod restores the terminal. A window-local override is scoped to the layout, pane and original terminal address. It never changes the model or calls terminal.park/kill. The body mod receives `{pane, terminal, paneBody:true}`. The header sees `panes()[i].body_mod`. A hidden body copy is retained so it can preserve its local state when toggled. Closing/replacing a terminal removes the override. No persisted overrides, no remote model changes, no upstream PR. Focus, keyboard routing, hidden terminal sizing, mod lifecycle and splits require native runtime validation.

This first phase intentionally keeps the existing JEC mods and installer unchanged. The companion layout and per-pane JS refactor are the next phase, after cargo check and runtime validation. Do not install this branch expecting the old mod to use pane.view yet.
