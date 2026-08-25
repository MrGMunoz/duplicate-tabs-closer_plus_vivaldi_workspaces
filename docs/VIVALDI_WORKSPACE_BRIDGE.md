# Vivaldi Workspace Bridge

## What this is

Vivaldi Workspaces are not exposed to a normal Chromium extension through the standard `chrome.tabs` API.

This fork therefore uses a very small Vivaldi-specific JavaScript Bridge that runs inside Vivaldi's own UI context. The Bridge only reads Workspace metadata and returns it to the Duplicate Tabs Closer fork.

Architecture:

`Duplicate Tabs Closer fork -> Vivaldi Workspace Bridge -> Vivaldi internal Workspace metadata`

## Safety properties

The Bridge is intentionally read-only.

It must never:

- close tabs
- move tabs
- activate tabs
- edit tab URLs
- change Workspaces
- change browser preferences

It only answers validated metadata queries.

The Duplicate Tabs Closer fork remains responsible for all duplicate detection and close decisions.

If the Bridge is missing, times out, returns malformed data, returns a different protocol version, cannot resolve the active Workspace, or reports inconsistent tab membership, the `VW` scope must close zero tabs.

## Extension identity

The Bridge only accepts external messages from the stable ID assigned to this fork:

`jkhljmjemfaeoklndkcnehbcnmfjcfam`

The Chromium manifest contains public key material so the unpacked development extension keeps this ID stable.

Do not commit any private key.

## Protocol

Current protocol version: `1`.

Supported actions:

- `DTC_VIVALDI_WORKSPACE_PING`
- `DTC_VIVALDI_WORKSPACE_QUERY`

Queries include:

- protocol version
- request ID
- Vivaldi window ID
- exact tab IDs to inspect

Successful responses include:

- protocol version
- same request ID
- same requested window ID
- one active tab ID
- one active Workspace ID
- one metadata record per requested tab

The extension rejects responses that do not match the request exactly.

### Default / non-custom Workspace

Real ETAPA 5 runtime testing showed that Vivaldi can return successfully parsed `vivExtData` with no `workspaceId`. This is a valid representation of the default/non-custom Workspace and is different from a failed metadata read.

The Bridge therefore maps only this exact case to a reserved internal string:

`__dtc_vivaldi_default_workspace__`

This remains protocol version `1` because protocol v1 already accepts bounded non-empty string Workspace IDs.

Safety rules for this state:

- missing or malformed `vivExtData` is still a hard failure
- an explicit non-null Workspace ID must still be valid and present in `vivaldi.workspaces.list`
- the reserved sentinel must not collide with a real Workspace ID
- whenever a query includes the default-Workspace sentinel, the Bridge requires evidence that the same Vivaldi window still exposes at least one recognized custom Workspace ID; otherwise it rejects the query as `default-workspace-unverified`

That extra evidence check prevents a future Vivaldi API regression that removes `workspaceId` everywhere from being mistaken for “all tabs are in the default Workspace”.

### Workspace-list preference shape

Real ETAPA 5 runtime testing also showed that `vivaldi.prefs.get("vivaldi.workspaces.list")` does not necessarily return the Workspace array directly.

In Vivaldi 8.1.4087.70 / Chromium 150.0.7871.253, both the thenable/Promise-style result and the callback result returned an object with keys:

- `defaultValue`
- `store`
- `value`

The actual Workspace list was the `.value` property, which was an array (observed length `7`).

The Bridge therefore accepts only these two preference shapes:

- a direct array
- an object with an own `.value` property whose value is an array

Every other shape returns `null` and remains fail-closed. The extracted array is still subjected to all existing Workspace-ID validation; unwrapping the preference does not relax ID validation.

## Fail-closed diagnostics

Workspace failures are stored temporarily in `chrome.storage.session` as a small diagnostic object and are also logged with prefix:

`DTC-VW-DIAGNOSTIC`

Diagnostics are designed to be safe to paste into a support/development chat. They must not contain tab URLs or browsing history.

Example shape:

```json
{
  "code": "VW-BRIDGE-TIMEOUT",
  "at": "2026-08-24T00:00:00.000Z",
  "protocolVersion": 1,
  "extensionVersion": "4.2.9",
  "details": {
    "operation": "filter"
  }
}
```

When `VW` is selected, popup/options should display a short error and a **Copy diagnostics** action if a diagnostic exists.

Bridge-side rejection reasons, including `default-workspace-unverified` and `workspace-list-unavailable`, are surfaced extension-side as rejected Bridge responses and remain fail-closed.

