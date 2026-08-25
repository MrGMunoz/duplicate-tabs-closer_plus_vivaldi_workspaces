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
- ETAPA 5F — missing Bridge fail-closed validation: passed
- ETAPA 5G — live Workspace switching and tab movement in observation-only mode: passed
- ETAPA 5H-A — stale tab-membership during guarded close: passed
- ETAPA 5H-B — active-Workspace change during guarded close: passed
- ETAPA 5I — pre-existing `Active Window` non-VW scope regression: passed
- ETAPA 5J — pre-existing `All Windows` non-VW scope regression across two real Vivaldi windows: passed

Current stage:

- ETAPA 5 — real runtime validation: in progress, but the originally targeted custom-Workspace/manual-close use case now has substantial real-runtime coverage.
- Remaining ETAPA 5 work is broader hardening/generalization. There are 11 remaining validation themes in the current matrix; they are not all required for the already-covered manual custom-Workspace use case.
- Automatic close has not yet been runtime-validated under `VW` and must not be treated as validated.

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

### ETAPA 5F — missing Bridge / fail-closed: PASSED

The installed Bridge was first confirmed working with two identical tabs in Workspace A and one matching tab in Workspace B. `Scope = VW` and `On duplicate tab detected = Do nothing` remained selected.

The maintainer then fully closed Vivaldi, temporarily renamed the installed Bridge from:

`dtc-vivaldi-workspace-bridge.js`

to:

`dtc-vivaldi-workspace-bridge.js.disabled`

without modifying `window.html`, and restarted Vivaldi.

Observed result while the Bridge was unavailable:

- before disabling the Bridge, Workspace A: DTC detected exactly 2
- Workspace A: both test tabs remained open
- Workspace B: matching test tab remained open
- explicit error shown: `Vivaldi Workspace error: VW-BRIDGE-UNREACHABLE.`
- no silent fallback to another Scope was observed
- zero tabs were closed

After fully closing Vivaldi, restoring the exact `.js` filename, and restarting:

- `Active Vivaldi Workspace` became available normally again
- Workspace A again detected exactly 2
- no Bridge error remained

This validates the critical missing-Bridge fail-closed path in the tested runtime: an unreachable Bridge produced a visible diagnostic and **zero closes**, then recovered cleanly after restoration.

### ETAPA 5G — Workspace switching + tab movement: PASSED

After the normal Vivaldi restart following ETAPA 5F, the maintainer first confirmed the restored runtime state was healthy: the Bridge was available, `Scope = Active Vivaldi Workspace`, `On duplicate tab detected = Do nothing`, no Bridge error was shown, Workspace A had two identical test tabs detected as 2, and Workspace B had one matching test tab.

The maintainer then added one matching test tab to Workspace B so A and B each contained exactly two. Repeated switching between A and B continued to show exactly two duplicates in whichever Workspace was active.

One test tab was then moved from Workspace A to Workspace B using Vivaldi's native Workspace UI, without invoking any DTC close action.

Observed result after A -> B movement:

- Workspace A contained exactly 1 test tab and no duplicate group of 2 for the test URL
- Workspace B contained exactly 3 test tabs and DTC detected exactly 3
- no Bridge error or warning appeared
- zero tabs were closed

The same moved tab was then returned from Workspace B to Workspace A.

Observed result after B -> A movement:

- Workspace A returned to exactly 2 test tabs and DTC detected exactly 2
- Workspace B returned to exactly 2 test tabs and DTC detected exactly 2
- no Bridge error or warning appeared
- zero tabs were closed
- no silent fallback or cross-Workspace contamination was observed

This validates that the runtime `VW` filter follows both live active-Workspace switching and real tab membership changes end-to-end through the Bridge in the tested observation-only case.

### ETAPA 5H-A — stale tab membership during guarded close: PASSED

Starting from the clean post-5G layout with two identical test tabs in Workspace A and two in Workspace B, `Scope = Active Vivaldi Workspace`, and `On duplicate tab detected = Do nothing`, the maintainer used a DevTools breakpoint in `closePanelTabs` immediately before `revalidateActiveVivaldiWorkspaceTabs`.

A grouped close was initiated in Workspace A and execution stopped at the expected breakpoint after the initial Workspace decision but before the final revalidation/removal. While execution remained paused and Workspace A stayed active, exactly one of the two A test tabs was moved to Workspace B using Vivaldi's native Workspace UI. Execution was then resumed.

Observed result:

- the revalidation detected that a required tab no longer belonged to the originally validated Workspace
- the fail-closed diagnostic was `VW-TAB-MOVED-WORKSPACE`
- DTC performed zero tab closes for the affected operation
- after the manual A -> B movement, A remained at 1 test tab and B at 3; no additional tab disappeared
- the moved tab was returned manually to A and the clean A=2 / B=2 layout was restored

This is a deterministic real-runtime pass for the stale-membership branch of the pre-close guard. It specifically verifies that a tab membership change between the initial Workspace decision and the final close revalidation aborts the entire close instead of acting on stale membership.

### ETAPA 5H-B — active Workspace changed during guarded close: PASSED

Starting from the restored A=2 / B=2 layout with `Scope = Active Vivaldi Workspace`, `On duplicate tab detected = Do nothing`, and Workspace A active, the maintainer reused the deterministic DevTools breakpoint in `closePanelTabs` immediately before `revalidateActiveVivaldiWorkspaceTabs`.

