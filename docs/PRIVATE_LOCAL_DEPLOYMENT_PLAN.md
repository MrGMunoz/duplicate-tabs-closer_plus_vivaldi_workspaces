# Private local deployment plan

## Decision / pause point

The maintainer clarified that this fork is for **personal use on one Windows/Vivaldi machine**. The deployment goal is therefore no longer Chrome Web Store publication, including Unlisted publication.

Do **not** require the maintainer to pay a Chrome Web Store developer fee, create a public/unlisted store item, or share the extension with other users merely to obtain a persistent personal installation.

Current target:

- private/local installation only;
- no Chrome Web Store dependency;
- no publication fee;
- no daily Developer mode requirement if a supported policy-based path can be made to work;
- stable extension identity across updates;
- persistent settings;
- persistent/read-only Vivaldi Workspace Bridge;
- silent maintenance;
- no forced Vivaldi shutdown or restart.

## Non-negotiable runtime constraint

The maintainer currently cannot interrupt Vivaldi. Installation, repair, validation, and deployment work must therefore **never require Vivaldi to be closed or restarted**.

If an on-disk Bridge change needs a fresh Vivaldi UI process before it becomes active, install the change on disk and leave activation pending until the maintainer's next natural restart. Do not use restart as a validation step.

## What has already been implemented and runtime-validated

### Persistent Bridge source

Installed outside Vivaldi's versioned application directories under:

`%LOCALAPPDATA%\DTC-Vivaldi-Workspace\`

Important files:

- `bridge\dtc-vivaldi-workspace-bridge.js`
- `tools\Repair-VivaldiBridge.ps1`
- `tools\Run-VivaldiBridgeRepairHidden.vbs`
- `logs\bridge-repair.log`
- `config.json` when persistent deployment configuration exists

### Automatic Bridge repair

Scheduled Task:

`DTC Vivaldi Workspace Bridge Repair`

Current design:

- launches through `wscript.exe`, not directly through `powershell.exe`;
- console-free during normal execution;
- checks at user logon and once per hour;
- idempotently restores the Bridge copy/injection after Vivaldi version changes;
- does not terminate or restart Vivaldi.

Runtime result on the maintainer's current Windows user profile:

- manual task execution was invisible;
- no PowerShell console appeared;
- Last Run Result was `0x0`.

The earlier design that invoked PowerShell directly every 15 minutes was disruptive and is superseded.

### Current extension build / temporary load

The current development build can be produced with:

`powershell -NoProfile -ExecutionPolicy Bypass -File .\build\build.ps1 -Target vivaldi-store`

Current artifact:

`duplicate-tabs-closer-vivaldi-unlisted.zip`

Although the target/artifact name still says `vivaldi-store`/`unlisted`, the Web Store deployment direction has now been abandoned. The package remains useful as validated Chromium extension contents until the build naming/deployment layer is refactored for private CRX packaging.

Runtime validation confirmed:

- build succeeded;
- ZIP was produced;
- extracted package contains `manifest.json`;
- unpacked build loaded successfully in Vivaldi;
- no extension-page load error was reported;
- development extension ID is the expected stable ID:
  `jkhljmjemfaeoklndkcnehbcnmfjcfam`.

## Chrome Web Store path: abandoned for this maintainer

The previously considered Chrome Web Store Unlisted path is no longer the desired deployment method because:

- the maintainer does not want to distribute the extension;
- the extension is for personal use only;
- store developer registration may require payment;
- paying/publishing solely to keep a personal extension installed is unnecessary if a safe local managed-install path is available.

Do not resume Web Store publication unless the maintainer explicitly changes this decision.

## Preferred next architecture to investigate

The next deployment direction is a **private signed/self-hosted CRX plus local Vivaldi/Chromium extension policy**, if the installed Vivaldi version supports the required policy behavior on this personal Windows machine.

Candidate architecture:

`private signed CRX -> local stable storage -> Vivaldi ExtensionInstallForcelist/policy -> normal persistent installation`

plus the already implemented:

`persistent Bridge master copy -> silent scheduled repair -> Vivaldi UI resources`

Important: this policy path is **not yet validated** on the maintainer's actual Vivaldi installation. Do not implement a large policy/deployment mechanism before the small feasibility check below.

## Next steps when work resumes

### Step 1 - Check Vivaldi policy support without restarting Vivaldi

Open:

`vivaldi://policy`

