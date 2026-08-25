# Project Handoff

## Current status

Project: add **Active Vivaldi Workspace** scope (`VW`) to Duplicate Tabs Closer.

Current development branch: `feature/vivaldi-workspace-scope`.

`master` must remain untouched unless the maintainer explicitly approves a later merge.

Completed stages:

- ETAPA 0 — preparation and fork verification: complete
- ETAPA 1 — read-only audit and feasibility study: complete
- ETAPA 2 — architecture research/design: complete
- ETAPA 3 — implementation/review pass: complete enough for browser validation
- ETAPA 4A — Chromium build + unpacked fork load in Vivaldi: confirmed complete
- ETAPA 4B — persistent Vivaldi Workspace Bridge installation: confirmed complete
- ETAPA 5A — observation-only Workspace isolation: passed
- ETAPA 5B — controlled manual `Close duplicates` under `VW`: passed
- ETAPA 5C — controlled direct-row X close under `VW`: passed
- ETAPA 5D — controlled grouped-row/group-header X close under `VW`: passed
- ETAPA 5E — pinned-tab priority under `VW`: passed

Current stage:

- ETAPA 5 — real runtime validation: in progress
- Next: ETAPA 5F — deliberately make the Vivaldi UI Bridge unavailable and confirm fail-closed behavior with zero closes, then restore the Bridge.

Do not merge, release, publish, open an upstream PR, force-push, delete branches/tags, perform an official version bump, add a major dependency, or make another major architecture change without explicit maintainer approval.

## Repository relationship

Upstream: `Peuj/duplicate-tabs-closer`

Fork: `MrGMunoz/duplicate-tabs-closer_plus_vivaldi_workspaces`

Fork/master base commit:

`214a60a3a6d587ae7a78a13a7911d08366e7c963`

Development branch:

`feature/vivaldi-workspace-scope`

Stable fork extension ID:

`jkhljmjemfaeoklndkcnehbcnmfjcfam`

The manifest contains only the public key material needed to derive this stable ID. Never request or commit a corresponding private key.

## Architecture

A normal Chromium extension running in Vivaldi cannot directly read Workspace metadata. Runtime research in Vivaldi 8.1.4087.70 / Chromium 150.0.7871.253 confirmed that the normal extension context does not expose usable `vivaldi.prefs`, `vivaldi.tabsPrivate`, `tab.vivExtData`, or another safe Workspace field.

The selected architecture is therefore:

`Duplicate Tabs Closer fork -> read-only Vivaldi UI Bridge -> Vivaldi internal Workspace metadata`

The Vivaldi UI runtime ID is:

`mpognobbkildjkofajifpdfhcoklimli`

The Bridge is deliberately read-only. It must never close, move, activate, edit, or otherwise mutate tabs. It accepts requests only from the stable fork extension ID above.

## Non-negotiable safety model

**FAIL CLOSED.**

Under `VW`, any error, ambiguity, timeout, malformed/inconsistent metadata, unexpected response, missing Bridge, Workspace change, tab movement between Workspaces, protocol mismatch, or validation failure must result in **zero tabs closed**.

Never silently fall back to:

- Active Window / Current Window
- All Windows
- `windowId`
- `groupId`
- tab order
- visibility
- any Workspace heuristic

When `VW` is selected:

1. Query normal candidate tabs.
2. Ask the Bridge for exact Workspace metadata.
3. Validate protocol, request ID, window ID, active tab, active Workspace, tab IDs, counts, and Workspace IDs.
4. Filter candidates to the exact active Workspace.
5. Run existing Duplicate Tabs Closer matching and keep/close priority logic unchanged.
6. Immediately before a close, query/revalidate Workspace metadata again.
7. If Workspace or tab membership changed, abort the close.

Popup/options direct row and group closes are also guarded. Under `VW`, those UI close requests route to an internal background path and revalidate Workspace membership before `chrome.tabs.remove`.

## Vivaldi Bridge compatibility fixes discovered during ETAPA 5A

### Default/non-custom Workspace representation

Real Vivaldi runtime inspection found a valid discarded internal tab with parsed `vivExtData` but no `workspaceId`. Vivaldi can represent the default/non-custom Workspace by omitting `workspaceId`.

Fix commit:

