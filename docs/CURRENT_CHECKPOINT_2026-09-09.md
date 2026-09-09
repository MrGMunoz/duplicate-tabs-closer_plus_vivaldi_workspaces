# Current checkpoint — 2026-09-09

This is the authoritative resume point for the next maintenance/deployment session on `feature/vivaldi-workspace-scope`.

## Maintainer constraint: do not interrupt Vivaldi

The maintainer currently has long-running work in Vivaldi and cannot close/restart/interupt it for this project.

Treat this as a non-negotiable operating rule:

- never require Vivaldi to be closed or restarted for installation, repair, validation, or deployment;
- if a change only becomes active in a fresh Vivaldi UI process, install it on disk now and leave activation pending until the maintainer's next natural restart;
- do not use restart as a test step;
- maintenance tasks must be invisible and must not steal focus.

## Deployment direction changed: private/local only

The maintainer clarified that this extension is for personal use on one Windows/Vivaldi machine.

Chrome Web Store / Unlisted publication is abandoned unless the maintainer explicitly changes this decision.

Do not ask the maintainer to:

- pay the Chrome Web Store developer registration fee;
- create a Web Store item;
- publish or distribute the extension merely to install it on their own PC.

Preferred next deployment investigation:

`private signed/self-hosted CRX -> local stable storage -> Vivaldi/Chromium managed-extension policy (if supported) -> persistent normal installation`

The first feasibility check when deployment work resumes is `vivaldi://policy`, especially whether the installed Vivaldi accepts the required Vivaldi-scoped `ExtensionInstallForcelist` behavior. This policy path is not yet runtime-validated on the maintainer's machine.

See `docs/PRIVATE_LOCAL_DEPLOYMENT_PLAN.md` for the longer roadmap.

## Persistent Bridge repair: runtime validated

Persistent source-of-truth is outside Vivaldi's versioned installation directories under:

`%LOCALAPPDATA%\DTC-Vivaldi-Workspace\`

Important files:

- `bridge\dtc-vivaldi-workspace-bridge.js`
- `tools\Repair-VivaldiBridge.ps1`
- `tools\Run-VivaldiBridgeRepairHidden.vbs`
- `logs\bridge-repair.log`

Scheduled Task:

`DTC Vivaldi Workspace Bridge Repair`

Validated current task design:

- action uses `wscript.exe`, not direct `powershell.exe`;
- no PowerShell/console window appeared during manual execution;
- cadence is logon + once per hour (old 15-minute design is superseded);
- manual execution returned `0x0`;
- task is idempotent and does not close/restart Vivaldi.

The old design that directly launched PowerShell every 15 minutes was disruptive because a console window briefly stole focus. Do not restore that design.

## Temporary extension build/load: runtime validated

The maintainer downloaded the correct branch and successfully built:

`powershell -NoProfile -ExecutionPolicy Bypass -File .\build\build.ps1 -Target vivaldi-store`

Artifact:

`duplicate-tabs-closer-vivaldi-unlisted.zip`

The name still reflects the abandoned Web Store direction; do not interpret the name as current deployment intent.

Runtime validation:

- ZIP built successfully;
- extracted package contained `manifest.json`;
- unpacked package loaded successfully in Vivaldi Developer Mode;
- no load error was reported;
- extension ID is the expected stable development ID:
  `jkhljmjemfaeoklndkcnehbcnmfjcfam`.

The unpacked extension is currently a temporary test installation. Do not remove it until a private/local persistent installation path has been designed and validated.

## `getTab: No tab with id` diagnostic noise fix

During extension reload/testing, Vivaldi surfaced an extension error similar to:

`getTab error: No tab with id: 218583081.`

Interpretation:

- this is an expected asynchronous race: DTC asked for a tab that disappeared before `chrome.tabs.get` completed;
- `getTab` already returned `null`, so this was diagnostic noise rather than evidence that the extension was broken.

Repo fix:

`8a5e886766a406fb6e32f9b1cdb513a5210168dc` — suppress `No tab with id` logging while preserving logging for other `chrome.tabs.get` failures.

Important current-state nuance:

- the repo contains the fix;
- the maintainer's currently loaded unpacked build may still be the pre-fix build until a later rebuild/reload;
- seeing this exact stale error in the current temporary build is not by itself a reason to interrupt Vivaldi.

## Why `Active Vivaldi Workspace` initially disappeared in the current session

The persistent Bridge files/injection were repaired on disk while Vivaldi was already running.

The popup's `Active Vivaldi Workspace` option is dynamically exposed only when the extension can successfully ping the Vivaldi UI Bridge. Because the current Vivaldi UI process had started before the Bridge was repaired, reloading only the DTC extension did not load the Bridge into the already-running Vivaldi UI process.

Observed symptom:

- DTC itself loaded and worked;
- `Active Vivaldi Workspace` did not appear in Scope;
- reloading the extension alone did not solve it.

This was not caused by the `No tab with id` race.

## Validated no-restart recovery for the current Vivaldi session

A hot-load workaround was successfully used, with **no Vivaldi restart**.

Procedure used:

1. Open `vivaldi://inspect/#apps`.
2. Find Vivaldi app entries with URL:
   `chrome-extension://mpognobbkildjkofajifpdfhcoklimli/window.html`
