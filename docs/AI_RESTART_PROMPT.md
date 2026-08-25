# AI Restart Prompt

Use this file when handing the project to a new AI/chat session.

---

You are taking over development of the GitHub fork:

`MrGMunoz/duplicate-tabs-closer_plus_vivaldi_workspaces`

Upstream is:

`Peuj/duplicate-tabs-closer`

Your first actions must be:

1. Read `AGENTS.md` completely.
2. Read `docs/PROJECT_HANDOFF.md` completely.
3. Read `docs/VIVALDI_WORKSPACE_BRIDGE.md` completely.
4. Read this file completely.
5. Inspect the current branch `feature/vivaldi-workspace-scope` and compare it against `master`.
6. Do not ask the maintainer to reconstruct the original project prompt; the repository documentation and actual repository state are the source of truth.

Project goal: add scope `VW` = **Active Vivaldi Workspace** to Duplicate Tabs Closer while preserving all existing matching and keep/close behavior.

Critical safety requirement: **fail closed**. Under `VW`, if Workspace identity or membership is missing, malformed, unexpected, timed out, or ambiguous, close zero tabs. Never fall back to Active Window, Current Window, All Windows, `windowId`, `groupId`, tab order, or any other heuristic.

Important architectural discovery: a normal Chromium extension in Vivaldi 8.1 cannot read Workspace metadata. A minimal read-only Vivaldi UI Bridge is required. The Bridge can access `vivaldi.tabsPrivate` / Workspace metadata from the Vivaldi UI extension and respond to the fork. The Bridge itself must never close, move, activate, or edit tabs.

The maintainer is not a programmer. This project is developed using AI-assisted development / vibe-coding. When human intervention is required, give exact click-by-click instructions using the manual-action format defined in `AGENTS.md`. Do not assume Git/GitHub/DevTools knowledge.

## Current checkpoint — read this carefully

- ETAPA 0: complete.
- ETAPA 1: complete.
- ETAPA 2: complete.
- ETAPA 3: implementation/review pass complete enough for real-browser validation.
- ETAPA 4A: **confirmed complete by the maintainer**.
- ETAPA 4B: **confirmed complete by the maintainer**.
- ETAPA 5: real runtime validation **in progress**.
- ETAPA 5A: **passed**.
- ETAPA 5B: **passed**.
- ETAPA 5C: **next** — controlled direct-row close under `VW` while keeping `On duplicate tab detected = Do nothing`.

Confirmed ETAPA 4A/4B facts:

- Chromium build completed successfully
- unpacked fork loaded successfully in Vivaldi
- stable fork extension ID confirmed exactly as `jkhljmjemfaeoklndkcnehbcnmfjcfam`
- original Duplicate Tabs Closer extension was disabled, not removed
- persistent Bridge installed under Vivaldi UI resources
- Vivaldi starts normally with the Bridge installed
- `Active Vivaldi Workspace` appears in Scope and can be selected
- `On duplicate tab detected = Do nothing`
- no Bridge-unavailable warning during ETAPA 4B validation

## ETAPA 5A history and result

Observation-only test URL:

`https://example.com/?dtc-vw-scope-test=20260824`

Test layout:

- 3 identical tabs in Workspace A
- 1 identical tab in Workspace B
- active Workspace A
- `Scope = Active Vivaldi Workspace`
- `On duplicate tab detected = Do nothing`

Normal `Active Window` detected all 4 tabs, proving the upstream duplicate engine works and that Vivaldi Workspaces share a Chromium window.

Direct Vivaldi UI inspection showed correct Workspace metadata for the four test tabs:

- Workspace A ID: `1786421728088` on 3 test tabs
- Workspace B ID: `1787604210876` on 1 test tab

The same Vivaldi window also contained one valid discarded internal tab whose parsed `vivExtData` had no `workspaceId`. This exposed the first Bridge compatibility case: Vivaldi can represent the default/non-custom Workspace by omitting `workspaceId`.