`d2d509ea7e416d78592b539ae8a81566cf34a355` — `Handle Vivaldi default workspace tabs in bridge`

The Bridge now maps only valid parsed `vivExtData` with an absent/null `workspaceId` to the reserved sentinel:

`__dtc_vivaldi_default_workspace__`

Missing or malformed `vivExtData` remains a hard failure. The Bridge rejects sentinel collisions and requires custom-Workspace evidence when a sentinel is present, preventing a broad API regression from silently collapsing every tab into the default Workspace.

### Wrapped `vivaldi.prefs.get` value

Real runtime probing showed `vivaldi.prefs.get("vivaldi.workspaces.list")` can return a thenable/callback wrapper object with keys such as `defaultValue`, `store`, and `value`; the Workspace array is in `.value`.

Fix commit:

`60a2333e59efea4f2865b46dbb60adade862bc47` — `Handle wrapped Vivaldi workspace preferences`

The Bridge accepts only:

- a direct array, or
- an object with an own `.value` property that is an array

Every other shape returns `null` and fails closed. Existing per-Workspace ID validation remains unchanged.

## ETAPA 4 confirmed runtime setup

Confirmed by the maintainer:

- Chromium build succeeded
- unpacked fork loaded successfully in Vivaldi
- stable extension ID is exactly `jkhljmjemfaeoklndkcnehbcnmfjcfam`
- original Duplicate Tabs Closer extension was disabled, not removed
- persistent Bridge installed in Vivaldi UI resources
- Vivaldi starts normally with Bridge installed
- `Active Vivaldi Workspace` appears as a Scope option
- `VW` can be selected
- tests have been kept on `On duplicate tab detected = Do nothing`

Persistent Bridge installation location uses the current Vivaldi installation's:

`resources\vivaldi\dtc-mods\dtc-vivaldi-workspace-bridge.js`

`window.html` contains the script reference installed during ETAPA 4B. Vivaldi updates may overwrite the UI modification and require reinstalling it.

## ETAPA 5 runtime test URL and Workspaces

Primary test URL:

`https://example.com/?dtc-vw-scope-test=20260824`

Observed custom Workspace IDs during the original runtime diagnosis:

- Workspace A: `1786421728088`
- Workspace B: `1787604210876`

These IDs are runtime evidence only; code must never hard-code them.

## ETAPA 5 validated results

### ETAPA 5A — observation-only isolation: PASSED

After installing the Bridge version containing commit `60a2333e59efea4f2865b46dbb60adade862bc47` and fully restarting Vivaldi:

- Workspace A contained 3 identical test tabs
- Workspace B contained 1 identical test tab
- active Workspace A
- `Scope = Active Vivaldi Workspace`
- `On duplicate tab detected = Do nothing`

Result:

- DTC detected exactly 3 in Workspace A
- Workspace B tab remained excluded/open
- no Bridge error or warning

### ETAPA 5B — `Close duplicates`: PASSED

Using the same A/B layout and `Do nothing`, the maintainer pressed `Close duplicates` exactly once in Workspace A.

Result:

- before close: 3 detected in A
- after close: exactly 1 test tab remained in A
- B test tab remained open
- no Bridge error or warning

### ETAPA 5C — direct row X: PASSED

Prepared 2 identical tabs in A and kept the matching B tab.

Result after pressing exactly one row X:

- before close: 2 detected in A
- after close: exactly 1 remained in A
- B tab remained open
- no Bridge error or warning

This validates the guarded direct-row close path for the tested runtime case.

### ETAPA 5D — grouped close: PASSED

Prepared 2 identical tabs in A and kept the matching B tab. Enabled the popup grouped view, which showed one group of 2, then pressed the group-header X exactly once.

Result:

- before grouping/close: 2 detected in A
- grouped view: one group of 2
- after group-header close: 0 test tabs remained in A
- B tab remained open
- no Bridge error or warning

This validates the guarded grouped-row close path for the tested runtime case.

### ETAPA 5E — pinned-tab priority: PASSED

Prepared 2 identical tabs in A and kept the matching B tab. Exactly one A tab was pinned. `Keep pinned tab` was enabled, `Scope = VW`, and `On duplicate tab detected = Do nothing`.

