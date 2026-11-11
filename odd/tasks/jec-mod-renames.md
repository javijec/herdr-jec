# Rename project-owned mods to the `jec-` namespace
Branch: `feat/jec-mod-names` · Delivery: ask-on-risk · Test runner: `node --test`

## Specs

### S1 — Rename mod identifiers
User request: “quiero cambiar el nombre de los mods, better es sacado de otros mod y nuestros mod se estan diferenciando mucho de los originales”
Approved names: `better-changes` → `jec-changes`, `better-files` → `jec-files`, `better-tabs` → `jec-tabs`, `my-better-sidebar` → `jec-sidebar`, `branch-pr` → `jec-branch-pr`, `branch-issue` → `jec-branch-issue`, `usage-limits` → `jec-usage-limits`.
Acceptance: folder names, references, assets, tests, layout/installer use the new IDs; cross-mod integrations still work.
Checks: focused test files, `npm test`, `herdr-app check` for installed mod paths, `git diff --check`.

### S2 — Preserve existing user state
Preserve existing settings and persisted shared/local state where old names are embedded; do not rename unrelated keys merely because they contain “better” or “sidebar”.
Acceptance: existing old-ID state remains readable after rename, or is migrated without losing values; avoid overwriting existing data.
Checks: regression tests for any migration/compatibility logic.

### S3 — Remove unused standalone machine vitals mod
User request: “si no se usa elimina my-machine-vitals”
Acceptance: confirm no active layout/runtime references; remove the standalone mod only if unused, and preserve useful test coverage through the integrated sidebar where applicable.
Checks: reference search, focused tests, full suite.

### S4 — Migrate legacy installations in the installer
User request: “y no podemos hacer que cuando corra el script de instalacion verifique que esta lo viejo copie los settings, borre los archivos sin renobrar y ponga los nuevos?”
Acceptance: `install-layout.ps1` detects old mod folders, migrates their settings to the new mod without overwriting new settings, installs new files/layout, then removes old active folders only after making a recoverable backup. Re-running is safe.
Checks: installer regression tests; PowerShell syntax/runtime check when available; backup and non-overwrite behavior.

## Tasks
- T1 — S1/S2, delegated: rename Changes + Files and their integrated references/state compatibility; in progress.
- T2 — S1/S2, delegated: rename Tabs and preserve its state; in progress.
- T3 — S1/S2, delegated: rename Sidebar and preserve settings/state; in progress.
- T4 — S1/S2/S3, inline: rename layout, Branch/Usage mods, update docs/tests, remove unused standalone Vitals and verify; in progress.

## Log
- L1 — User: “quiero cambiar el nombre de los mods, better es sacado de otros mod y nuestros mod se estan diferenciando mucho de los originales”
- L2 — User approved the `jec-` convention and clarified: “estabamos cambiandole el nombre”.
- L3 — Explorer mapped cross-mod dependencies, shared-state keys, localStorage and installer/layout references. CodeGraph sync/explore succeeded in the explorer. Main risk is breaking layout IDs or persisted settings/state. Preserve old persisted keys or migrate safely.
- L4 — User change: “a branch-y usage-limits  tambien agregale jec-, temnien si no se usa elimina my-machine-vitals”. Interpret “branch-*” as both existing `branch-pr` and `branch-issue`; both are project-owned mods and must be renamed.
- L5 — Renamed all seven selected mod folders and updated `layouts/javijec.json`, assets, runtime IDs, test imports and RECIPE. Retained legacy shared/localStorage keys. Removed `my-machine-vitals`; moved its tested metrics parser into `jec-sidebar/views/metrics.js`.
- L6 — All seven `herdr-app check mods/jec-*` checks passed. `npm test`: 24 pass, 1 known baseline failure (`agentProgressNotice` missing export), 5 installer tests skipped because PowerShell is unavailable. Layout JSON and `git diff --check` pass. Remaining: add safe fallback for old per-mod `mod.json` settings and review final diff/status; no commit/push.
- L7 — User proposed migration in `install-layout.ps1`: detect legacy dirs, copy settings, remove old active files, and install new versions. Accepted safe implementation: back up legacy files before removing them; destination settings take precedence.
- L8 — Implemented S4 in `install-layout.ps1`: deep-merge prior settings into the new mod config with new values winning; archive renamed old mod folders under `.herdr-layout-backups` after migration; archive obsolete `my-machine-vitals`; skip when the new mod is unavailable and guard reruns against duplicate archive paths. Added a regression test for settings merge, archive and legacy-folder removal.
- L9 — `git diff --check` and layout JSON parse pass. Installer tests are all skipped because `pwsh` is unavailable. Independent item-5 verifier could not start because the runtime reported its agent thread limit reached. S4 remains pending Windows/PowerShell runtime proof and independent verification.
