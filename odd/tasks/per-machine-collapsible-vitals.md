# Per-machine collapsible vitals
Feature: integrate machine vitals into the Machines list with per-machine collapse controls.
Branch: `feat/per-machine-collapsible-vitals`

## Specs

S1. User request: “quisiera que los vitals esten integrados en el machines, que tengan un bortoncito que les permita colapsarlos”

S2. User clarification: “perdon debajo de cada maquina”

S3. User authorization: “Medir todas las visibles” — “Extender las consultas de CPU/memoria a cada máquina listada en Machines.”

## Tasks

- T1 | S1-S3 | inline | `feat(sidebar): integrate collapsible per-machine vitals`

## Log

L1. quisiera que los vitals esten integrados en el machines, que tengan un bortoncito que les permita colapsarlos
L2. perdon debajo de cada maquina
L3. Medir todas las visibles — Extender las consultas de CPU/memoria a cada máquina listada en Machines.
L4. Cross-mod imports were rejected by `herdr-app check`; the implementation keeps the integrated metrics component inside `my-better-sidebar` and leaves `my-machine-vitals` standalone.
L5. `node --check`, both mod checks, layout JSON validation, `git diff --check`, and independent verification passed. The installed sidebar files and layout were hash-checked, and switching to `javijec` succeeded. Live rendering and remote sampling were not visually/runtime-observed.
