# AI Restart Prompt

Use this file when handing the project to a new AI/chat session.

---

You are taking over development of:

`MrGMunoz/duplicate-tabs-closer_plus_vivaldi_workspaces`

Upstream:

`Peuj/duplicate-tabs-closer`

Your first actions must be:

1. Read `AGENTS.md` completely.
2. Read `docs/PROJECT_HANDOFF.md` completely.
3. Read `docs/VIVALDI_WORKSPACE_BRIDGE.md` completely.
4. Read this file completely.
5. Inspect `feature/vivaldi-workspace-scope` and compare it with `master`.
6. Treat repository docs + actual branch state as source of truth; do not ask the maintainer to reconstruct prior prompts.

Project goal: add `VW` = **Active Vivaldi Workspace** to Duplicate Tabs Closer while preserving existing matching and keep/close behavior.

Critical safety requirement: **FAIL CLOSED**. Under `VW`, any missing, malformed, ambiguous, timed-out, inconsistent, changed, or unexpected Workspace metadata must result in zero closes. Never fall back to Active Window, Current Window, All Windows, `windowId`, `groupId`, tab order, visibility, or heuristics.

The maintainer is not a programmer. This is AI-assisted/vibe-coded development. Human actions must use the exact manual-action format defined in `AGENTS.md` and must be click-by-click.

## Current checkpoint

Current branch:

`feature/vivaldi-workspace-scope`

`master` must remain untouched unless the maintainer explicitly approves a later merge.

Stable fork extension ID:

`jkhljmjemfaeoklndkcnehbcnmfjcfam`

Stage status:

- ETAPA 0: complete
- ETAPA 1: complete
- ETAPA 2: complete
- ETAPA 3: complete enough for runtime validation
- ETAPA 4A: passed
- ETAPA 4B: passed
- ETAPA 5A: passed
- ETAPA 5B: passed
- ETAPA 5C: passed
- ETAPA 5D: passed
- ETAPA 5E: passed
- ETAPA 5F: passed — missing Bridge produced explicit `VW-BRIDGE-UNREACHABLE`, zero closes, no fallback, and normal recovery after restoring the Bridge
- ETAPA 5G: passed — live Workspace switching and a real A -> B -> A tab movement followed exact Workspace membership, with correct 2/1/3/2 counts, no Bridge warning, no fallback, and zero closes
- ETAPA 5H-A: passed — deterministic stale-membership race produced `VW-TAB-MOVED-WORKSPACE` and zero DTC closes
- ETAPA 5H-B: passed — deterministic active-Workspace race produced `VW-WORKSPACE-CHANGED` and zero DTC closes
- ETAPA 5I: passed — pre-existing `Active Window` saw all 4 matching tabs across A+B in one Vivaldi window, closed normally to 1 total, and returning to `VW` restored 2/2 isolation
- ETAPA 5J: passed — pre-existing `All Windows` saw 5 matching tabs across two real Vivaldi windows from either window, one manual close left 1 total, no unrelated tab closed, and returning to `VW` restored A=2 / B=2

The originally targeted custom-Workspace/manual-close use case is now covered by real runtime validation. ETAPA 5 is still not globally complete: remaining items are broader hardening and compatibility coverage.

Do not enable automatic close unless deliberately continuing the hardening plan; that path has not yet been runtime-validated under `VW`.

## Architecture

A normal Chromium extension in Vivaldi 8.1 cannot safely read Workspace metadata. The implemented architecture is:

`fork extension -> read-only Vivaldi UI Bridge -> Vivaldi internal Workspace metadata`

Vivaldi UI runtime ID:

`mpognobbkildjkofajifpdfhcoklimli`

The Bridge must remain read-only and may answer only the stable fork extension ID.

## ETAPA 5 compatibility fixes already committed

First runtime issue: valid Vivaldi tabs can have parsed `vivExtData` with no `workspaceId`, representing the default/non-custom Workspace.

Fix:

`d2d509ea7e416d78592b539ae8a81566cf34a355` — `Handle Vivaldi default workspace tabs in bridge`

This introduced reserved sentinel:

`__dtc_vivaldi_default_workspace__`

