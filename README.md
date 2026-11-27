# herdr-jec — v0.12.1 native pane prototype

**Experimental branch; not a drop-in update.** Stable v0.11.1 remains on main. The same JEC mod is now used for each pane's header and optional Chat body. The actual terminal remains a native Herdr view. Each pane can switch independently through the proposed native `pane.view` command. No global chat stack, no shared tab-preference map, no restoration timer in the new layout.

Requires the patched Herdr Desktop, see [native build and testing](native/UPSTREAM.md). Install the existing agent integrations from main first; then install the experimental mod using this branch's installer, which refuses an unpatched CLI and installs only `jec-chat-native` (mod and layout). Legacy files retained in this branch for reference are not installed. The existing providers, hooks, registration formats and integrations have not changed.

Native compilation, focus/keyboard behavior, hidden view sizing and real split behavior remain to be validated. Preferences are window-local and not persisted across restart. No upstream PR or released binary yet.
