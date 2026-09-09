"use strict";

// Duplicate Tabs Closer - Vivaldi Workspace Bridge
//
// This file is a Vivaldi UI JavaScript mod. It is deliberately read-only:
// it exposes Workspace membership to the companion fork and never closes,
// moves, activates or edits tabs.
(() => {
    // The first ID is the stable development/fork ID. The deployment installer may
    // replace the placeholder with the Chrome Web Store ID after an Unlisted item is
    // created. Invalid/unreplaced placeholders are filtered out, so access never
    // broadens to arbitrary extensions.
    const ALLOWED_EXTENSION_IDS = new Set([
        "jkhljmjemfaeoklndkcnehbcnmfjcfam",
        "__DTC_STORE_EXTENSION_ID__"
    ].filter(id => /^[a-p]{32}$/.test(id)));
    const PROTOCOL_VERSION = 1;
    const DEFAULT_WORKSPACE_ID = "__dtc_vivaldi_default_workspace__";

    const isValidWorkspaceId = (value) =>
        (typeof value === "number" && Number.isSafeInteger(value) && value >= 0)
        || (typeof value === "string" && value.length > 0 && value.length <= 128);

    const parseVivExtData = (value) => {
        if (!value) return null;
        if (typeof value === "object") return value;
        if (typeof value !== "string") return null;
        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === "object" ? parsed : null;
        } catch (_) {
            return null;
        }
    };

    const extractWorkspaceList = (value) => {
        if (Array.isArray(value)) return value;
        if (!value || typeof value !== "object") return null;
        if (!Object.prototype.hasOwnProperty.call(value, "value")) return null;
        return Array.isArray(value.value) ? value.value : null;
    };

    const getWorkspaceList = async () => {
        if (typeof globalThis.vivaldi?.prefs?.get !== "function") return null;
        try {
            const value = await globalThis.vivaldi.prefs.get("vivaldi.workspaces.list");
            if (value !== undefined) return extractWorkspaceList(value);
        } catch (_) {}
        return await new Promise(resolve => {
            try {
                globalThis.vivaldi.prefs.get("vivaldi.workspaces.list", value => resolve(extractWorkspaceList(value)));
            } catch (_) {
                resolve(null);
            }
        });
    };

    const getTabExtra = async (tabId) => {
        if (typeof globalThis.vivaldi?.tabsPrivate?.get !== "function") return null;
        try {
            const value = await globalThis.vivaldi.tabsPrivate.get(tabId);
            if (value !== undefined) return value;
        } catch (_) {}
        return await new Promise(resolve => {
            try {
                globalThis.vivaldi.tabsPrivate.get(tabId, value => resolve(value ?? null));
            } catch (_) {
                resolve(null);
            }
        });
    };

    const readTabWorkspace = async (tabId, expectedWindowId, validWorkspaceIds) => {
        try {
            const tab = await chrome.tabs.get(tabId);
            if (!tab || tab.windowId !== expectedWindowId) return null;
            const extra = await getTabExtra(tabId);
            if (!extra || typeof extra !== "object") return null;
            const ext = parseVivExtData(extra.vivExtData ?? tab.vivExtData ?? null);
            if (!ext) return null;

            const rawWorkspaceId = ext.workspaceId;
            let workspaceId;
            if (rawWorkspaceId === undefined || rawWorkspaceId === null) {
                workspaceId = DEFAULT_WORKSPACE_ID;
            } else {
                if (!isValidWorkspaceId(rawWorkspaceId)) return null;
                if (!validWorkspaceIds.has(rawWorkspaceId)) return null;
                workspaceId = rawWorkspaceId;
            }

            return {
                id: tabId,
                windowId: tab.windowId,
                active: !!tab.active,
                pinned: !!tab.pinned,
                workspaceId: workspaceId
            };
        } catch (_) {
            return null;
        }
    };

    const hasCustomWorkspaceEvidence = async (windowId, validWorkspaceIds, knownInfos) => {
        if (knownInfos.some(info => info && info.workspaceId !== DEFAULT_WORKSPACE_ID)) return true;

        let tabs;
        try {
            tabs = await chrome.tabs.query({ windowId: windowId });
        } catch (_) {
            return false;
        }
        if (!Array.isArray(tabs)) return false;

        for (const tab of tabs) {
            try {
                const extra = await getTabExtra(tab.id);
                if (!extra || typeof extra !== "object") continue;
                const ext = parseVivExtData(extra.vivExtData ?? tab.vivExtData ?? null);
                const workspaceId = ext?.workspaceId;
                if (isValidWorkspaceId(workspaceId) && validWorkspaceIds.has(workspaceId)) return true;
            } catch (_) {}
        }
        return false;
    };

    const handleQuery = async (message) => {
        const windowId = message.windowId;
        const tabIds = message.tabIds;
        if (!Number.isInteger(windowId) || windowId <= 0) return { ok: false, reason: "invalid-window-id" };
        if (!Array.isArray(tabIds) || tabIds.length === 0 || tabIds.length > 5000)
            return { ok: false, reason: "invalid-tab-list" };
        if (tabIds.some(id => !Number.isInteger(id) || id <= 0) || new Set(tabIds).size !== tabIds.length)
            return { ok: false, reason: "invalid-tab-ids" };

        const workspaces = await getWorkspaceList();
        if (!Array.isArray(workspaces) || workspaces.length === 0) return { ok: false, reason: "workspace-list-unavailable" };
        const workspaceIds = workspaces
            .map(workspace => workspace?.id)
            .filter(isValidWorkspaceId);
        if (workspaceIds.length !== workspaces.length
                || new Set(workspaceIds).size !== workspaceIds.length
                || workspaceIds.includes(DEFAULT_WORKSPACE_ID))
            return { ok: false, reason: "workspace-list-invalid" };
        const validWorkspaceIds = new Set(workspaceIds);

        let activeTabs;
        try {
            activeTabs = await chrome.tabs.query({ active: true, windowId: windowId });
        } catch (_) {
            return { ok: false, reason: "active-tab-query-failed" };
        }
        if (!Array.isArray(activeTabs) || activeTabs.length !== 1 || !Number.isInteger(activeTabs[0]?.id) || activeTabs[0].id <= 0)
            return { ok: false, reason: "active-tab-ambiguous" };

        const activeInfo = await readTabWorkspace(activeTabs[0].id, windowId, validWorkspaceIds);
        if (!activeInfo) return { ok: false, reason: "active-workspace-unresolved" };

        const tabs = [];
        for (const tabId of tabIds) {
            const info = tabId === activeInfo.id
                ? activeInfo
                : await readTabWorkspace(tabId, windowId, validWorkspaceIds);
            if (!info) return { ok: false, reason: "tab-workspace-unresolved" };
            tabs.push(info);
        }

        const knownInfos = [activeInfo, ...tabs];
        if (knownInfos.some(info => info.workspaceId === DEFAULT_WORKSPACE_ID)) {
            const hasEvidence = await hasCustomWorkspaceEvidence(windowId, validWorkspaceIds, knownInfos);
            if (!hasEvidence) return { ok: false, reason: "default-workspace-unverified" };
        }

        return {
            ok: true,
            requestedWindowId: windowId,
            activeTabId: activeInfo.id,
            activeWorkspaceId: activeInfo.workspaceId,
            tabs: tabs
        };
    };

    if (globalThis.__dtcVivaldiWorkspaceBridgeListener) {
        try {
            chrome.runtime.onMessageExternal.removeListener(globalThis.__dtcVivaldiWorkspaceBridgeListener);
        } catch (_) {}
    }

    globalThis.__dtcVivaldiWorkspaceBridgeListener = (message, sender, sendResponse) => {
        if (!sender || !ALLOWED_EXTENSION_IDS.has(sender.id)) return false;
        if (!message || message.protocolVersion !== PROTOCOL_VERSION || typeof message.requestId !== "string") return false;

        if (message.action === "DTC_VIVALDI_WORKSPACE_PING") {
            sendResponse({
                ok: typeof globalThis.vivaldi?.tabsPrivate?.get === "function"
                    && typeof globalThis.vivaldi?.prefs?.get === "function",
                protocolVersion: PROTOCOL_VERSION,
                requestId: message.requestId
            });
            return false;
        }

        if (message.action !== "DTC_VIVALDI_WORKSPACE_QUERY") return false;

        (async () => {
            let result;
            try {
                result = await handleQuery(message);
            } catch (_) {
                result = { ok: false, reason: "bridge-error" };
            }
            sendResponse({
                ...result,
                protocolVersion: PROTOCOL_VERSION,
                requestId: message.requestId
            });
        })();
        return true;
    };

    chrome.runtime.onMessageExternal.addListener(globalThis.__dtcVivaldiWorkspaceBridgeListener);
})();