Determine whether Vivaldi exposes/accepts the Chromium-style policy needed for managed extension installation, especially `ExtensionInstallForcelist` (or the exact Vivaldi equivalent if documented by the installed version).

This check must not require closing Vivaldi.

### Step 2 - Decide the private installation mechanism

If the required extension policy is supported on this machine:

1. design the smallest Windows policy change needed for this one extension;
2. keep it scoped to Vivaldi, not Chrome/Edge unless technically unavoidable and explicitly approved;
3. avoid broad enterprise-management changes;
4. make the change reversible;
5. preserve the user's normal Vivaldi profile and settings;
6. verify whether policy refresh can occur without restarting Vivaldi; if a fresh browser process is required, leave activation pending until a natural restart.

If the required policy is not supported:

- do not fall back automatically to Chrome Web Store;
- evaluate the next least-invasive personal-install alternative;
- Developer Mode/unpacked remains the temporary fallback, not the desired final state.

### Step 3 - Private signing / stable identity

If a self-hosted CRX path is viable, generate/sign it locally on the maintainer's PC.

Private key rules:

- the private key must never be committed to GitHub;
- the maintainer must never paste/send the private key into chat;
- store it only in a private local location, potentially under `%LOCALAPPDATA%\DTC-Vivaldi-Workspace\keys\` or another protected local path;
- use the same key for future builds so the extension ID remains stable.

Before changing IDs, determine whether retaining the already-tested stable development ID `jkhljmjemfaeoklndkcnehbcnmfjcfam` is possible and desirable. Do not assume an ID migration is necessary.

### Step 4 - Local package/update layout

If self-hosting is viable, design a minimal local layout such as:

`%LOCALAPPDATA%\DTC-Vivaldi-Workspace\extension\`

containing the signed CRX and any required update manifest/source metadata.

Do not add a resident local web server, Windows service, native messaging host, or similarly invasive dependency unless the simpler supported mechanisms have been ruled out and the maintainer explicitly approves the architecture change.

### Step 5 - Bridge authorization

The Bridge must continue to accept only explicitly authorized extension IDs. Never introduce a wildcard sender authorization for production/personal deployment.

If the final private CRX has a different ID, update the persistent Bridge authorization deliberately and test fail-closed behavior.

### Step 6 - Settings persistence

The final installation must preserve extension options across Vivaldi updates. `chrome.storage.local` is scoped to extension identity, so stable ID is important.

If an unavoidable ID migration occurs, design a one-time explicit settings migration or re-entry path before deleting the temporary unpacked installation.

### Step 7 - Final validation

Validate, without forcing a Vivaldi restart:

- extension installation persists;
- extension ID is stable;
- options persist;
- scheduled Bridge repair remains invisible and returns success;
- no Developer Mode is required for day-to-day use if policy installation succeeds;
- Vivaldi updates do not remove the extension;
- missing/stale/incompatible Bridge remains fail-closed with a visible diagnostic;
- any component that only activates after a fresh Vivaldi UI process is left pending until the maintainer naturally restarts Vivaldi.

## Current temporary state

At the pause point:

- the Bridge persistence layer is installed;
- the silent hourly repair task is enabled and validated (`0x0`, no visible console);
- the extension is temporarily loaded unpacked in Vivaldi for testing;
- Vivaldi must remain open and uninterrupted;
- Chrome Web Store work must not continue;
- next investigation starts at `vivaldi://policy` when the maintainer has time.
