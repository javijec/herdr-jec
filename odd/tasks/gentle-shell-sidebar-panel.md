# Integrate Gentle Shell sidebar into javijec
Target repository: `D:/Programacion/herdr-jec`; upstream implementation: `D:/Programacion/gentle-shell-herdr`.
Integrate as an additional selectable Herdr panel without replacing existing javijec sidebar modules.

## Specs
1. **S1 — User request:** “quiero integrar todo lo que hicimos en mi tema javijec”
2. **S2 — Mod form and destination:** “quiero que lo que hiciste sea un mod mas dentro del tema javijec que ya existe” and “D:\Programacion\herdr-jec”
3. **S3 — Panel selection:** “ponelo en seleccionables como files, changes o git graph”
4. **S4 — Preserve current theme:** add Gentle Shell as a selectable panel in the javijec layout alongside existing Files, Changes, Git Graph options; do not replace existing `my-better-sidebar` panels.
5. **S5 — Preserve integration boundaries:** do not fork or modify Gentle Shell; keep the bridge as a Pi extension and the Herdr panel as a separate mod. Preserve absent/stale/malformed data as unavailable; do not claim live Gentle Agents progress or one-to-one parity.
6. **S6 — Deliverable:** include the bridge and mod implementation, make it selectable in javijec, and update the package documentation and applicable checks.

## Tasks
- T1 — S1-S5 — route: read-only exploration — done — evidence: target layout currently selects panels through `layouts/javijec.json`; target has no `gentle-herdr-sidebar`; upstream mod README documents separate bridge enablement and layout wiring.
- T2 — S5-S6 — route: port bridge/data modules and tests — done — evidence: separate Pi bridge and Herdr mod are present; snapshot matching rejects malformed/stale/wrong-pane data; deterministic model, snapshot, TODO/jobs, Agent-history-unavailable, and Git changes tests pass.
- T3 — S3-S4,S6 — route: integrate mod and add it to javijec panel selector — done — evidence: Gentle Shell selector and `gentle-herdr-sidebar` stack block coexist with the existing panels and sidebar; layout JSON wiring check passed.
- T4 — S6 — route: focused tests, docs, and package verification — done — evidence: focused `npm test` 7/7; `herdr-app check mods/gentle-herdr-sidebar`, syntax checks, layout wiring validation, and `git diff --check` pass. Broader suite failures are recorded in L9 and explicitly left unresolved by the user's scope decision.
- T5 — unrelated usage-limits suite repair — dropped — reason: user explicitly chose “Dejar esos fallos documentados”; no unrelated usage-limits code or tests changed.

## Log
- L1 — User request verbatim: “quiero integrar todo lo que hicimos en mi tema javijec”
- L2 — User clarification verbatim: “quiero que lo que hiciste sea un mod mas dentro del tema javijec que ya existe”
- L3 — User target path verbatim: “D:\Programacion\herdr-jec”
- L4 — User placement decision verbatim: “ponelo en seleccionables como files, changes o git graph”
- L5 — Exploration evidence: target branch is `feat/per-machine-collapsible-vitals`; `layouts/javijec.json` panel buttons currently include Files, Changes, Git Graph, PRs, and Issues. Existing `mods/my-better-sidebar/` is distinct and remains in the left sidebar. No `gentle-herdr-sidebar` or source bridge exists in the target.
- L6 — Upstream implementation is in `D:/Programacion/gentle-shell-herdr`; its feature record says S11 feed code was implemented but native committed-candidate review proof remains blocked. Integrate as code without claiming that native review was approved; do not alter the upstream repository.
- L7 — User selected the panel picker/selector as the way to surface the mod; no fixed placement in the left sidebar is requested.
- L8 — S3-S6 implementation is present: mod and separate Pi bridge/data modules ported, existing panels retained, docs and focused tests added. Live Gentle Agents progress and 1:1 parity remain unavailable; no claim that blocked upstream S11 native review approved the candidate. The focused `npm test` passed 7/7; `herdr-app check mods/gentle-herdr-sidebar`, syntax checks, layout wiring validation, and `git diff --check` passed.
- L9 — A bounded diagnostic of `node --test mods/usage-limits/test/helpers.test.js` reproduced four failures in unchanged tests: two Claude helper tests throw `TypeError: Cannot read properties of undefined (reading 'trim')` in test helper `alive`; two Codex session helper tests fail to read their expected session data (exit 1 / empty output). These files are outside the integration diff.
- L10 — User disposition verbatim: “Dejar esos fallos documentados”. Do not expand into repairs of unrelated usage-limits helpers; report that the full repository test suite is not green while keeping the focused integration checks as the verified scope.