First Bridge fix:

`d2d509ea7e416d78592b539ae8a81566cf34a355` — `Handle Vivaldi default workspace tabs in bridge`

That change introduced the reserved sentinel `__dtc_vivaldi_default_workspace__` only for valid parsed `vivExtData` with an absent/null `workspaceId`, while preserving fail-closed behavior for malformed/missing metadata.

After installing that fix and restarting Vivaldi, ETAPA 5A still returned `NO DUPLICATES`. A direct Bridge query then returned safely:

- `transportError = null`
- `ok = false`
- `reason = workspace-list-unavailable`
- no tab metadata returned

A read-only Vivaldi UI probe established the second compatibility case: `vivaldi.prefs.get("vivaldi.workspaces.list")` returned a thenable whose awaited value was an object with keys `defaultValue`, `store`, and `value`; the actual Workspace array was `.value` (observed length `7`). Callback usage returned the same wrapper shape.

Second Bridge fix:

`60a2333e59efea4f2865b46dbb60adade862bc47` — `Handle wrapped Vivaldi workspace preferences`

That change is intentionally narrow:

- accepts a direct Workspace array, or an object with an own `.value` property that is an array
- rejects every other preference shape as `null`
- keeps all Workspace-ID validation unchanged
- changes only `vivaldi-bridge/dtc-vivaldi-workspace-bridge.js`
- does not touch `worker.js`, matching, priorities, or closing logic

After replacing the installed Bridge with that version and fully restarting Vivaldi, ETAPA 5A was repeated with the same 3-in-A / 1-in-B layout.

ETAPA 5A result:

- Workspace A detected exactly 3
- Workspace B test tab remained open
- no Bridge error or warning

Therefore **ETAPA 5A PASSED**.

## ETAPA 5B result

Using the same four tabs, still with `On duplicate tab detected = Do nothing` and `Scope = Active Vivaldi Workspace`, the maintainer pressed `Close duplicates` exactly once while Workspace A was active.

Result:

- before close: DTC detected exactly 3 in Workspace A
- after close: exactly 1 test tab remained in Workspace A
- the matching Workspace B test tab remained open
- no Bridge error or warning appeared

Therefore **ETAPA 5B PASSED**. This validates the guarded manual batch-close path for this tested A/B runtime case.

## Exact next action — ETAPA 5C

Test the guarded direct-row close path under `VW`, still with `On duplicate tab detected = Do nothing`.

Prepare:

- Workspace A: at least 2 identical test tabs using the same test URL
- Workspace B: keep the matching test tab
- active Workspace A
- `Scope = Active Vivaldi Workspace`
- `On duplicate tab detected = Do nothing`

Before closing, confirm DTC lists only the duplicate tabs from Workspace A and no Bridge warning appears.

Then press exactly one row X for one listed Workspace A tab.

Expected result:

- exactly that selected A tab closes
- at least one matching A tab remains
- the matching Workspace B tab remains open
- no Bridge error or warning appears

Stop after this single direct-row close. Do not press `Close duplicates`, `Close group`, another row X, and do not enable automatic close yet.

If ETAPA 5C fails, preserve fail-closed behavior and inspect diagnostics/runtime state before proposing a code change.

Current branch: `feature/vivaldi-workspace-scope`.

`master` must remain untouched unless the maintainer separately approves a merge later.

Do not merge, release, publish, open an upstream PR, force-push, delete remote branches, make an official version bump, add a major dependency, create/change tags, or make another major architecture change without explicit maintainer approval.

When a Workspace-related error occurs, preserve fail-closed behavior and provide a short, copyable diagnostic JSON. Do not include browsing URLs in diagnostics.

Continue from the repository state you actually observe, not from assumptions in this prompt. If code and documentation disagree, inspect history and update `docs/PROJECT_HANDOFF.md` with the verified current state before proceeding.

---
