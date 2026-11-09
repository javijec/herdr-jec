# Upstream Branch PR + Better Changes 2.3
Feature: implement the selected upstream 2.3 PR-file integration in this package while preserving its local layout and existing behavior.
Branch: `feat/upstream-pr-changes-23`; delivery strategy: `single-pr` (user selected; no PR creation or publishing is authorized); test runner: Node tests in each mod plus Go helper tests where applicable.

## Specs

S1. Original user request: “https://github.com/munza/herdr-mods podes revisar todos los mod que tenemos instalados y ver los cambios? me interesa implementar los cambios que se puedan implementar”

S2. User selected the implementation slice “PR + Changes 2.3 primero” with the description “Pestaña Files y diffs de PR dentro de Better Changes; también badge Merged.”

S3. Implement the selected upstream behavior in local `mods/branch-pr/` and `mods/better-changes/`: show a PR Files tab and Merged badge; open GitHub PR file patches in Better Changes when available, otherwise open the PR Files page on GitHub. Preserve existing local layout, mod integrations, and tests.

## Tasks

- T1 | S2-S3 | inline | done | Add Better Changes patch-scope rendering and regression tests; commit `478ddbc` (`feat(better-changes): render GitHub PR patches`).
- T2 | S2-S3 | inline | done | Add Branch PR Files tab, Merged badge, helper files action, tests, and relevant docs; synchronize the root installed mod with the nested tested source while preserving their intentional `views/ui.js` difference; commit `8050665` (`feat(branch-pr): add PR files tab and Changes handoff`).
- T3 | S2-S3 | inline | done | Verify Better Changes (29/29), Branch PR and packaging (67/67), Go helper tests (`go test ./...`), and scoped `git diff --check`; independent verifier returned S2/S3 met. Native ASSESS returned no candidate because unrelated untracked files were undeclared; no review lineage was started.

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
L10. T1 work-unit commit: `478ddbc` (`feat(better-changes): render GitHub PR patches`).
L11. Packaging investigation: `mods/branch-pr/tests/pr.test.cjs` loads `mods/branch-pr/mods/branch-pr/` as test source; `mods/branch-pr/` at the package root is the installed mod. Those trees are identical except `views/ui.js`, so T2 must update both copies without overwriting that intentional UI difference.
L12. The first T2 test invocation had a syntax error in a newly written regex; zero tests executed. The regex was corrected before the focused run.
L13. T2 RED observed: `node --test mods/branch-pr/tests/pr.test.cjs` passed the 59 existing cases and failed all 6 new behavior cases (Merged badge, Files tab, fallback, Better Changes handoff, file tree, and preserving PR context after switching to a diff tab).
L14. Added a Go helper regression for paginated PR-file requests and rejecting a missing PR number without invoking `gh`.
L15. The first `go test ./...` ran from the repository root and failed before tests because no module is there (zero tests); rerun from `mods/branch-pr/helper` produced RED: `TestFilesReadsEveryPageOfThePRsFiles` fails with `unknown action`, while the existing helper/install tests pass.
L16. Implemented helper query/action, saved Files section routing, PR detail tab/count and Merged badge, file-tree model, Files view, Better Changes handoff/fallback, and last-terminal context preservation in both Branch PR copies. Added the Files view to the PR test loader. Manifests and docs are updated to 2.3.
L17. First combined check: Branch PR tests had 66 pass and 1 failure. The remaining failure was in the new handoff assertion: it compared nested VM objects without normalizing both sides, although the actual and expected values printed the same structure. Go helper tests/install tests passed; JavaScript syntax and `git diff --check` passed.
L18. After normalizing the expected handoff structure, `node --test mods/branch-pr/tests/pr.test.cjs mods/branch-pr/tests/packaging.test.cjs` passed 67/67. The helper's PR-file pagination test and `go test ./...` also passed from `mods/branch-pr/helper`. Added an extra direct contract check for the `changedFiles` count in the helper's detail response; `go test ./...` passed again with it included.
L19. T2 implementation outcome: Both Branch PR copies now expose the Files tab (count, tree/flat layout, folder collapse, GitHub patch handoff/fallback) and Merged badge; helper pagination and last-terminal context retention are covered, and manifests/docs identify 2.3.0. The PR test and package checks passed 67/67; full feature closure checks remain in T3.
L20. Native ASSESS for committed T1 (`baseRef: master`, committed-only) failed before candidate admission because untracked files require an explicit declaration. The returned plan reports RDD on, risk medium/native risk unassessable, writer self-verification, and no independent verifier because no Task Size high-risk item was escalated. Do not retry this assessment; retain the failure and finish proportionate functional checks.
L21. On Windows, the Better Changes conflict test exposed CRLF conflict markers: the parser compared `=======\r` literally and displayed “No conflict markers left.” Added CRLF normalization in `conflictParts` and a focused CRLF regression; RED was observed, then Better Changes passed 29/29. Branch PR + packaging passed 67/67, `go test ./...` passed in `mods/branch-pr/helper`, and scoped `git diff --check` passed.
L22. User authorization verbatim: “hace commits y mergea y pushea”; scope selection: “Solo PR + Changes 2.3.” Exclude all other mods, `mods/better-config/keys.json`, and the unrelated sidebar task change. Commit `8050665` contains the selected 82-path slice.
L23. Independent verifier read this task record and commit `8050665` against its parent, ran the focused Node and Go checks in a scratch copy, and reported S2/S3 met with no blocker; its only advisory was the expected GitHub fallback when no active Herdr space/folder exists. Native ASSESS on `8050665` against `478ddbc` with `committedOnly: true` failed before candidate admission because unrelated untracked files in the working tree were undeclared (`changedPaths: 0`, no candidate, review outcome unknown). No native review lineage or capture was started.
