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

## Companion mod (v0.12.1)

This branch now contains the unified JEC mod source at `mods/jec-chat`, installed under the separate name `jec-chat-native`. The new layout is `jec-chat-native`. The same mod renders the native header (props.paneHeader) and chat body (props.paneBody); the original global stack is not used. Stable JEC files and hooks stay installed separately. Run the experimental installer only after compiling the patched binary and checking it. Native compilation and GUI integration have not yet been verified.

```powershell
# From the JEC feature branch, after compiling Herdr with the patch:
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -HerdrApp 'C:\path\to\herdr-app.exe'
```
Select the new layout from the patched application. Test two simultaneous split chats, terminal/chat toggle, tab/space switching, zoom, send, close, and native focus/keyboard routing. Roll back by selecting the stable layout in the original binary.

## v0.12.2 official pane baseline

The experimental layout derives from the official main layout, and the shared header derives from the official pane mod. See `native/upstream/README.md`. The native patch is unchanged; no additional Rust changes are required for this refactor.
