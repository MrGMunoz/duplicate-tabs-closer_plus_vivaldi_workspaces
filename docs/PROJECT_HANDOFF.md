# Project Handoff

## Current status

Project: add **Active Vivaldi Workspace** scope to Duplicate Tabs Closer.

Current date: 2026-08-24.

Current development branch: `feature/vivaldi-workspace-scope`.

`master` remains untouched by this work.

Completed stages:

- ETAPA 0 — preparation and fork verification: complete
- ETAPA 1 — read-only audit and feasibility study: complete
- ETAPA 2 — architecture research/design: complete
- ETAPA 3 — implementation: in progress

Do not merge, release, publish, or open an upstream PR without explicit maintainer approval.

## Repository relationship

Upstream: `Peuj/duplicate-tabs-closer`

Fork: `MrGMunoz/duplicate-tabs-closer_plus_vivaldi_workspaces`

The fork started from upstream `master` commit:

`214a60a3a6d587ae7a78a13a7911d08366e7c963`

Development branch was created from that exact commit.

## Runtime research result

Real testing was performed in Vivaldi 8.1.4087.70 / Chromium 150.0.7871.253.

From the normal Duplicate Tabs Closer service worker:

- `globalThis.vivaldi` was not available
- `vivaldi.prefs.get` was not available
- `vivaldi.tabsPrivate.get` was not available
- `tab.vivExtData` was not exposed in `chrome.tabs.Tab`
- no Workspace-specific field appeared in the tab object
- no obvious Workspace/Vivaldi namespace appeared under `chrome`
- `groupId` did not identify Workspaces
- `windowId` was experimentally shown not to be a safe substitute for Workspace identity

This invalidated the original idea of reading `tab.vivExtData.workspaceId` directly from a normal WebExtension.

## Proven Bridge approach

Vivaldi's own UI extension was inspected through `vivaldi://inspect/#apps`.

The Vivaldi UI runtime ID is:

`mpognobbkildjkofajifpdfhcoklimli`

Inside that UI context the following were confirmed available:

- `globalThis.vivaldi`
- `vivaldi.prefs.get`
- `vivaldi.tabsPrivate.get`

A temporary runtime listener was installed manually in the Vivaldi UI console. Duplicate Tabs Closer successfully sent an external message to that listener and received Workspace data.

The second probe passed explicit window/tab IDs and confirmed:

- Vivaldi returned a real `workspaceId` for each test tab
- Workspace A and Workspace B had different stable IDs
- switching Workspaces changed `activeWorkspaceId` correctly
- a pinned tab retained its original Workspace membership

Therefore the selected architecture is:

`fork extension -> read-only Vivaldi UI Bridge -> Vivaldi internal Workspace metadata`

## Safety model

Scope code: `VW` = Active Vivaldi Workspace.

When `VW` is selected:

1. query normal candidate tabs
2. ask the Bridge for exact Workspace metadata
3. validate protocol, request ID, window ID, active tab, active Workspace, tab IDs, counts, and Workspace IDs
4. filter candidates to the exact active Workspace
5. run existing Duplicate Tabs Closer matching/priority logic unchanged
6. immediately before a close, query the Bridge again
7. if Workspace or membership changed, abort the close

Any failure must result in zero closes. Never fall back to Active Window or another scope.

## Implementation currently present on the branch

Commits created so far:

1. `d09b00e16482853c909d382a4dc5fc6aacc345ae` — Add fail-closed Vivaldi Workspace bridge core
2. `54a301cc8349a5fec9feca62b3a74ceb56c4d458` — Show Vivaldi Workspace scope only with bridge
3. `9f8635f6804378d84b17049701cb2a85dfcce423` — Add Vivaldi Workspace diagnostics and copyable errors

Current implementation files include:

