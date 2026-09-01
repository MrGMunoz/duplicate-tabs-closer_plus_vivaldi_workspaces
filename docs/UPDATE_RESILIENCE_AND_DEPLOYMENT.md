# Vivaldi Update Resilience and Deployment

## Purpose

This document records new project requirements created after a real Vivaldi update disrupted the Workspace integration on 2026-09-01.

These requirements are part of the `feature/vivaldi-workspace-scope` project and must be considered before the fork is treated as convenient for normal long-term use.

## Runtime incident — 2026-09-01

Observed user-facing symptom after a Vivaldi update:

- `Active Vivaldi Workspace` disappeared from the Scope selector.
- The base Duplicate Tabs Closer extension still ran.
- Re-injecting the Vivaldi UI Bridge made `Active Vivaldi Workspace` appear again.
- An older local Bridge copy then produced `VW-BRIDGE-REJECTED` with reason `workspace-list-unavailable`, so Workspace-scoped duplicates were not detected.
- Direct Vivaldi UI probing showed `vivaldi.prefs.get("vivaldi.workspaces.list")` still returned the known wrapper shape with keys `defaultValue`, `store`, and `value`, with the actual Workspace array in `.value`.
- Loading the current Bridge from `feature/vivaldi-workspace-scope`, including commit `60a2333e59efea4f2865b46dbb60adade862bc47` (`Handle wrapped Vivaldi workspace preferences`), restored duplicate detection inside the active Workspace.
- The maintainer replaced the persistent Bridge file with the current version.

Interpretation:

1. A Vivaldi update can remove or stop loading the persistent `window.html` Bridge injection.
2. A stale Bridge copy can be independently incompatible even when the extension itself is current.
3. The existing fail-closed behavior worked correctly: unsafe Workspace metadata produced no Workspace-scoped duplicate actions instead of falling back to a broader scope.

## Required verification after the next normal restart

The next time Vivaldi is normally restarted, verify all of the following without manually injecting code into DevTools:

1. `Active Vivaldi Workspace` appears automatically in Scope.
2. The Bridge reports no unavailable/rejected diagnostic.
3. Two identical tabs in the same active custom Workspace are detected.
4. A matching tab in another Workspace remains excluded.
5. `On duplicate tab detected = Do nothing` remains the validation mode until the restart check passes.

This restart verification is currently **pending** and must not be marked passed merely because the Bridge works in the current already-running Vivaldi session.

## New requirement: survive Vivaldi updates more gracefully

The project must investigate a maintainable way to keep the Vivaldi Workspace integration usable across Vivaldi updates.

The solution does not have to make unsupported Vivaldi UI modifications magically permanent if Vivaldi replaces its own files, but it should minimize manual repair and make failures obvious.

Research/design goals:

- Detect that the Bridge injection disappeared after a Vivaldi update.
- Detect that the Bridge exists but is an older/incompatible version.
- Detect protocol/API-shape changes separately from a simply missing Bridge.
- Surface a clear user-facing status explaining what failed.
- Preserve **FAIL CLOSED** behavior: never broaden Scope or close tabs when Workspace metadata is unsafe.
- Provide a simple repair path that a non-programmer maintainer can follow.
- Prefer an installer/updater/repair helper if this can be done safely without weakening browser security.
- Investigate whether the Bridge can expose a small version/build identifier so the extension can distinguish `missing`, `reachable but stale`, and `current but incompatible` states.
- Consider recording the last-known-good Vivaldi version and Bridge version only as diagnostics; never use version numbers as a substitute for runtime validation.
- Do not add invasive permissions (`debugger`, `nativeMessaging`, etc.) merely for persistence without explicit maintainer approval.

## New requirement: detect breakage after browser updates

The extension should make update-related breakage visible without requiring the maintainer to notice that duplicate counts look wrong.

Desired behavior to investigate:

- On startup and when `VW` is selected, perform a lightweight Bridge health check.
- Distinguish at least:
  - Bridge unreachable/missing.
  - Bridge protocol/version mismatch or stale Bridge.
  - Workspace-list/API incompatibility.
  - Tab Workspace metadata incompatibility.
- Keep sanitized diagnostics copyable from the UI.
- Never include URLs, tab titles, browsing history, tokens, profile paths, or other private browsing data.
- Where feasible, show a human-readable recovery hint such as `Vivaldi update may have removed the Workspace Bridge; repair required`.
- Do not automatically rewrite Vivaldi installation files from the extension itself unless a later design review establishes a safe and supportable mechanism and the maintainer explicitly approves it.

## New deployment goal: normal use without Developer mode

The maintainer wants to use this fork as a normal extension without leaving Vivaldi's **Developer mode** enabled.

This is now an explicit project/deployment goal.

Current platform constraints to respect during research:

- Vivaldi's official extension help documents `Load unpacked` as requiring Developer mode.
- Vivaldi normally installs Chromium extensions through the Chrome Web Store.
- Chromium's official extension-distribution documentation states that on Windows and macOS, self-hosted extensions outside the Chrome Web Store require enterprise policy; unpacked loading is a development workflow.

Therefore, do **not** assume that simply producing a `.crx` will provide a clean normal-user installation on Windows.

Deployment paths to evaluate before choosing one:

1. **Chrome Web Store, unlisted/private/test distribution** if policy and the Vivaldi-specific architecture permit it.
2. **Enterprise/managed-policy installation** for a personally managed Windows machine, if practical and not excessively invasive.
3. Any Vivaldi-supported signed/package mechanism that genuinely works without Developer mode, if current Vivaldi documentation establishes one.

Evaluation criteria:

- Developer mode not required for day-to-day use.
- Stable extension ID remains `jkhljmjemfaeoklndkcnehbcnmfjcfam` or a migration plan is explicitly designed and tested.
- Updates to the extension can be delivered safely.
- The deployment method does not silently install arbitrary code or weaken browser security.
- The Vivaldi UI Bridge remains a separate problem: a store-installed extension does not by itself guarantee persistence of the `window.html` Bridge modification across Vivaldi updates.
- The approach must be understandable and maintainable by the current maintainer.

No publication, store submission, enterprise-policy deployment, official release, or major architecture change should be performed without explicit maintainer approval.

## Future work checkpoint

Before considering the project comfortable for long-term normal use, address these three separate questions:

1. **Restart persistence:** does the repaired Bridge load correctly after a normal Vivaldi restart?
2. **Update resilience:** how will the project detect and guide recovery when a Vivaldi update removes or breaks the Bridge?
3. **Normal deployment:** how can the fork be installed and updated without keeping Developer mode enabled?

These are distinct from the already-validated core `VW` duplicate-isolation behavior and must not be conflated with it.
