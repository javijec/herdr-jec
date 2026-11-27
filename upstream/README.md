# Official Herdr source reference

The pinned Git submodule [herdr-app](https://github.com/herdrdev/herdr-app/tree/1180a5cec3b8bd4dfebf4a9b217ab8cb59a96ffa) contains the complete official sources (including all default mods, assets, layouts, licenses and API declarations) at revision `1180a5cec3b8bd4dfebf4a9b217ab8cb59a96ffa`. It is a read-only development reference, not a fork or an installed dependency.

## All 21 official mods

- [agents](https://github.com/herdrdev/herdr-app/tree/1180a5cec3b8bd4dfebf4a9b217ab8cb59a96ffa/defaults/mods/agents)
- [changes](https://github.com/herdrdev/herdr-app/tree/1180a5cec3b8bd4dfebf4a9b217ab8cb59a96ffa/defaults/mods/changes)
- [confirm](https://github.com/herdrdev/herdr-app/tree/1180a5cec3b8bd4dfebf4a9b217ab8cb59a96ffa/defaults/mods/confirm)
- [files](https://github.com/herdrdev/herdr-app/tree/1180a5cec3b8bd4dfebf4a9b217ab8cb59a96ffa/defaults/mods/files)
- [help](https://github.com/herdrdev/herdr-app/tree/1180a5cec3b8bd4dfebf4a9b217ab8cb59a96ffa/defaults/mods/help)
- [machine-add](https://github.com/herdrdev/herdr-app/tree/1180a5cec3b8bd4dfebf4a9b217ab8cb59a96ffa/defaults/mods/machine-add)
- [menu](https://github.com/herdrdev/herdr-app/tree/1180a5cec3b8bd4dfebf4a9b217ab8cb59a96ffa/defaults/mods/menu)
- [new-menu](https://github.com/herdrdev/herdr-app/tree/1180a5cec3b8bd4dfebf4a9b217ab8cb59a96ffa/defaults/mods/new-menu)
- [pane](https://github.com/herdrdev/herdr-app/tree/1180a5cec3b8bd4dfebf4a9b217ab8cb59a96ffa/defaults/mods/pane)
- [peek](https://github.com/herdrdev/herdr-app/tree/1180a5cec3b8bd4dfebf4a9b217ab8cb59a96ffa/defaults/mods/peek)
- [picker](https://github.com/herdrdev/herdr-app/tree/1180a5cec3b8bd4dfebf4a9b217ab8cb59a96ffa/defaults/mods/picker)
- [prompt](https://github.com/herdrdev/herdr-app/tree/1180a5cec3b8bd4dfebf4a9b217ab8cb59a96ffa/defaults/mods/prompt)
- [spaces](https://github.com/herdrdev/herdr-app/tree/1180a5cec3b8bd4dfebf4a9b217ab8cb59a96ffa/defaults/mods/spaces)
- [tabs](https://github.com/herdrdev/herdr-app/tree/1180a5cec3b8bd4dfebf4a9b217ab8cb59a96ffa/defaults/mods/tabs)
- [terminals-bar](https://github.com/herdrdev/herdr-app/tree/1180a5cec3b8bd4dfebf4a9b217ab8cb59a96ffa/defaults/mods/terminals-bar)
- [terminals-pane](https://github.com/herdrdev/herdr-app/tree/1180a5cec3b8bd4dfebf4a9b217ab8cb59a96ffa/defaults/mods/terminals-pane)
- [toast](https://github.com/herdrdev/herdr-app/tree/1180a5cec3b8bd4dfebf4a9b217ab8cb59a96ffa/defaults/mods/toast)
- [win98](https://github.com/herdrdev/herdr-app/tree/1180a5cec3b8bd4dfebf4a9b217ab8cb59a96ffa/defaults/mods/win98)
- [workspace-chrome](https://github.com/herdrdev/herdr-app/tree/1180a5cec3b8bd4dfebf4a9b217ab8cb59a96ffa/defaults/mods/workspace-chrome)
- [workspace-status](https://github.com/herdrdev/herdr-app/tree/1180a5cec3b8bd4dfebf4a9b217ab8cb59a96ffa/defaults/mods/workspace-status)
- [worktree](https://github.com/herdrdev/herdr-app/tree/1180a5cec3b8bd4dfebf4a9b217ab8cb59a96ffa/defaults/mods/worktree)

Also available in the reference: `defaults/layouts`, `defaults/frame`, `defaults/icons`, `defaults/programs.json`, `defaults/herdr.d.ts`, `defaults/AGENTS.md` and upstream licenses. No assets or binary files are omitted by the Git reference.

To materialize the reference locally only if needed:

```sh
git submodule update --init --depth 1 upstream/herdr-app
```

Do not initialize nested submodules; the defaults do not require them. No build, CI, or installation is required. Ordinary mod installation remains independent of this reference.

## Development policy

1. Inspect the official mod first and reuse it unchanged whenever possible.
2. If an extension is necessary, use the official code as a baseline in a separately named JEC mod; document the minimal delta and preserve licenses.
3. Never copy the stock mods into the user's active configuration automatically or modify the executable.
4. Before upgrading the reference, compare upstream changes and retest only the affected JEC mods. The gitlink is pinned, not automatically advanced.

