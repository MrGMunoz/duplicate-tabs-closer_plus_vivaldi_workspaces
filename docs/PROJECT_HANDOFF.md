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
- ETAPA 4B — persistent Vivaldi Workspace Bridge installation: **confirmed complete by maintainer**
- ETAPA 5A — observation-only Active Vivaldi Workspace isolation: **confirmed complete by maintainer**
- ETAPA 5B — first controlled manual `Close duplicates` under `VW`: **confirmed complete by maintainer**

Current stage:

- ETAPA 5 — real runtime validation: **in progress**
- ETAPA 5C is next: controlled direct-row close under `VW`, still with `On duplicate tab detected = Do nothing`.

Do not merge, release, publish, or open an upstream PR without explicit maintainer approval.

## Immediate resume checkpoint

ETAPA 4A was confirmed successful by the maintainer. Confirmed facts:

- branch used: `feature/vivaldi-workspace-scope`
- Chromium build completed successfully
- unpacked fork loaded successfully in Vivaldi
- fork extension ID confirmed exactly as `jkhljmjemfaeoklndkcnehbcnmfjcfam`
- original Duplicate Tabs Closer extension was disabled, not removed
- fork was left with `On duplicate tab detected = Do nothing`

ETAPA 4B was subsequently confirmed successful by the maintainer on 2026-08-24:

- persistent Bridge installed
- Vivaldi starts normally
- `Active Vivaldi Workspace` appears in Scope
- `VW` can be selected
- `On duplicate tab detected` remained `Do nothing`
- no Bridge error or warning appeared

ETAPA 5A observation-only testing then found:

- same test URL with one tab in Workspace A and one in Workspace B -> `NO DUPLICATES` under `VW` (expected isolation)
- adding a second and then third same-URL tab in Workspace A -> still `NO DUPLICATES` under `VW` (unexpected)
- switching only Scope to `Active Window` -> DTC detected all 4 same-URL tabs across A+B, proving the base duplicate engine works and that Vivaldi Workspaces share the same Chromium window
- direct read-only inspection in the Vivaldi UI context showed the four test tabs had correct Workspace metadata: three tabs had Workspace A ID `1786421728088`, one had Workspace B ID `1787604210876`
- scanning the same Vivaldi window found 56 tabs total, 55 with a Workspace ID and exactly 1 without one
- the one tab without `workspaceId` was tab `218526392`, a `chrome://` internal tab with `status = unloaded`, `discarded = true`, valid `vivExtData`, but no `workspaceId`
- its `restoreStatus` value was an opaque non-JSON string and is not used as a Workspace source

This identified the first bug: the Bridge previously treated any valid `vivExtData` without `workspaceId` as an unresolved read and rejected the entire query. Vivaldi can represent the default/non-custom Workspace by omitting `workspaceId`, so one such tab could make the whole `VW` scope appear to contain no duplicates.

First Bridge-only fix committed on the feature branch:

`d2d509ea7e416d78592b539ae8a81566cf34a355` — `Handle Vivaldi default workspace tabs in bridge`

That fix:

- introduces reserved internal sentinel `__dtc_vivaldi_default_workspace__`
- maps only **valid parsed `vivExtData` with an absent/null `workspaceId`** to that sentinel
- still fails closed if `vivExtData` itself is missing, malformed, the tab/window is inconsistent, or a non-null Workspace ID is invalid/not in Vivaldi's Workspace list
- rejects a collision if Vivaldi ever returns the reserved sentinel as a real Workspace ID
- if a query contains a default-Workspace sentinel, requires evidence that the window still exposes at least one recognized custom Workspace ID; this prevents a future API break that suddenly removes `workspaceId` everywhere from being interpreted as “all tabs are in default Workspace”
- does not modify `worker.js`, matching logic, priorities, or closing code
- keeps protocol version `1` because the extension already accepts bounded non-empty string Workspace IDs

That Bridge revision passed `node --check` syntax validation.

After installing that revision and restarting Vivaldi, the ETAPA 5A observation-only test still returned `NO DUPLICATES` in Workspace A; the Workspace B test tab remained open and no popup error/warning appeared. A direct read-only Bridge query against the same window then returned:

