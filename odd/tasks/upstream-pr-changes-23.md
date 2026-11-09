# Upstream Branch PR + Better Changes 2.3
Feature: implement the selected upstream 2.3 PR-file integration in this package while preserving its local layout and existing behavior.
Branch: `feat/upstream-pr-changes-23`; delivery strategy: `single-pr` (user selected; no PR creation or publishing is authorized); test runner: Node tests in each mod plus Go helper tests where applicable.

## Specs

S1. Original user request: “https://github.com/munza/herdr-mods podes revisar todos los mod que tenemos instalados y ver los cambios? me interesa implementar los cambios que se puedan implementar”

S2. User selected the implementation slice “PR + Changes 2.3 primero” with the description “Pestaña Files y diffs de PR dentro de Better Changes; también badge Merged.”

S3. Implement the selected upstream behavior in local `mods/branch-pr/` and `mods/better-changes/`: show a PR Files tab and Merged badge; open GitHub PR file patches in Better Changes when available, otherwise open the PR Files page on GitHub. Preserve existing local layout, mod integrations, and tests.

## Tasks

- T1 | S2-S3 | inline | done | Add Better Changes patch-scope rendering and regression tests; commit evidence will be logged after the work-unit commit.
- T2 | S2-S3 | inline | pending | Add Branch PR Files tab, Merged badge, helper files action, tests, and relevant docs; confirm and preserve the nested package mirror; commit recorded after verification.
- T3 | S2-S3 | inline | pending | Verify both mods and the helper together; record exact checks and commit evidence.

## Log

L1. https://github.com/munza/herdr-mods podes revisar todos los mod que tenemos instalados y ver los cambios? me interesa implementar los cambios que se puedan implementar
L2. User selected “PR + Changes 2.3 primero” — “Pestaña Files y diffs de PR dentro de Better Changes; también badge Merged.”
L3. Local manifests identify Better Changes and Branch PR as 2.2.0; upstream manifests identify both as 2.3.0. Upstream commit `3070b165852f28c13b9e5c2edd3ece383ce4d539` describes the coupled PR-files/patch integration. This is a shared cross-mod contract (Risk item 3); keep the integration behavior in one reviewable work unit and independently verify the final unit.
L4. Existing unrelated user change in `odd/tasks/gentle-shell-sidebar-panel.md` must remain untouched. Engram task mirror is pending because the installed Engram runtime rejected its contract (`engram.pi-http-runtime/v1` mismatch); no persistent mirror has been confirmed.
L5. Began T1 after the user selected the PR + Changes 2.3 slice. The upstream reference is approximately 451 authored changed lines.
L6. User selected “Un solo PR (menos recomendado)” (`single-pr`) as the grouping strategy. This does not authorize creating or publishing a PR.
L7. Local code mapping confirms the diff-tab selection path in `mods/better-changes/views/diff.js`, PR detail tabs in `mods/branch-pr/views/detail.js`, and helper dispatch in `mods/branch-pr/helper/main.go`. Branch PR also contains nested packaged sources under `mods/branch-pr/mods/branch-pr/`; verify its packaging test before deciding which copies require synchronized edits.
L8. RED observed: `node --test test/better-changes-patch.test.cjs` failed the three new patch-scope expectations; the existing commit-scope regression passed (1/4).
L9. GREEN/final T1 checks: `npm test` passed 12/12; `node --check mods/better-changes/views/diff.js` and `git diff --check` passed. Added patch-scope rendering from GitHub's supplied patch (including the missing-patch notice), correct PR header labeling, and a regression for existing commit-scope selection.
