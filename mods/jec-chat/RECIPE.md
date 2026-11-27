# v0.12.1 — native pane architecture

Source `mods/jec-chat` supplies header (`paneHeader`) and chat body (`paneBody`) roles in the same installed `jec-chat-native` mod. Herdr owns pane geometry, terminal process, focus and native frame. The body gets immutable pane/terminal props, revalidates the target before actions and refreshes only while visible in the active tab, respecting zoom. Each body copy owns its own composer and draft map; it reidentifies on reveal. The shared provider contract from v0.11 is unchanged. The standalone palette dialog remains supported. The experimental installer leaves stable files and hooks untouched.

See native/UPSTREAM.md for build and validation, including focus/keyboard routing. No native compile or E2E proof yet.
