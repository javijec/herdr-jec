Locator: odd/tasks/git-graph-in-changes.md

# Replace Commits with Git Graph
Objective: Embed the complete Better Git Graph experience in Better Changes’ existing Commits tab.
Branch: feat/git-graph-in-changes | Delivery: ask-on-risk | Test runner: npm test; herdr-app check mods/better-changes

## Specs
1. **S1 — Replace the commits view.** User request: “quiero integrar git-graph dentro de changes. tiene que remplazar la tabs de commits”. Keep the existing Changes/Commits navigation slot and replace its commit-list content with the Git Graph view. The graph must use the repository context selected by Better Changes.
   - Acceptance: opening the Commits tab renders the graph view in place of the old history list; Changes tab, file diff behavior, and commit box remain intact.
   - Checks: focused graph integration test; `npm test`; `herdr-app check mods/better-changes`.
2. **S2 — Preserve the complete Git Graph.** User confirmation: “si quiero todo”. Integrate the complete existing Better Git Graph interactions, including branch/remote scope controls, fetch/refresh, label checkout, context menus, action dialogs, selected-commit details, and diff viewing. Route overlays through Better Changes so the integrated experience does not depend on installing a second mod.
   - Acceptance: graph actions operate on the Better Changes repository context; menu/dialog overlays open through Better Changes; no action silently targets a different focused repository.
   - Checks: focused interaction/routing tests; `npm test`; `herdr-app check mods/better-changes`.

## Tasks
- T1 — S1-S2 — inline (one integrated behavior; no independent writer unit) — independently verified PASS; commit: `d542917`.
  - Risk: item 1 (integrates graph actions that can delete branches/tags, reset refs, or change remote state); independent verification required.

## Log
- L1 (2026-11-09): “quiero integrar git-graph dentro de changes. tiene que remplazar la tabs de commits”
- L2 (2026-11-09): “si quiero todo”
- L3: CodeGraph mapped existing Better Changes paged commit history and the standalone Better Git Graph module; full integration must adapt its location, refresh, and overlay routing to Changes context.
- L4: Started on feature branch `feat/git-graph-in-changes` from `master`. Initial estimate: ~1,000 authored lines because the graph’s UI, Git operations, popup menu, dialogs, icons, and integration tests form one behavior. Delivery strategy is `ask-on-risk`; ask for chain strategy before first feature commit if forecast exceeds ~400 authored lines.
- L5: Receipt-driven development is globally off; ordinary tests/checks apply; no native review lifecycle. Engram mirror pending because the host session is not registered.
- L6: Baseline commit is `48305c6`. Full Graph actions include destructive local ref/working-tree and remote mutations, so item 1 requires independent verification after writer checks; verification probes will use an isolated scratch repository.
- L7: Embedded the existing Graph view and its Git/menu/dialog modules inside Better Changes; the Commits slot now routes to it, and overlays/actions are hosted by Better Changes using the selected Changes location. Focused integration tests passed (3/3); `herdr-app check mods/better-changes` passed; full `npm test` passed 12 tests and retains the known baseline `agentProgressNotice` export mismatch in `test/gentle-herdr-sidebar-model.test.mjs`.
- L8: Independent verifier passed S1-S2 with no candidate-caused blockers; verified selected repo/machine routing, overlay routing, invalid-dialog no-Git-call and unchanged data hash, local Git action probes, and icon/import completeness in scratch. It confirmed `npm test` fails identically at baseline 48305c6 (12 current tests pass, one pre-existing import/export mismatch); `herdr-app check` passes. No live GUI proof was collected. Verifier scratch cleanup at `C:\Users\javij\AppData\Local\Temp\tmp.ilu2Ak2mqu` was blocked by the shell policy after verifying it resides under system temp. Engram mirror still pending because the host session is unregistered.
- L9: `herdr-app check` generated a redundant 812 KB nested `gpui-kit.d.ts` in the new graph folder; removed that generated artifact before delivery. The pre-existing local `mods/better-changes/jsconfig.json` remains untracked and is not part of the feature staging scope.
- L10 (2026-11-09): User reported the embedded Graph render failed at `.track_focus(this.handle)` with “track_focus(handle) expects a FocusHandle from cx.focus_handle(), not a name or an element”. Root cause: the nested Graph allocated its focus handle using the context passed during lazy manual initialization. The owning Better Changes View now allocates a FocusHandle during its own `init` and passes it to the embedded Graph; standalone Graph retains its own `cx.focus_handle()` fallback. Added a regression test for reusing the owner-provided handle. Focused graph tests pass 4/4; `herdr-app check mods/better-changes` exited successfully without output. Live GUI re-render remains unverified.
- L11 (2026-11-09): User requested removing standalone Git Graph from the layout while preserving Better Changes, then confirmed removal of the standalone mod files as part of the commit. Removed its toolbar button and panel block from `layouts/javijec.json`, set `changes` active, and deleted the standalone `mods/better-git-graph/` sources; the full implementation remains under `mods/better-changes/git-graph/`.
- L12 (2026-11-09): User authorized committing all scoped changes and merging to the confirmed `master` branch. Focused graph tests pass 4/4, `herdr-app check mods/better-changes` exits successfully, layout JSON parses with no standalone Git Graph references and `changes` active. `npm test` reports 13 passing tests and one pre-existing failure: `agentProgressNotice` is imported but not exported by `mods/gentle-herdr-sidebar/model.js`.
- L13 (2026-11-09): Work-unit commit created as `d542917` (`feat(better-changes): integrate git graph`). The full suite's only failure is the previously observed baseline export mismatch; merge to `master` is next.
