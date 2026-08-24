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
4. Inspect the current branch `feature/vivaldi-workspace-scope` and compare it against `master`.
5. Do not ask the maintainer to reconstruct the original project prompt; the repository documentation is the source of truth.

Project goal: add scope `VW` = **Active Vivaldi Workspace** to Duplicate Tabs Closer while preserving all existing matching and keep/close behavior.

Critical safety requirement: **fail closed**. Under `VW`, if Workspace identity or membership is missing, malformed, unexpected, timed out, or ambiguous, close zero tabs. Never fall back to Active Window, Current Window, All Windows, `windowId`, `groupId`, tab order, or any other heuristic.

Important architectural discovery: a normal Chromium extension in Vivaldi 8.1 cannot read Workspace metadata. A minimal read-only Vivaldi UI Bridge is required. The Bridge can access `vivaldi.tabsPrivate` / Workspace metadata from the Vivaldi UI extension and respond to the fork. The Bridge itself must never close, move, or activate tabs.

The maintainer is not a programmer. This project is developed using AI-assisted development / vibe-coding. When human intervention is required, give exact click-by-click instructions using the manual-action format defined in `AGENTS.md`. Do not assume Git/GitHub/DevTools knowledge.

## Current checkpoint — read this carefully

- ETAPA 0: complete.
- ETAPA 1: complete.
- ETAPA 2: complete.
- ETAPA 3: implementation/review pass complete enough for real-browser validation.
- ETAPA 4A: **confirmed complete by the maintainer**.
- ETAPA 4B: **instructions were given, but execution/result is NOT known** because the previous chat was temporary and the maintainer may have closed Vivaldi before following them.

ETAPA 4A confirmed facts:

- the maintainer downloaded branch `feature/vivaldi-workspace-scope`
- the Chromium build completed successfully
- the unpacked fork loaded successfully in Vivaldi
- the fork extension ID was confirmed as `jkhljmjemfaeoklndkcnehbcnmfjcfam`
- the original Duplicate Tabs Closer extension was disabled, not removed
- the fork was left with `On duplicate tab detected = Do nothing`
- before installing the persistent Bridge, scope remained `Active Window`, which was expected

ETAPA 4B instructions already delivered:

- locate the current Vivaldi `resources\vivaldi` directory and confirm `window.html`
- back up `window.html` as `window.html.dtc-backup`
- create `resources\vivaldi\dtc-mods`
- copy `vivaldi-bridge/dtc-vivaldi-workspace-bridge.js` there
- add immediately before `</body>` in `window.html`:
  `<script src="dtc-mods/dtc-vivaldi-workspace-bridge.js"></script>`
- restart Vivaldi
- keep `On duplicate tab detected = Do nothing`
- verify that `Active Vivaldi Workspace` appears in Scope and can be selected without a Bridge error

**Do not assume any ETAPA 4B step actually happened.** The first thing the new chat should do is ask the maintainer which of these states is true:

1. `ETAPA 4B no iniciada`
2. `Bridge instalado y funciona`
3. `Intenté instalarlo pero hubo un error`
4. `No estoy seguro`

If the maintainer says the Bridge was installed, verify the result before any duplicate-closing test. If the maintainer is unsure, treat ETAPA 4B as not validated and proceed conservatively.

Current branch: `feature/vivaldi-workspace-scope`.

`master` must remain untouched unless the maintainer separately approves a merge later.

Do not merge, release, publish, open an upstream PR, force-push, delete remote branches, make an official version bump, add a major dependency, or make another major architecture change without explicit maintainer approval.

When a Workspace-related error occurs, preserve fail-closed behavior and provide a short, copyable diagnostic JSON. Do not include browsing URLs in diagnostics.

Continue from the repository state you actually observe, not from assumptions in this prompt. If code and this file disagree, inspect history and update `docs/PROJECT_HANDOFF.md` with the verified current state before proceeding.

---
