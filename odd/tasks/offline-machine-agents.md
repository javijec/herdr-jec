# Offline machine visibility and agent interactivity
Feature: keep disconnected-machine spaces hidden and their agents visibly unavailable.
Branch: `feat/offline-machine-agents`

## Specs

S1. User request (verbatim): “quieor que cuando una PC esta desconectada se minimice en machines y que no se vean los spaces, y que se pongan en gris sin posibilidad de click en agentes los agentes de esa PC”

## Tasks

- T1 | S1 | inline | status: done | commit: `54582de` — Auto-collapse disconnected machine groups, hide their spaces, and gray/disable agents on those machines; add focused tests.

## Log

L1. quieor que cuando una PC esta desconectada se minimice en machines y que no se vean los spaces, y que se pongan en gris sin posibilidad de click en agentes los agentes de esa PC
L2. Auto-collapse is derived from the current machine state and does not overwrite the saved fold preference; when a machine reconnects, its prior expanded/collapsed preference resumes.
L3. T1 completed in `54582de`. Focused machine sidebar tests pass (11/11); full `npm test` passes (47 passed, 6 skipped); `herdr-app check mods/jec-sidebar` and `git diff --check` pass. Native assess for `master..HEAD` rated the candidate medium and not review-due; no native review was started.
