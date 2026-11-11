# Workspace status footer
Feature: move the command shortcut and model/context telemetry into the workspace footer.
Branch: `feat/workspace-status-footer`

## Specs

S1. User request (verbatim): “quiero que lo de comando con la convinacion de teclas pase al lado de settings, y lo del modelo contest pase a estr en el fotter donde dice javijec main y el comands”

S2. User selection (verbatim): “Reemplazar máquina y rama” — footer placement replaces machine and branch while preserving the agent count and usage-limits area.

S3. User follow-up (verbatim): “fijate tambien que deberia verse los TODO y no se ven”

## Tasks

- T1 | S1 | inline | move the command shortcut beside Settings; commit `8db6f56`
- T2 | S1-S2 | inline | move validated Model / Effort and Context into the workspace footer, remove them from Status, preserve agents and usage limits; commit `f49f54b`
- T3 | S3 | inline | constrain the fill-available section's child container so TODO rows can render in its viewport; commit `b4b64e2`

## Log

L1. quiero que lo de comando con la convinacion de teclas pase al lado de settings, y lo del modelo contest pase a estr en el fotter donde dice javijec main y el comands
L2. Reemplazar máquina y rama
L3. fijate tambien que deberia verse los TODO y no se ven
L4. T2 implementation completed in `f49f54b`: the footer reads bounded/fresh bridge snapshots, displays Model/Effort and Context, and the sidebar Status no longer duplicates them. Both mod checks and full tests passed (40 passed, 6 skipped). Native assess rated the shell-reader boundary high and due; inspect currently offers a base diff from the branch base, not the T2-only commit range, so review has not been started while that scope mismatch remains unresolved.
L5. T3 completed in `b4b64e2`: the fill-available section now gives its details container flex sizing and a zero minimum height so the nested TODO scroller has a constrained viewport. Focused sidebar rendering test, `herdr-app check mods/gentle-herdr-sidebar`, full suite (41 passed, 6 skipped), and `git diff --check` passed.
L6. User selected: “Dejar T2 sin revisión” — the T2 native review remains unrun because inspect offered a branch-wide diff from `a926` rather than the T2-only commit range; no capture was submitted.
L3. T1 completed: moved the existing palette shortcut into the Settings footer row, kept its keybinding-derived label and palette action, and removed it from workspace-status. Focused tests and `herdr-app check` for both mods passed; commit `8db6f56`.
