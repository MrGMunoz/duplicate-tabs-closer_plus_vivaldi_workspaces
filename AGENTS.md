# AGENTS.md

## Purpose

This repository is a fork of `Peuj/duplicate-tabs-closer` that is adding a Vivaldi-specific scope: **Active Vivaldi Workspace** (`VW`).

The fork is maintained through AI-assisted development / "vibe coding" because the maintainer is not a programmer and has limited experience with Git, GitHub, browser-extension development, and debugging. This does **not** mean changes are accepted without review. Agents must keep changes small, review diffs, preserve upstream behavior, test carefully, and require explicit human approval for consequential operations.

## Read first

Before changing anything, read:

1. `AGENTS.md`
2. `docs/PROJECT_HANDOFF.md`
3. `docs/VIVALDI_WORKSPACE_BRIDGE.md`
4. `docs/UPDATE_RESILIENCE_AND_DEPLOYMENT.md`
5. `docs/PRIVATE_LOCAL_DEPLOYMENT_PLAN.md`
6. `docs/AI_RESTART_PROMPT.md`

## Repository boundaries

- Upstream: `Peuj/duplicate-tabs-closer`
- Fork: `MrGMunoz/duplicate-tabs-closer_plus_vivaldi_workspaces`
- Upstream is read-only unless the maintainer explicitly approves an upstream PR or other upstream action.
- Never modify upstream directly.
- Do not develop directly on `master`.
- Current development branch: `feature/vivaldi-workspace-scope`.

## Core functional requirement

Add scope `VW` = **Active Vivaldi Workspace** while preserving all existing Duplicate Tabs Closer matching and keep/close rules.

Workspace membership is a filter applied before duplicate matching. Do not rewrite URL matching, pinned-tab priority, HTTPS priority, age priority, Firefox Container behavior, or other upstream duplicate logic unless strictly necessary.

## Non-negotiable safety rule: fail closed

When scope `VW` is selected, if the active Vivaldi Workspace or the Workspace membership of required tabs cannot be identified unambiguously, **close zero tabs**.

Never silently fall back to:

- Active Window
- Current Window
- All Windows
- `windowId` heuristics
- `groupId` heuristics
- tab order/index heuristics
- visibility/hidden-state heuristics

Any malformed, missing, inconsistent, timed-out, or unexpected Bridge response must abort the close operation.

Revalidate the active Workspace immediately before closing tabs. If the Workspace changed or a tab moved between Workspaces during the operation, abort the close.

## Vivaldi architecture

A normal Chromium extension in Vivaldi 8.1 does not receive Workspace metadata through `chrome.tabs.Tab` and does not expose `globalThis.vivaldi`, `vivaldi.tabsPrivate`, or `vivaldi.prefs` in its service worker.

The Vivaldi UI extension (`mpognobbkildjkofajifpdfhcoklimli`) does expose the necessary internal APIs. The implementation therefore uses a minimal read-only Vivaldi UI Bridge:

`Duplicate Tabs Closer fork -> Vivaldi Workspace Bridge -> Vivaldi internal Workspace metadata`

The Bridge must never close, move, activate, or edit tabs. It only reads Workspace membership and returns validated metadata.

The Bridge only accepts requests from the stable extension ID assigned to this fork.

## Operational resilience and deployment requirements

The Vivaldi UI Bridge is installed through Vivaldi UI resources and may be removed, replaced, or made incompatible by a Vivaldi update. A real update-related failure occurred on 2026-09-01 and is documented in `docs/UPDATE_RESILIENCE_AND_DEPLOYMENT.md`.

Treat the following as explicit project requirements:

