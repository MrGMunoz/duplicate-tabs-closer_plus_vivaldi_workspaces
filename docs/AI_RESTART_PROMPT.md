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
- ETAPA 5F: next — deliberately make the installed Vivaldi UI Bridge unavailable and confirm fail-closed zero-close behavior, then restore it

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

These tests validate manual batch close, row close, grouped close, Workspace isolation, and pinned priority for the tested runtime cases.

## Exact next action — ETAPA 5F

Validate missing-Bridge fail-closed behavior.

Use the installed Bridge at:

`resources\vivaldi\dtc-mods\dtc-vivaldi-workspace-bridge.js`

Procedure concept:

1. Fully close Vivaldi.
2. Temporarily rename the Bridge file; do not delete it and do not edit `window.html`.
3. Reopen Vivaldi.
4. Keep `On duplicate tab detected = Do nothing` and the stored `VW` scope if possible.
5. Confirm the UI reports the Bridge unavailable/error state.
6. Confirm no tabs are closed while the Bridge is unavailable.
7. Use `Copy diagnostics` if present and preserve the sanitized JSON.
8. Fully close Vivaldi.
9. Restore the Bridge to the exact original filename.
10. Reopen Vivaldi and confirm `VW` is available again with no warning.

Expected result while the Bridge is unavailable: **zero closes**.

Do not enable auto-close and do not modify `window.html` during this test.

If 5F fails, stop closing tests and inspect diagnostics before any code change.

## Safety / approval gates

Do not merge, release, publish, open an upstream PR, force-push, delete remote branches, change/create tags, perform an official version bump, add a major dependency, or make another major architecture change without explicit maintainer approval.

When a Workspace-related error occurs, preserve fail-closed behavior and provide a short copyable diagnostic JSON without browsing URLs/history.

Continue from the repository state actually observed, not assumptions in this prompt.

---
