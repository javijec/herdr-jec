# Per-machine collapsible vitals
Feature: show CPU/memory metrics beneath each machine in the Machines list.
Branch: `feat/per-machine-collapsible-vitals`

## Specs

S1. User request: “quisiera que los vitals esten integrados en el machines, que tengan un bortoncito que les permita colapsarlos”; copy correction: “elimina la palabra vitals”; spacing correction: “tira toda la linea hacia la izquierda y que porque tiene mucho gap”; fold correction: “elimina el ocultar de vitals”; bottom spacing correction: “dale un poco mas de espacio abajo de vitals”

S2. User clarification: “perdon debajo de cada maquina”

S3. User authorization: “Medir todas las visibles” — “Extender las consultas de CPU/memoria a cada máquina listada en Machines.”

## Tasks

- T1 | S1-S3 | inline | commits `9f139f1` (`feat(sidebar): integrate per-machine collapsible vitals`), `28bb6ea` (`style(sidebar): remove Vitals label`), `64e805f` (`style(sidebar): reduce metrics indentation`), `fcb5fe3` (`feat(sidebar): remove per-metrics fold control`), `7063563` (`style(sidebar): add space below metrics`)

## Log

L1. quisiera que los vitals esten integrados en el machines, que tengan un bortoncito que les permita colapsarlos
L2. perdon debajo de cada maquina
L3. Medir todas las visibles — Extender las consultas de CPU/memoria a cada máquina listada en Machines.
L4. Cross-mod imports were rejected by `herdr-app check`; the implementation keeps the integrated metrics component inside `my-better-sidebar` and leaves `my-machine-vitals` standalone.
L5. `node --check`, both mod checks, layout JSON validation, `git diff --check`, and independent verification passed. The installed sidebar files and layout were hash-checked, and switching to `javijec` succeeded. Live rendering and remote sampling were not visually/runtime-observed.
L6. elimina la palabra vitals
L7. Follow-up verification: `node --check` and `herdr-app check mods/my-better-sidebar` passed; the installed view hash matches the source and switching `javijec` succeeded. No live visual interaction was observed.
L8. tira toda la linea hacia la izquierda y que porque tiene mucho gap
L9. Reduced the expanded metrics inset from 28 px to 12 px in both the machine row and metric rows. Syntax and mod checks passed; installed hashes matched and switching `javijec` succeeded. Live visual alignment was not observed.
L10. elimina el ocultar de vitals
L11. The user selected “Quitar el plegado”; remove the per-metrics toggle while retaining the metrics and the existing machine-group fold control.
L12. Removed the per-metrics toggle and obsolete fold-state reads/writes; syntax, sidebar mod check, and diff checks passed. The installed view hash matches source and switching `javijec` succeeded. Live UI interaction was not observed.
L13. dale un poco mas de espacio abajo de vitals
L14. Increased the metrics block's bottom padding from 3 to 7 px. Syntax and sidebar mod checks passed; the installed view hash matches and switching `javijec` succeeded. No live visual check was performed.