Only valid parsed `vivExtData` with absent/null `workspaceId` maps to the sentinel. Missing/malformed metadata still fails closed. Sentinel collision and broad API-regression safeguards are present.

Second runtime issue: `vivaldi.prefs.get("vivaldi.workspaces.list")` can return a wrapper whose `.value` property is the actual Workspace array.

Fix:

`60a2333e59efea4f2865b46dbb60adade862bc47` — `Handle wrapped Vivaldi workspace preferences`

The Bridge accepts only a direct array or an object with an own `.value` array; every other shape fails closed.

## Primary runtime test

Test URL:

`https://example.com/?dtc-vw-scope-test=20260824`

Observed custom Workspace IDs during diagnosis:

- A: `1786421728088`
- B: `1787604210876`

These are evidence only; never hard-code them.

## Passed ETAPA 5 results

### 5A — observation-only isolation

Layout: 3 identical tabs in A, 1 identical tab in B, A active, `Scope = VW`, `On duplicate tab detected = Do nothing`.

Result: DTC detected exactly 3 in A; B remained excluded/open; no Bridge warning.

### 5B — `Close duplicates`

With 3 in A and 1 in B, `Close duplicates` once left exactly 1 in A; B remained open; no warning.

### 5C — row X

With 2 in A and 1 in B, pressing exactly one A row X left 1 in A; B remained open; no warning.

### 5D — grouped/group-header X

With 2 in A and 1 in B, grouped view showed one group of 2. Pressing the group-header X closed both A tabs; B remained open; no warning.

### 5E — pinned-tab priority

With 2 identical tabs in A, exactly one pinned, `Keep pinned tab` enabled, and matching B tab present, `Close duplicates` once left exactly the pinned A tab; B remained open; no warning.

### 5F — missing Bridge fail-closed

Before disabling the Bridge, A contained 2 matching test tabs and DTC detected exactly 2; B contained 1 matching tab.

The installed Bridge file was temporarily renamed to `dtc-vivaldi-workspace-bridge.js.disabled` while Vivaldi was fully closed. `window.html` was not modified.

After restarting with the Bridge unavailable:

- both A tabs remained open
- the B tab remained open
- DTC showed `Vivaldi Workspace error: VW-BRIDGE-UNREACHABLE.`
- there was no silent fallback to another Scope
- zero tabs were closed

After fully closing Vivaldi, restoring the exact `.js` filename, and restarting:

- A again detected exactly 2
- the Bridge error was gone

This is a real-runtime pass for the critical unavailable-Bridge fail-closed path.

### 5G — live Workspace switching + tab movement

After the post-5F Vivaldi restart, the maintainer confirmed the Bridge was healthy, `Scope = Active Vivaldi Workspace`, `On duplicate tab detected = Do nothing`, A contained two identical test tabs detected as 2, and B contained one matching tab.

One matching tab was added to B so A and B each contained exactly 2. Repeated switching A/B/A continued to show exactly 2 in the active Workspace.

The maintainer then moved exactly one test tab from A to B using Vivaldi's native Workspace UI, without invoking any DTC close action.

Observed result:

- A dropped to exactly 1 test tab and no duplicate group of 2
- B rose to exactly 3 test tabs and DTC detected exactly 3
- no Bridge warning appeared
- zero tabs were closed

The same moved tab was returned from B to A.

Final result:

- A returned to exactly 2 and DTC detected exactly 2
- B returned to exactly 2 and DTC detected exactly 2
- no Bridge warning appeared
- zero tabs were closed
- no silent fallback or cross-Workspace contamination was observed

This is a real-runtime pass showing that the `VW` filter follows both active Workspace switching and live tab membership changes end-to-end through the Bridge.

### 5H-A — stale tab membership during guarded close

Starting from A=2 and B=2 with `Scope = Active Vivaldi Workspace` and `On duplicate tab detected = Do nothing`, the maintainer placed a DevTools breakpoint inside `closePanelTabs` immediately before `revalidateActiveVivaldiWorkspaceTabs`.

A grouped close was initiated while Workspace A was active. Execution paused at the expected breakpoint after the initial Workspace decision but before final revalidation/removal. While paused, exactly one A test tab was moved to B using Vivaldi's normal Workspace UI without changing the active Workspace. Execution was then resumed.

