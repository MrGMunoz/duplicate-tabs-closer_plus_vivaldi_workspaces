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
- ETAPA 5G: next — validate live Workspace switching and tab movement between Workspaces in observation-only mode

Do not enable automatic close yet.

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

These tests validate manual batch close, row close, grouped close, Workspace isolation, pinned priority, and missing-Bridge zero-close behavior for the tested runtime cases.

## Exact next action — ETAPA 5G

Validate live Workspace switching and tab movement between Workspaces in observation-only mode before attempting a deliberate stale/race close test.

Start from the post-5F state:

- Workspace A: 2 identical test tabs
- Workspace B: 1 identical test tab
- Bridge restored and healthy
- `Scope = Active Vivaldi Workspace`
- `On duplicate tab detected = Do nothing`

Procedure concept:

1. Add one more identical test tab in B so A and B each contain exactly 2.
2. Switch between A and B and confirm DTC detects exactly 2 in the currently active Workspace, with no warning.
3. Move exactly one of A's test tabs to B using Vivaldi's native Workspace command.
4. Confirm A now has only one test tab and no duplicate group for the test URL.
5. Confirm B now has three test tabs and DTC detects exactly 3.
6. Move that same tab back to A.
7. Confirm A returns to exactly 2 detected and B returns to exactly 2 detected.
8. Do not close duplicates, rows, or groups during this test.

Expected result: the `VW` filter follows real Vivaldi Workspace membership immediately and exactly, with no cross-Workspace contamination, no fallback, no Bridge error, and zero closes.

If 5G fails, stop before any race/close test and inspect the mismatch first.

After 5G passes, the next high-risk theme should be a deliberate stale-membership / close-race test targeting the existing `VW-WORKSPACE-CHANGED` / `VW-TAB-MOVED-WORKSPACE` revalidation paths. Do not improvise auto-close as the next step.

## Remaining required runtime themes

Still to validate substantially include:

- Workspace switching and tab movement between Workspaces (5G next)
- close-race / stale membership fail-closed behavior
- existing scopes regression
- discarded/hibernated tabs
- multiple Workspaces
- multiple windows
- startup/session restore/lazy loading
- default/non-custom Workspace
- stacks/groups
- active tab
- Vivaldi internal pages
- different URL on same domain
- HTTPS/age priorities
- incognito where applicable
- automatic-close path only after manual/fail-closed coverage is sufficiently strong

Do not claim ETAPA 5 complete until these themes have been covered reasonably.

## Safety / approval gates

Do not merge, release, publish, open an upstream PR, force-push, delete remote branches, change/create tags, perform an official version bump, add a major dependency, or make another major architecture change without explicit maintainer approval.

When a Workspace-related error occurs, preserve fail-closed behavior and provide a short copyable diagnostic JSON without browsing URLs/history.

Continue from the repository state actually observed, not assumptions in this prompt.

---
