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

## Installation status

**Persistent Bridge installation is not yet considered validated.**

During ETAPA 2 the Bridge concept was proven manually by opening Vivaldi's internal UI DevTools through:

`vivaldi://inspect/#apps`

and temporarily installing an in-memory message listener in the Vivaldi UI console.

That experiment successfully returned real Workspace IDs to Duplicate Tabs Closer.

The repository contains the persistent Bridge source at:

`vivaldi-bridge/dtc-vivaldi-workspace-bridge.js`

### Latest checkpoint

ETAPA 4A was confirmed complete: the Chromium build succeeded, the unpacked fork loaded in Vivaldi, and the stable extension ID was verified as `jkhljmjemfaeoklndkcnehbcnmfjcfam`.

ETAPA 4B persistent-install instructions were delivered, but **the repository does not yet know whether the maintainer executed them**. The previous conversation was a temporary chat and may have ended when Vivaldi was closed.

Therefore a future agent must not assume that `window.html` was edited, that the Bridge file was copied, that Vivaldi was restarted, or that `Active Vivaldi Workspace` appeared in the UI.

The next chat should first establish whether ETAPA 4B was not started, succeeded, failed, or is uncertain.

### Procedure that was already given

The intended installation procedure is:

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

Do not proceed to closing real duplicate tabs until this persistent installation is positively verified.

## Update behavior

Vivaldi UI mods depend on internal browser files/APIs and may be removed or broken by a Vivaldi update.

This is an accepted limitation only because the fork is fail-closed:

- if an update removes the Bridge -> `VW` closes zero tabs
- if an update changes the API -> invalid response -> `VW` closes zero tabs
- if the protocol no longer matches -> `VW` closes zero tabs

The UI should make the failure visible and provide diagnostics.

## Real-runtime evidence already established

In Vivaldi 8.1.4087.70 / Chromium 150.0.7871.253:

- the normal extension service worker could not access `globalThis.vivaldi`
- the normal `chrome.tabs.Tab` object did not expose `vivExtData` or `workspaceId`
- the Vivaldi UI context did expose `vivaldi.prefs.get` and `vivaldi.tabsPrivate.get`
- external messaging from Duplicate Tabs Closer to the Vivaldi UI context worked
- Vivaldi returned distinct Workspace IDs for two test Workspaces
- switching Workspaces changed the active Workspace ID correctly
- a pinned tab retained its Workspace membership

These results are why the Bridge architecture was selected over unsafe `windowId`/`groupId` heuristics.