Observed result:

- diagnostic: `VW-TAB-MOVED-WORKSPACE`
- DTC closed zero tabs for the affected operation
- the only membership change was the maintainer's manual move, leaving A=1 and B=3
- no extra tab disappeared after resume
- the moved tab was returned manually and the clean A=2 / B=2 state was restored

This is a deterministic real-runtime pass of the stale-membership fail-closed branch between the initial Workspace snapshot and the final pre-close revalidation.

### 5H-B — active Workspace changed during guarded close

Starting from the restored A=2 / B=2 layout with `Scope = Active Vivaldi Workspace`, `On duplicate tab detected = Do nothing`, and Workspace A active, the maintainer reused the same breakpoint in `closePanelTabs` immediately before `revalidateActiveVivaldiWorkspaceTabs`.

A grouped close was initiated in A and execution paused at the expected point. While paused, no tab was moved; only the active Workspace was changed from A to B. Execution was then resumed.

Observed result:

- diagnostic: `VW-WORKSPACE-CHANGED`
- DTC closed zero tabs for the affected operation
- Workspace A remained at 2 test tabs
- Workspace B remained at 2 test tabs
- no fallback or cross-Workspace close occurred

Together, 5H-A and 5H-B deterministically validate both stale-state branches of the final pre-close revalidation guard.

### 5I — `Active Window` non-VW regression

Starting from A=2 / B=2 in the same Vivaldi browser window and keeping `On duplicate tab detected = Do nothing`, the maintainer changed only Scope from `Active Vivaldi Workspace` to the pre-existing `Active Window` scope.

Observed result:

- from Workspace A, DTC detected exactly 4 matching tabs across A+B
- from Workspace B, DTC still detected exactly 4
- no Vivaldi Workspace gating error appeared
- `Close duplicates` exactly once left exactly 1 matching test tab total across A+B
- the A=2 / B=2 disposable layout was recreated
- returning to `Active Vivaldi Workspace` restored exactly 2 detected in A and 2 in B, with no Bridge error

This is a real-runtime pass showing the legacy Active Window scope is not accidentally filtered or guarded by `VW`.

### 5J — `All Windows` non-VW regression + real multi-window enumeration

Starting from the restored A=2 / B=2 layout in the original Vivaldi window, the maintainer opened a second normal Vivaldi window containing exactly one matching test tab and changed Scope to the pre-existing `All Windows` scope while keeping `On duplicate tab detected = Do nothing`.

Observed result:

- DTC detected exactly 5 matching test tabs from the original window
- DTC detected exactly 5 matching test tabs from the second window
- no Vivaldi Workspace gating error appeared
- `Close duplicates` exactly once left exactly 1 matching test tab total across both browser windows
- no unrelated tab was closed
- the temporary second window was removed
- the original A=2 / B=2 layout was restored
- returning to `Active Vivaldi Workspace` restored exactly 2 detected in A and 2 in B

This validates the legacy `All Windows` path across two real Vivaldi browser windows and confirms that it remains separate from `VW` filtering/guarding.

## Post-5J checkpoint — remaining hardening

The originally targeted use case — custom Vivaldi Workspaces, exact active-Workspace isolation, observation/manual review, guarded manual closes, and fail-closed behavior if Workspace state becomes unsafe — has passed substantial real-runtime coverage.

There are **11 remaining validation themes** if pursuing a broad hardening matrix rather than stopping at the original-use checkpoint. They are not all equally important and some can be combined into fewer test sessions:

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

If the maintainer's intended usage includes automatic close, the automatic-close theme remains essential before treating that mode as validated. If usage remains `Do nothing` plus manual closes in custom Workspaces, no additional test is required merely to establish that already-tested personal-use path.

Do not claim ETAPA 5 globally complete or release-ready solely from this checkpoint.

## Safety / approval gates

Do not merge, release, publish, open an upstream PR, force-push, delete remote branches, change/create tags, perform an official version bump, add a major dependency, or make another major architecture change without explicit maintainer approval.

When a Workspace-related error occurs, preserve fail-closed behavior and provide a short copyable diagnostic JSON without browsing URLs/history.

Continue from the repository state actually observed, not assumptions in this prompt.

---
