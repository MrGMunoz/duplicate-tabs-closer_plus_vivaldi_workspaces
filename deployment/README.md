# Vivaldi deployment: persistent Bridge + Unlisted Web Store package

This directory contains the deployment layer for the Vivaldi Workspace fork. It does not change duplicate-matching behavior.

## Goals

1. Keep the Vivaldi Workspace Bridge source outside Vivaldi's versioned installation directories.
2. Automatically restore the Bridge injection when a Vivaldi update creates/replaces `resources\vivaldi\window.html`.
3. Prepare the extension for normal installation through an **Unlisted Chrome Web Store item**, so day-to-day use does not require Vivaldi Developer mode.
4. Preserve FAIL CLOSED behavior if Vivaldi changes an internal API and the Bridge becomes incompatible.
5. Keep maintenance invisible and non-disruptive during normal desktop use.
6. Never require the maintainer to close or restart Vivaldi as part of installation, repair, validation, or deployment steps. If a Bridge change needs a fresh Vivaldi UI process to become active, install it on disk now and defer activation until the maintainer's next natural browser restart.

## Why there are two deployment pieces

The Chromium extension and the Vivaldi UI Bridge are separate components.

- Chrome Web Store can install/update the extension normally in Vivaldi.
- Chrome Web Store cannot install the Vivaldi UI Bridge because that Bridge runs in Vivaldi's internal UI context.
- Therefore the Bridge needs a small local repair helper even when the extension itself is store-installed.

## Persistent Bridge location

The installer stores the source-of-truth Bridge copy here:

`%LOCALAPPDATA%\DTC-Vivaldi-Workspace\bridge\dtc-vivaldi-workspace-bridge.js`

Vivaldi updates do not own this directory and should not overwrite it.

The repair helper is installed here:

`%LOCALAPPDATA%\DTC-Vivaldi-Workspace\tools\Repair-VivaldiBridge.ps1`

The console-free Scheduled Task launcher is installed here:

`%LOCALAPPDATA%\DTC-Vivaldi-Workspace\tools\Run-VivaldiBridgeRepairHidden.vbs`

Logs are written to:

`%LOCALAPPDATA%\DTC-Vivaldi-Workspace\logs\bridge-repair.log`

## Automatic repair

`Install-VivaldiBridgeRepair.ps1`:

- requests elevation once so both per-user and Program Files Vivaldi installs can be repaired;
- copies the Bridge, repair helper, and hidden launcher to the stable location above;
- performs an immediate on-disk repair without stopping Vivaldi;
- registers Scheduled Task `DTC Vivaldi Workspace Bridge Repair`;
- checks at user logon and once per hour;
- launches periodic checks through `wscript.exe`, not directly through `powershell.exe`, so no PowerShell console should flash or steal focus;
- is idempotent: when the current Bridge copy and `window.html` injection are already correct, it does not rewrite them;
- never terminates, restarts, or otherwise interrupts Vivaldi.

The original deployment draft launched `powershell.exe` directly every 15 minutes. Real desktop testing showed that Windows could briefly display the console before `-WindowStyle Hidden` took effect. That design is superseded by the console-free WScript launcher and hourly cadence.

For each detected version directory it:

1. finds `resources\vivaldi\window.html`;
2. creates `window.html.dtc-backup` if no backup exists;
3. creates/updates `resources\vivaldi\dtc-mods\dtc-vivaldi-workspace-bridge.js` from the persistent source;
4. injects exactly one `<script src="dtc-mods/dtc-vivaldi-workspace-bridge.js"></script>` before `</body>` if missing.

If Vivaldi is already running, these on-disk changes may not become active in the current Vivaldi UI process. This is expected. Do **not** close or restart Vivaldi just to validate the repair. The Bridge should become active automatically the next time the maintainer naturally starts Vivaldi.

A Vivaldi update may still break the internal APIs used by the Bridge. This automation deliberately does **not** attempt to guess compatibility. The existing extension diagnostics and FAIL CLOSED behavior remain the safety mechanism for API changes.

## Install or update Bridge persistence

From the repository root in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\deployment\Install-VivaldiBridgeRepair.ps1
```

Running the installer again is the supported upgrade path for the deployment helper. It replaces the existing Scheduled Task with the current definition, so installations made with the older visible/15-minute task are upgraded in place. Vivaldi does not need to be closed.

After Chrome Web Store assigns the Unlisted extension an ID, reinstall/update the persistent Bridge authorization with:

```powershell
powershell -ExecutionPolicy Bypass -File .\deployment\Install-VivaldiBridgeRepair.ps1 -StoreExtensionId <32-character-store-id>
```

The Bridge then accepts only:

- the existing stable development ID `jkhljmjemfaeoklndkcnehbcnmfjcfam`, and
- the exact supplied Chrome Web Store ID.

No wildcard sender authorization is introduced.

## Remove Bridge persistence

```powershell
powershell -ExecutionPolicy Bypass -File .\deployment\Uninstall-VivaldiBridgeRepair.ps1
```

The uninstaller removes the scheduled task, installed Bridge copies and injected script line. Existing `window.html.dtc-backup` files are intentionally preserved.

## Build the Unlisted Chrome Web Store upload package

```powershell
powershell -ExecutionPolicy Bypass -File .\build\build.ps1 -Target vivaldi-store
```

Output:

`duplicate-tabs-closer-vivaldi-unlisted.zip`

The package strips the DEV-only `externally_connectable` wildcard.

## Important Chrome Web Store constraint

On Windows, a locally self-hosted `.crx` is not a normal consumer installation path. Chromium officially supports direct normal-user installation through Chrome Web Store; self-hosted Windows installation requires enterprise policy.

Therefore **Unlisted** means:

- upload this ZIP to Chrome Web Store;
- set visibility to **Unlisted**;
- pass Web Store review;
- install it in Vivaldi through the item's direct Web Store URL.

It does not mean a local hidden `.crx` installer.

## Chrome Web Store ID and existing settings

The current unpacked fork has stable development ID:

`jkhljmjemfaeoklndkcnehbcnmfjcfam`

The Chrome Web Store may assign a different item ID. If it does, two consequences must be handled during the one-time migration:

1. run `Install-VivaldiBridgeRepair.ps1 -StoreExtensionId <new-id>` so the Bridge authorizes the store build;
2. migrate/re-enter the extension settings because `chrome.storage.local` is scoped to the extension ID.

Do not remove an existing unpacked extension until the store build is installed, the Bridge is healthy, and the desired settings have been verified.

A future migration helper may automate the settings transfer, but this deployment change does not silently copy or expose settings between extension identities.

## Validation status

These deployment scripts are newly added and must be runtime-tested on the maintainer's Windows/Vivaldi installation before being considered validated. Core `VW` behavior remains separate and unchanged. Validation must not require a forced Vivaldi shutdown or restart; any Bridge activation that needs a new browser process is deferred until the next natural restart.