3. There may be multiple `window.html` entries when multiple Vivaldi windows are open. Do not use `main.html` for this Bridge load.
4. Inspect one `window.html` context.
5. In that Vivaldi UI DevTools Console, execute:

```javascript
(() => {
    const previous = document.getElementById("dtc-vivaldi-workspace-bridge-live");
    if (previous) previous.remove();

    const script = document.createElement("script");
    script.id = "dtc-vivaldi-workspace-bridge-live";
    script.src = "dtc-mods/dtc-vivaldi-workspace-bridge.js?live=" + Date.now();

    script.onload = () => console.log("DTC Vivaldi Workspace Bridge: LOADED");
    script.onerror = (e) => console.error("DTC Vivaldi Workspace Bridge: LOAD FAILED", e);

    (document.head || document.documentElement).appendChild(script);
})();
```

6. Expected console result:
   `DTC Vivaldi Workspace Bridge: LOADED`
7. Close/reopen only the DTC popup; do not restart Vivaldi.
8. `Active Vivaldi Workspace` should then appear in Scope.
9. If a chosen `window.html` does not affect the relevant DTC window, inspect the next `window.html` entry and repeat; stop as soon as Scope shows `Active Vivaldi Workspace`.

Runtime result on 2026-09-09:

- hot-load succeeded;
- `Active Vivaldi Workspace` appeared again;
- the maintainer reported that the extension was working correctly afterward;
- Vivaldi was not closed or restarted.

The Bridge source itself removes a previously registered DTC Bridge listener before adding the current listener, so hot-loading the Bridge does not intentionally accumulate duplicate DTC external-message listeners.

## Critical distinction: session hot-load vs persistent startup

The hot-load above is only a current-session recovery mechanism.

Current state is therefore:

- persistent Bridge source on disk: installed;
- scheduled repair: installed and validated;
- `window.html` on-disk injection: repaired;
- Bridge active in the current already-running Vivaldi session: yes, via hot-load;
- automatic Bridge activation after a fresh/natural Vivaldi start: **still pending validation**.

Do not mark startup persistence passed merely because the hot-loaded current session works.

At the maintainer's next natural Vivaldi restart (for unrelated reasons), pass criteria are:

1. do not manually inject anything first;
2. open DTC normally;
3. verify `Active Vivaldi Workspace` appears automatically;
4. verify no Bridge unavailable/rejected diagnostic;
5. optionally perform the already-established observation-only same-Workspace/cross-Workspace sanity check;
6. if it fails, inspect the silent repair log and on-disk injection before asking for any restart.

## Current functional state at pause

At the end of the 2026-09-09 session:

- Vivaldi remains open and must not be interrupted;
- DTC temporary unpacked extension is loaded;
- `Active Vivaldi Workspace` is visible and functioning after current-session hot-load;
- persistent Bridge repair task is enabled, silent, hourly, and last tested with result `0x0`;
- Chrome Web Store work is abandoned;
- private/local deployment remains unfinished;
- the exact `No tab with id` noise fix exists in repo but may not yet be in the currently loaded unpacked build.

## Next work, in priority order

When the maintainer has time again:

1. **Do not redo today's Bridge/task/build diagnosis.** Start from this file.
2. If Vivaldi has naturally restarted since this checkpoint, first check whether `Active Vivaldi Workspace` appeared automatically; record pass/fail for persistent startup.
3. If current DTC build still predates commit `8a5e886...`, rebuild/reload the unpacked extension when convenient; this does not require restarting Vivaldi.
4. Resume private deployment feasibility at `vivaldi://policy`.
5. Verify Vivaldi-specific managed extension policy support before implementing CRX/policy automation.
6. If viable, design private signing/key storage and local CRX/update layout. Never commit or paste a private key into chat.
7. Preserve the stable extension identity if possible; if an ID change becomes unavoidable, explicitly plan settings/Bridge authorization migration first.
8. Keep automatic-close-under-`VW` classified as not runtime-validated until separately tested.

## Safety / approval reminders

Do not:

- modify `master`;
- publish to Chrome Web Store;
- merge/release/version-bump;
- create or commit private keys;
- force a Vivaldi restart;
- introduce broad enterprise policy, a resident web server/service, native messaging, or another major deployment mechanism without explicit maintainer approval.