- `vivaldiWorkspace.js` — extension-side Bridge client and validation
- `vivaldi-bridge/dtc-vivaldi-workspace-bridge.js` — Vivaldi UI Bridge
- `worker.js` — Workspace filtering and pre-close revalidation
- `panelHelper.js` — dynamic `VW` scope availability/error UI
- `manifest-c.json` — stable extension ID material
- `manifest-f.json` / `background.js` — load the new helper without changing Firefox scope behavior

The Bridge accepts only the stable ID assigned to this fork:

`jkhljmjemfaeoklndkcnehbcnmfjcfam`

The manifest contains only the public key material required to derive this stable ID. Never commit or request the corresponding private key.

## Diagnostics

The maintainer requested that Workspace failures be visible and easy to report.

The implementation now records a sanitized diagnostic in `chrome.storage.session` and logs a `DTC-VW-DIAGNOSTIC` warning. Diagnostic objects contain no tab URLs.

Representative error codes include:

- `VW-BRIDGE-TIMEOUT`
- `VW-BRIDGE-UNREACHABLE`
- `VW-BRIDGE-EXCEPTION`
- `VW-BRIDGE-REJECTED`
- `VW-PROTOCOL-MISMATCH`
- `VW-WINDOW-MISMATCH`
- `VW-ACTIVE-WORKSPACE-INVALID`
- `VW-TAB-WORKSPACE-INVALID`
- `VW-WORKSPACE-CHANGED`
- `VW-TAB-MOVED-WORKSPACE`

When `VW` is selected and an error exists, popup/options should show a short fail-closed message and a control for copying diagnostic JSON.

## Important known issues to resolve before ETAPA 4

### 1. Auto-navigation candidate race

In the automatic path, `chrome.tabs.query()` can be URL-filtered while a tab is still navigating. The observed tab may temporarily be absent from that candidate result. The current first implementation requires the observed tab to appear in the Workspace-filtered result, so this can conservatively suppress a valid close.

This is fail-safe, not unsafe: it produces zero closes rather than a wrong close. It should still be fixed before browser testing so valid auto-close behavior is not unnecessarily missed.

Preferred fix: explicitly include the observed tab ID in the Workspace metadata request even when the URL-filtered candidate query omits it, while preserving the candidate set used for duplicate comparison.

### 2. `options.js` line-ending noise

The functional change to `options.js` is only the `VW` state mapping, but an early commit normalized CRLF to LF, causing GitHub to display hundreds of false changed lines.

This should be cleaned before final review so the diff reflects the minimal delta. Do not rewrite unrelated options logic.

### 3. Persistent Bridge installation is not yet validated

The Bridge has been proven through the Vivaldi UI DevTools console, but persistent installation as a Vivaldi UI JavaScript mod has not yet been tested on the maintainer's machine.

Do not claim the installation procedure is final until ETAPA 4 verifies it end-to-end.

### 4. Localization

The `VW` UI currently includes safe English fallback text. Proper locale messages still need to be added with minimal churn.

### 5. Static/runtime validation

No full automated test suite exists upstream. Syntax/static checks, build checks, and extensive real-browser manual tests are still required.

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

## Required future test themes

The agreed real tests include:

- duplicate URL inside active Workspace
- same URL in different Workspaces must not cross-close
- different URL on same domain
- pinned tabs
- active tab
- malformed/absent Bridge -> zero closes
- switching Workspaces
- multiple Workspaces
- existing scopes regression
- discarded/hibernated tabs
- stacks/groups
- incognito where applicable
- multiple windows
- moving tabs between Workspaces
- race during close
- startup/session restore/lazy loading
- Vivaldi internal pages

## Documentation requirement from maintainer

This fork is explicitly documented as being developed through AI-assisted development / vibe-coding because the maintainer has limited technical/programming experience.

Future agents must give precise manual instructions when human intervention is required and must never assume the maintainer knows Git, browser-extension tooling, DevTools, or build commands.

See `AGENTS.md` for the exact manual-instruction format and approval gates.
