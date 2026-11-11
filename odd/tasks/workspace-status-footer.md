# Workspace status footer
Feature: move the command shortcut and model/context telemetry into the workspace footer.
Branch: `feat/workspace-status-footer`

## Specs

S1. User request (verbatim): “quiero que lo de comando con la convinacion de teclas pase al lado de settings, y lo del modelo contest pase a estr en el fotter donde dice javijec main y el comands”

S2. User selection (verbatim): “Reemplazar máquina y rama” — footer placement replaces machine and branch while preserving the agent count and usage-limits area.

## Tasks

- T1 | S1 | inline | move the command shortcut beside Settings; commit `8db6f56`
- T2 | S1-S2 | inline | move validated Model / Effort and Context into the workspace footer, remove them from Status, preserve agents and usage limits; commit pending

## Log

L1. quiero que lo de comando con la convinacion de teclas pase al lado de settings, y lo del modelo contest pase a estr en el fotter donde dice javijec main y el comands
L2. Reemplazar máquina y rama
L3. T1 completed: moved the existing palette shortcut into the Settings footer row, kept its keybinding-derived label and palette action, and removed it from workspace-status. Focused tests and `herdr-app check` for both mods passed; commit `8db6f56`.