- `transportError = null`
- `totalTabs = 57`
- `testTabCount = 4`
- `ok = false`
- `reason = workspace-list-unavailable`
- zero returned tab metadata

This localized the second failure to the Bridge's Workspace-list read, before tab membership/matching.

A direct read-only Vivaldi UI probe then established the actual `vivaldi.prefs.get("vivaldi.workspaces.list")` shape in this runtime:

- `vivaldi.prefs.get` exists and has declared parameter count `0`
- direct invocation returns a thenable
- awaiting it yields an object with keys `defaultValue`, `store`, and `value`
- the actual Workspace list is the `.value` property, which is an array (observed length `7`)
- callback invocation returns the same wrapper object shape

The previous Bridge expected the returned preference itself to be an array, so the valid wrapper object was rejected as `workspace-list-unavailable`.

Second Bridge-only fix committed on the feature branch:

`60a2333e59efea4f2865b46dbb60adade862bc47` — `Handle wrapped Vivaldi workspace preferences`

That fix:

- adds a small `extractWorkspaceList` normalizer inside the read-only Bridge
- accepts either a direct array or an object with an own `.value` property that is an array
- returns `null` for every other shape, preserving fail-closed behavior
- leaves all existing per-Workspace ID validation unchanged
- does not modify `worker.js`, matching logic, priorities, or closing code

The diff was reviewed and is limited to `vivaldi-bridge/dtc-vivaldi-workspace-bridge.js`.

After installing the Bridge version containing `60a2333e59efea4f2865b46dbb60adade862bc47` and fully restarting Vivaldi, the maintainer repeated ETAPA 5A with the exact same test URL and layout:

- Workspace A: 3 identical test tabs
- Workspace B: 1 identical test tab
- active Workspace A
- `Scope = Active Vivaldi Workspace`
- `On duplicate tab detected = Do nothing`

ETAPA 5A result:

- Workspace A detected exactly 3
- Workspace B test tab remained open
- no Bridge error or warning appeared

Therefore **ETAPA 5A PASSED**.

ETAPA 5B then performed the first real manual close under `VW` using the same four tabs and still with `Do nothing`. With Workspace A active, the maintainer pressed `Close duplicates` once.

ETAPA 5B result:

- before close: DTC detected exactly 3 in Workspace A
- after close: exactly 1 test tab remained in Workspace A
- the Workspace B test tab remained open
- no Bridge error or warning appeared

Therefore **ETAPA 5B PASSED**. This validates the guarded manual batch-close path in this runtime for the tested A/B case.

The next manual action is **ETAPA 5C: controlled direct-row close under `VW`**. Recreate at least two identical test tabs in Workspace A while keeping the matching Workspace B tab, confirm DTC sees only the A duplicates, then close exactly one A row using its row X. Keep `On duplicate tab detected = Do nothing`. The B tab must remain untouched and no error/warning should appear.

Do not enable automatic close yet.

## ETAPA 4B persistent Bridge procedure

The persistent Bridge installation procedure used was:

1. Open `vivaldi://about` and confirm the current Vivaldi installation.
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

Vivaldi updates can overwrite this UI modification, so the Bridge may need to be reinstalled after an update.

## Repository relationship

Upstream: `Peuj/duplicate-tabs-closer`

Fork: `MrGMunoz/duplicate-tabs-closer_plus_vivaldi_workspaces`

The fork started from upstream `master` commit:

`214a60a3a6d587ae7a78a13a7911d08366e7c963`

Development branch was created from that exact commit.

At the start of this resumed validation the feature branch was 21 commits ahead of `master` and 0 behind; `master` remained exactly at the fork base commit above. Subsequent ETAPA 5 commits are on the feature branch only.

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

Runtime probes confirmed:

- Vivaldi returns real `workspaceId` values for custom-Workspace tabs
- Workspace A and Workspace B have different stable IDs
- switching Workspaces changes the active Workspace ID correctly
- a pinned tab retained its Workspace membership
- a valid Vivaldi tab may have parsed `vivExtData` with no `workspaceId`; this represents the default/non-custom Workspace state and must not automatically be treated as an API read failure
- `vivaldi.prefs.get("vivaldi.workspaces.list")` may return a wrapper object whose `.value` property is the actual Workspace-list array, in both Promise/thenable and callback use