Result after pressing `Close duplicates` exactly once:

- before close: 2 detected in A
- after close: exactly 1 remained in A
- the retained A tab was the pinned tab
- B tab remained open
- no Bridge error or warning

This confirms the upstream pinned-tab priority remains effective after Workspace filtering in the tested runtime case.

## Exact next action — ETAPA 5F

Test the most important fail-closed condition with the Bridge intentionally unavailable.

High-level procedure:

1. Preserve the current installed Bridge file; do not delete it.
2. Fully close Vivaldi.
3. Temporarily rename `resources\vivaldi\dtc-mods\dtc-vivaldi-workspace-bridge.js` so the script path referenced by `window.html` cannot load it.
4. Reopen Vivaldi.
5. Keep the stored scope as `VW` if possible and keep `On duplicate tab detected = Do nothing`.
6. Prepare duplicate test tabs if necessary, but do not close any manually outside the extension.
7. Confirm the VW UI reports the Bridge unavailable/error state and that no extension close operation can close tabs.
8. If a `Copy diagnostics` control is present, copy the sanitized diagnostic.
9. Fully close Vivaldi again.
10. Restore the Bridge file to the exact original filename.
11. Reopen Vivaldi and confirm `VW` becomes available again with no warning.

Expected fail-closed result while Bridge is unavailable: **zero tabs closed**.

Do not edit `window.html` for this test. Do not delete the Bridge file. Do not enable automatic close.

## Diagnostics

Workspace failures are stored in `chrome.storage.session` under a sanitized diagnostic object and logged as `DTC-VW-DIAGNOSTIC`. Diagnostics must not contain browsing URLs/history.

Representative codes include:

- `VW-BRIDGE-TIMEOUT`
- `VW-BRIDGE-UNREACHABLE`
- `VW-BRIDGE-EXCEPTION`
- `VW-BRIDGE-REJECTED`
- `VW-PROTOCOL-MISMATCH`
- `VW-WINDOW-MISMATCH`
- `VW-ACTIVE-WORKSPACE-INVALID`
- `VW-TAB-WORKSPACE-INVALID`
- `VW-REQUIRED-TAB-OUTSIDE-ACTIVE-WORKSPACE`
- `VW-WORKSPACE-CHANGED`
- `VW-TAB-MOVED-WORKSPACE`
- `VW-PANEL-TAB-MISSING`
- `VW-PANEL-WINDOW-MISMATCH`
- `VW-PANEL-CLOSE-FAILED`

When `VW` is selected and an error exists, popup/options should show a short fail-closed message and a **Copy diagnostics** control.

## Existing upstream behavior that must remain unchanged

Do not alter unless directly required:

- URL normalization and URL matching
- title matching and title similarity
- URL/title pattern rules
- whitelist behavior
- pinned-tab priority
- HTTPS priority
- age/newer/older priority
- active-window priority for all-windows scopes
- discarded tab URL restoration
- intentional duplicate protections
- startup burst/debounce behavior
- Firefox Containers
- Firefox sessions behavior
- Tree Style Tab integration
- Chrome/Vivaldi event handling unrelated to Workspace scope

## Remaining real-test themes

Still to validate substantially include:

- missing/unavailable Bridge -> zero closes (ETAPA 5F next)
- Workspace switching and tab movement between Workspaces
- close-race / stale membership fail-closed behavior
- active tab behavior
- different URL on same domain
- HTTPS/age priorities
- existing non-VW scopes regression
- discarded/hibernated tabs
- Vivaldi tab stacks/groups
- multiple Workspaces and multiple windows
- incognito where applicable
- startup/session restore/lazy loading
- Vivaldi internal pages
- default/non-custom Workspace runtime behavior
- automatic-close path, only after manual/fail-closed testing is sufficiently strong

## Documentation / maintainer interaction requirement

This fork is explicitly AI-assisted/vibe-coded. The maintainer has limited programming/tooling experience.

Whenever human intervention is required, instructions must use exactly these headings:

## Acción manual necesaria

### Objetivo

### Por qué debo hacerlo yo

### Pasos

### Debes ver

### No hagas esto

### Cuando termines

Instructions must be click-by-click and must not assume Git, GitHub, DevTools, browser-extension, or build knowledge.