- **Never require the maintainer to close, restart, or interrupt Vivaldi as part of installation, repair, validation, deployment, or routine maintenance.** The maintainer may have long-running work that cannot be interrupted.
- If an on-disk Bridge change requires a fresh Vivaldi UI process to become active, install/repair it now and defer activation/verification until the maintainer's next **natural** Vivaldi restart. Never instruct the maintainer to restart merely for this project.
- Scheduled/background maintenance must be invisible and must not steal focus, raise a console window, or otherwise interrupt desktop use.
- verify that the repaired persistent Bridge loads correctly after a future normal/natural Vivaldi restart without DevTools injection;
- investigate a maintainable way to detect when a Vivaldi update removed or broke the Bridge;
- distinguish a missing Bridge from a stale/incompatible Bridge or changed Vivaldi internal API;
- preserve fail-closed behavior during all such failures;
- provide simple, sanitized, human-readable recovery guidance;
- investigate how the fork can be installed and used normally without leaving Vivaldi Developer mode enabled;
- **current maintainer preference is private/local deployment only; do not resume Chrome Web Store Public/Unlisted publication unless the maintainer explicitly changes that decision**;
- the next preferred feasibility path is a private signed/self-hosted CRX plus Vivaldi-scoped local policy, if the maintainer's installed Vivaldi version supports it; see `docs/PRIVATE_LOCAL_DEPLOYMENT_PLAN.md`;
- do not assume that a local `.crx` alone solves normal Windows deployment;
- do not add invasive permissions, enterprise policy, store publication, auto-patching of Vivaldi files, or another major architecture mechanism without explicit maintainer approval.

A store-installed or otherwise normally installed extension does **not** by itself solve persistence of the separate Vivaldi UI Bridge. Treat extension deployment and Bridge update-resilience as distinct problems.

## Diagnostics requirement

Workspace failures must not be silent.

- Store a small diagnostic object in `chrome.storage.session`.
- Use stable error codes such as `VW-BRIDGE-TIMEOUT`, `VW-BRIDGE-UNREACHABLE`, `VW-WORKSPACE-CHANGED`, etc.
- Do not include tab URLs or browsing history in diagnostics.
- Popup/options should show a short fail-closed warning when `VW` is selected and an error exists.
- Provide a simple way for the maintainer to copy the diagnostic JSON and paste it into a chat for troubleshooting.

## Compatibility

Preserve existing behavior in Chrome, Edge, Brave, Opera, Firefox, and Vivaldi for all pre-existing scopes.

The default scope remains `C` (Active Window).

Firefox Containers (`CC`, `CA`) and Firefox-only code paths must remain independent from Vivaldi Workspace handling.

Do not add invasive permissions such as `debugger` or `nativeMessaging` without explicit approval.

## Required manual-test themes

At minimum validate:

- duplicate URLs inside one Workspace
- same URL across different Workspaces
- different URLs on same domain
- pinned tabs
- active tab
- malformed/unavailable Bridge -> zero tabs closed
- switching between multiple Workspaces
- regression of existing scopes
- discarded/hibernated tabs
- tab stacks/groups
- multiple windows
- moving tabs between Workspaces
- races during close
- startup/session restore
- internal pages
- natural restart after persistent Bridge repair, whenever the maintainer next restarts Vivaldi for unrelated reasons
- post-Vivaldi-update Bridge health / failure detection
- intended normal installation path without requiring Developer mode for day-to-day use

## Human approval gates

Do not perform any of these without explicit maintainer approval:

- merge into the default branch
- delete remote branches
- force-push or rewrite history
- create releases or publish to stores
- open an upstream PR
- substantially modify an upstream PR
- open issues in external repositories
- create/change tags
- make an official version bump
- add a major external dependency
- make another major architecture change
- substantially expand project scope

## Manual instructions for the maintainer

When the maintainer must do something manually, use this exact structure:

`## Acción manual necesaria`

`### Objetivo`

`### Por qué debo hacerlo yo`

`### Pasos`

`### Debes ver`

`### No hagas esto`

`### Cuando termines`

Instructions must say exactly where to click, what to type/select, what not to select, what result is expected, how to verify it, and exactly what information to send back.

## Development style

- Prefer the smallest reasonable delta.
- Avoid unrelated refactors.
- Avoid new dependencies unless clearly justified.
- Keep commits small and coherent.
- Review the diff after each logical commit.
- Do not store passwords, private keys, tokens, profile paths, or personal browsing data.
- Public manifest material used solely to keep a stable extension ID is not a secret; never commit the corresponding private key.
- Keep `docs/PROJECT_HANDOFF.md` current whenever an important decision, test result, limitation, or stage transition occurs.