Therefore the selected architecture remains:

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

Default/non-custom Workspace handling is explicit: only successfully parsed `vivExtData` with an absent/null `workspaceId` may map to the Bridge's reserved default-Workspace sentinel. Missing/malformed `vivExtData` remains a hard failure. The Bridge also requires custom-Workspace evidence when a sentinel is present so a broad Vivaldi API regression cannot silently collapse all tabs into the default Workspace.

Workspace-list preference handling is also explicit: the Bridge accepts only either a direct array or a wrapper object with an own `.value` property that is an array. Any other preference shape fails closed before Workspace membership is used.

The auto-navigation path separately validates the observed tab even if Chromium's URL-filtered candidate query temporarily omits that tab during navigation. This fixes the conservative navigation race found during code review without broadening the candidate set.

Popup/options direct row and group close actions are also guarded in `VW`: synchronous row/group `removeTab` calls are batched and routed back to an internal-only background message, then Workspace membership is revalidated before removal. Outside `VW`, the historical direct-close behavior remains unchanged.

## Implementation present on the branch

Main implementation files:

- `vivaldiWorkspace.js` — extension-side Bridge client, response validation, fail-closed diagnostics, navigation-required-tab validation, and guarded panel close handling
- `vivaldi-bridge/dtc-vivaldi-workspace-bridge.js` — read-only Vivaldi UI Bridge, including explicit default-Workspace sentinel handling and strict Workspace-list preference unwrapping
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

Bridge-side rejections such as `default-workspace-unverified` or `workspace-list-unavailable` are surfaced extension-side as a rejected Bridge response and therefore remain fail-closed.

## Build state

The Chromium PowerShell build uses its own `$SingleFiles` list, not only `build/list.txt`. Both build inputs include `vivaldiWorkspace.js`.

The build script copies `manifest-c.json` to a temporary `manifest.json`, strips the development-only `externally_connectable` key from the packaged Chrome build, and creates `duplicate-tabs-closer-chrome.zip`.

ETAPA 4A confirmed that this build path works on the maintainer's machine and that the unpacked fork loads with the intended stable ID.

The ETAPA 5 Bridge compatibility fixes change only the Vivaldi UI Bridge file. The installed Bridge containing `60a2333e59efea4f2865b46dbb60adade862bc47` was revalidated successfully in ETAPA 5A; no Chromium extension rebuild was required for that Bridge-only update.

## Remaining validation / limitations

### ETAPA 5A — passed

Observation-only A/B isolation passed after installing the wrapped-preference Bridge fix:

- Workspace A: 3 identical test tabs detected
- Workspace B: matching tab excluded and remained open
- no Bridge error/warning

### ETAPA 5B — passed

First controlled manual `Close duplicates` under `VW` passed:

- 3 duplicates detected in Workspace A before close
- exactly 2 closed in A, leaving 1
- matching Workspace B tab remained open
- no Bridge error/warning

### ETAPA 5C — next

Test the guarded direct-row close path under `VW` while keeping `Do nothing`:

- recreate at least 2 identical test tabs in Workspace A
- keep the matching test tab in Workspace B
- active Workspace A
- confirm only A duplicates are listed
- press exactly one row X for an A tab
- expect exactly that A tab to close, the other A tab to remain, the B tab to remain, and no error/warning

Do not enable automatic close yet.

### Localization

The `VW` UI currently has safe English fallback strings. Proper locale messages can be added after runtime behavior is validated, with minimal localization churn.

### Automated validation

Upstream has no real npm automated test suite. No claim of full regression safety should be made before ETAPA 5 runtime testing is substantially complete.

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
- default/non-custom Workspace
- direct row close under `VW`
- grouped row close under `VW`

## Documentation requirement from maintainer

This fork is explicitly documented as being developed through AI-assisted development / vibe-coding because the maintainer has limited technical/programming experience.

Future agents must give precise manual instructions when human intervention is required and must never assume the maintainer knows Git, browser-extension tooling, DevTools, or build commands.

See `AGENTS.md` for the exact manual-instruction format and approval gates.
