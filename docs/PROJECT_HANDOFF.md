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
- ETAPA 3 — implementation/review pass: complete enough for browser validation
- ETAPA 4A — Chromium build + unpacked fork load in Vivaldi: **confirmed complete by maintainer**

Current unresolved stage:

- ETAPA 4B — persistent Vivaldi Workspace Bridge installation: **instructions delivered, execution/result unknown**

The previous chat was temporary. Do not assume the maintainer followed ETAPA 4B instructions after they were provided.

Do not merge, release, publish, or open an upstream PR without explicit maintainer approval.

## Immediate resume checkpoint

ETAPA 4A was confirmed successful by the maintainer. Confirmed facts:

- branch used: `feature/vivaldi-workspace-scope`
- Chromium build completed successfully
- unpacked fork loaded successfully in Vivaldi
- fork extension ID confirmed exactly as `jkhljmjemfaeoklndkcnehbcnmfjcfam`
- original Duplicate Tabs Closer extension was disabled, not removed
- fork was left with `On duplicate tab detected = Do nothing`
- before persistent Bridge installation, Scope remained `Active Window`, which was expected

ETAPA 4B instructions were then given, but the maintainer warned that closing Vivaldi would also lose the temporary chat. Therefore **none of the following may be assumed to have happened**:

- locating the current Vivaldi `resources\vivaldi` directory
- backing up `window.html` as `window.html.dtc-backup`
- creating `resources\vivaldi\dtc-mods`
- copying `vivaldi-bridge/dtc-vivaldi-workspace-bridge.js`
- editing `window.html`
- restarting Vivaldi
- seeing `Active Vivaldi Workspace` in Scope
- selecting `VW`
- seeing or not seeing a Bridge error

The first question in a new chat should be only to establish which state applies:

1. ETAPA 4B not started
2. Bridge installed and appears to work
3. installation attempted but an error occurred
4. maintainer is unsure

If unsure, treat ETAPA 4B as **not validated**.

## ETAPA 4B procedure already delivered

The persistent Bridge procedure given to the maintainer was:

1. Open `vivaldi://about` and confirm the current Vivaldi version.
2. Locate that installation's `resources\vivaldi` directory and verify it contains `window.html`.
3. Back up `window.html` as `window.html.dtc-backup`.
4. Create `resources\vivaldi\dtc-mods`.
5. Copy repository file `vivaldi-bridge/dtc-vivaldi-workspace-bridge.js` into that folder.
6. Fully close Vivaldi before editing `window.html`.
7. Add exactly this line immediately before `</body>`:

```html
<script src="dtc-mods/dtc-vivaldi-workspace-bridge.js"></script>
```

8. Save `window.html` and reopen Vivaldi.
9. Keep `On duplicate tab detected = Do nothing`.
10. Verify `Active Vivaldi Workspace` appears in Scope.
11. Select it only while still in `Do nothing` mode.
12. Verify no Bridge unavailable/error warning appears.

Do not proceed to real duplicate-closing tests until ETAPA 4B is positively verified.

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
- a pinned tab retained its Workspace membership

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

The auto-navigation path separately validates the observed tab even if Chromium's URL-filtered candidate query temporarily omits that tab during navigation. This fixes the conservative navigation race found during code review without broadening the candidate set.

Popup/options direct row and group close actions are also guarded in `VW`: synchronous row/group `removeTab` calls are batched and routed back to an internal-only background message, then Workspace membership is revalidated before removal. Outside `VW`, the historical direct-close behavior remains unchanged.

## Implementation present on the branch

Main implementation files:

- `vivaldiWorkspace.js` — extension-side Bridge client, response validation, fail-closed diagnostics, navigation-required-tab validation, and guarded panel close handling
- `vivaldi-bridge/dtc-vivaldi-workspace-bridge.js` — read-only Vivaldi UI Bridge
- `worker.js` — Workspace filtering and immediate pre-close revalidation for automatic and manual/batch paths
- `helper.js` — batches direct panel row/group close calls only when `VW` is selected
- `messageListener.js` — internal-only route for guarded panel closes
- `panelHelper.js` — dynamic `VW` scope availability/error UI and Copy diagnostics
- `options.js` — one-line `VW` state mapping
- `background.js` — loads the Chromium Workspace helper and refreshes Workspace data on Chromium tab activation
- `manifest-c.json` — stable extension ID public key material
- `build/build.ps1` and `build/list.txt` — include `vivaldiWorkspace.js` in Chromium build inputs

`manifest-f.json` was restored to its upstream content. Firefox does not load the Vivaldi-specific helper and no Firefox manifest behavior is changed.

The Bridge accepts only the stable ID assigned to this fork:

`jkhljmjemfaeoklndkcnehbcnmfjcfam`

The manifest contains only the public key material required to derive this stable ID. Never commit or request a corresponding private key.

## Diagnostics

The maintainer requested that Workspace failures be visible and easy to report.

The implementation records a sanitized diagnostic in `chrome.storage.session` and logs a `DTC-VW-DIAGNOSTIC` warning. Diagnostic objects contain no tab URLs or browsing history.

Representative error codes include:

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

## Build state

The Chromium PowerShell build uses its own `$SingleFiles` list, not only `build/list.txt`. Both build inputs include `vivaldiWorkspace.js`.

The build script copies `manifest-c.json` to a temporary `manifest.json`, strips the development-only `externally_connectable` key from the packaged Chrome build, and creates `duplicate-tabs-closer-chrome.zip`.

ETAPA 4A confirmed that this build path works on the maintainer's machine and that the unpacked fork loads with the intended stable ID.

## Remaining validation / limitations

### Persistent Bridge installation

The Bridge has been proven through the Vivaldi UI DevTools console, but **persistent installation has not yet been confirmed in this handoff**.

Instructions were delivered for JavaScript-mod injection through `window.html` inside Vivaldi's `resources\vivaldi` UI directory. Browser updates can overwrite that modification.

If the persistent Bridge does not load, the feature must remain fail-closed and the diagnostic should be copied back to the development chat.

### Localization

The `VW` UI currently has safe English fallback strings. Proper locale messages can be added after runtime behavior is validated, with minimal localization churn.

### Automated validation

Upstream has no real npm automated test suite. No claim of full regression safety should be made before ETAPA 4B/5 runtime testing.

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
- direct row close under `VW`
- grouped row close under `VW`

## Documentation requirement from maintainer

This fork is explicitly documented as being developed through AI-assisted development / vibe-coding because the maintainer has limited technical/programming experience.

Future agents must give precise manual instructions when human intervention is required and must never assume the maintainer knows Git, browser-extension tooling, DevTools, or build commands.

See `AGENTS.md` for the exact manual-instruction format and approval gates.