## Installation status

**Persistent Bridge installation was confirmed working by the maintainer on 2026-08-24.**

Confirmed runtime facts:

- Vivaldi starts normally with the persistent UI mod installed
- `Active Vivaldi Workspace` appears in Scope
- `VW` can be selected while `On duplicate tab detected = Do nothing`
- no Bridge unavailable/error warning appeared during ETAPA 4B validation

The repository contains the persistent Bridge source at:

`vivaldi-bridge/dtc-vivaldi-workspace-bridge.js`

The installation procedure is:

1. Find the current Vivaldi installation's `resources\vivaldi` directory and verify `window.html` exists.
2. Back up `window.html` as `window.html.dtc-backup`.
3. Create `resources\vivaldi\dtc-mods`.
4. Copy `vivaldi-bridge/dtc-vivaldi-workspace-bridge.js` to that folder.
5. Fully close Vivaldi.
6. Add this exact line immediately before `</body>` in `window.html`:

```html
<script src="dtc-mods/dtc-vivaldi-workspace-bridge.js"></script>
```

7. Save and reopen Vivaldi.
8. Keep `On duplicate tab detected = Do nothing`.
9. Verify `Active Vivaldi Workspace` appears in Scope.
10. Select it only while still in `Do nothing` mode and verify no Bridge-unavailable diagnostic appears.

Do not proceed to closing real duplicate tabs until observation-only Workspace filtering tests pass.

## Update behavior

Vivaldi UI mods depend on internal browser files/APIs and may be removed or broken by a Vivaldi update.

This is an accepted limitation only because the fork is fail-closed:

- if an update removes the Bridge -> `VW` closes zero tabs
- if an update changes the API -> invalid response -> `VW` closes zero tabs
- if the protocol no longer matches -> `VW` closes zero tabs

The UI should make the failure visible and provide diagnostics.

If only the Bridge source changes, the Chromium extension itself does not need to be rebuilt. Replace the installed Bridge copy and fully restart Vivaldi so the new listener code is loaded.

## Real-runtime evidence established

In Vivaldi 8.1.4087.70 / Chromium 150.0.7871.253:

- the normal extension service worker could not access `globalThis.vivaldi`
- the normal `chrome.tabs.Tab` object did not expose `vivExtData` or `workspaceId`
- the Vivaldi UI context did expose `vivaldi.prefs.get` and `vivaldi.tabsPrivate.get`
- external messaging from Duplicate Tabs Closer to the Vivaldi UI context worked
- Vivaldi returned distinct Workspace IDs for two test Workspaces
- switching Workspaces changed the active Workspace ID correctly
- a pinned tab retained its Workspace membership
- Workspaces in the same Vivaldi window share the same Chromium `windowId`, so `windowId` is not a safe Workspace substitute
- an ETAPA 5 test window with 56 tabs had 55 tabs with custom Workspace IDs and exactly one valid discarded internal tab whose parsed `vivExtData` omitted `workspaceId`
- three same-URL tabs in Workspace A and one same-URL tab in Workspace B were all detected by normal `Active Window`, proving the base duplicate engine worked
- after the default-Workspace fix was installed, a direct Bridge query against a 57-tab window still failed safely with `workspace-list-unavailable` before returning tab metadata
- direct UI probing showed `vivaldi.prefs.get("vivaldi.workspaces.list")` returned a wrapper object with the actual array in `.value`, for both awaited direct invocation and callback invocation

These results are why the Bridge architecture remains necessary, why default/non-custom Workspace membership must be represented explicitly, and why Workspace-list preference values must be unwrapped narrowly rather than assumed to be raw arrays.

## Current ETAPA 5 checkpoint

First Bridge compatibility fix:

`d2d509ea7e416d78592b539ae8a81566cf34a355` — `Handle Vivaldi default workspace tabs in bridge`

Latest Bridge compatibility fix:

`60a2333e59efea4f2865b46dbb60adade862bc47` — `Handle wrapped Vivaldi workspace preferences`

The latest change is Bridge-only. It accepts the observed wrapped Workspace preference while preserving fail-closed behavior for any unrecognized shape. It requires runtime re-validation after replacing the installed Bridge file and fully restarting Vivaldi.

Expected observation-only re-test with active Workspace A:

- three identical test tabs in A -> detected as a duplicate group of 3
- one identical test tab in B -> excluded
- no automatic closing
- no Bridge warning

Do not advance to close testing until this re-test passes.