A grouped close was initiated in Workspace A and execution paused at the expected breakpoint after the initial Workspace decision but before the final revalidation/removal. While paused, no tab was moved; the maintainer changed only the active Vivaldi Workspace from A to B and then resumed execution.

Observed result:

- the fresh revalidation detected that the active Workspace no longer matched the stored Workspace guard
- the fail-closed diagnostic was `VW-WORKSPACE-CHANGED`
- DTC performed zero tab closes for the affected operation
- no tab membership changed: Workspace A remained at 2 test tabs and Workspace B remained at 2
- no fallback to another scope or heuristic was observed

Together, ETAPA 5H-A and 5H-B deterministically validate both stale-membership branches required by the pre-close guard: tab movement and active-Workspace change both abort before `chrome.tabs.remove`.

### ETAPA 5I — `Active Window` non-VW regression: PASSED

Starting from A=2 / B=2 in the same Vivaldi browser window with `On duplicate tab detected = Do nothing`, the maintainer changed only Scope from `Active Vivaldi Workspace` to the pre-existing `Active Window` scope.

Observed result:

- from Workspace A, DTC detected exactly 4 matching test tabs across A and B
- after switching to Workspace B, DTC still detected exactly 4
- no Vivaldi Workspace error was shown while using the non-VW scope
- pressing `Close duplicates` exactly once left exactly 1 matching test tab in the whole Vivaldi window across A+B
- the disposable layout was restored to A=2 / B=2
- after returning Scope to `Active Vivaldi Workspace`, DTC again detected exactly 2 in A and exactly 2 in B, with no Bridge error

This validates that the legacy `Active Window` path remains upstream-compatible in Vivaldi: it deliberately sees across Workspaces that share the same Chromium window, closes normally without the `VW` guard, and switching back to `VW` restores exact Workspace isolation.

### ETAPA 5J — `All Windows` non-VW regression + real multi-window enumeration: PASSED

Starting from the restored A=2 / B=2 layout in the original Vivaldi window, the maintainer opened a second normal Vivaldi window with exactly one matching test tab, then changed Scope to the pre-existing `All Windows` scope while keeping `On duplicate tab detected = Do nothing`.

Observed result:

- from the original Vivaldi window, DTC detected exactly 5 matching test tabs across both browser windows
- from the second Vivaldi window, DTC also detected exactly 5
- no Vivaldi Workspace gating error appeared
- pressing `Close duplicates` exactly once left exactly 1 matching test tab total across both browser windows
- no unrelated tab was closed
- the temporary second window was closed after validation
- the original disposable layout was restored to A=2 / B=2
- returning Scope to `Active Vivaldi Workspace` again produced exactly 2 detected in A and exactly 2 in B, with no Bridge error

This validates upstream `All Windows` behavior across two real Vivaldi browser windows and confirms that non-VW multi-window enumeration/closing remains separate from the Workspace filter and its fail-closed guard.

## Post-5J checkpoint — original use covered, broader hardening remains

The originally targeted use case — exact isolation to the active custom Vivaldi Workspace, observation/manual review, guarded manual close actions, preservation of upstream matching/priorities, and fail-closed behavior when Workspace state becomes unsafe — has passed substantial real-runtime testing.

If development stops at this checkpoint, do **not** describe ETAPA 5 as globally complete or the fork as release-ready. Describe it instead as a validated personal-use/manual-workflow checkpoint with broader hardening still open.

There are **11 remaining validation themes** in the current broader matrix:

- active tab behavior
- different URL on same domain
- HTTPS/age priorities
- discarded/hibernated tabs
- Vivaldi tab stacks/groups
- broader multiple-Workspace / multiple-window behavior specifically under `VW`
- incognito, if applicable
- startup/session restore/lazy loading
- Vivaldi internal pages
- default/non-custom Workspace runtime behavior
- automatic-close path

These are not all equally important and several can be combined into fewer test sessions. For the already-tested usage pattern (`Scope = Active Vivaldi Workspace`, `On duplicate tab detected = Do nothing`, manual review/manual closes in custom Workspaces), none of these remaining themes is required merely to prove the original use case again.

If the intended usage includes `Close tab automatically`, the automatic-close theme remains essential before that mode is treated as validated.

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

- active tab behavior
- different URL on same domain
- HTTPS/age priorities
- discarded/hibernated tabs
- Vivaldi tab stacks/groups
- broader multiple-Workspace / multiple-window `VW` edge cases
- incognito where applicable
- startup/session restore/lazy loading
- Vivaldi internal pages
- default/non-custom Workspace runtime behavior
- automatic-close path

Already validated substantially:

- same URL cross-Workspace isolation
- manual `Close duplicates`
- direct row close
- grouped close
- pinned priority
- missing/unavailable Bridge -> explicit error and zero closes
- live Workspace switching
- moving tabs between Workspaces in observation-only mode
- stale tab membership during a guarded close -> `VW-TAB-MOVED-WORKSPACE` and zero DTC closes
- active Workspace change during a guarded close -> `VW-WORKSPACE-CHANGED` and zero DTC closes
- pre-existing `Active Window` behavior across Workspaces in one Vivaldi window, including a normal manual close
- pre-existing `All Windows` behavior across two real Vivaldi windows, including a normal manual close and no unrelated-tab close

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
