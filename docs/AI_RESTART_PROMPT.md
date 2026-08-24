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

Current stage at the time this file was created: **ETAPA 3 — implementation in progress**.

Current branch: `feature/vivaldi-workspace-scope`.

Known remaining issues before browser testing are documented in `docs/PROJECT_HANDOFF.md`; address those before declaring ETAPA 3 complete.

Do not merge, release, publish, open an upstream PR, force-push, delete remote branches, make an official version bump, add a major dependency, or make another major architecture change without explicit maintainer approval.

When a Workspace-related error occurs, preserve fail-closed behavior and provide a short, copyable diagnostic JSON. Do not include browsing URLs in diagnostics.

Continue from the repository state you actually observe, not from assumptions in this prompt. If code and this file disagree, inspect history and update `docs/PROJECT_HANDOFF.md` with the verified current state before proceeding.

---
