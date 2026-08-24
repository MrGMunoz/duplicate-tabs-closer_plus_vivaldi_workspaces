"use strict";

// Vivaldi exposes Workspace metadata only inside its own UI extension.
// The companion bridge is deliberately read-only. Any missing, malformed or
// inconsistent response fails closed: the caller receives null/false.
const VIVALDI_UI_RUNTIME_ID = "mpognobbkildjkofajifpdfhcoklimli";
const VIVALDI_WORKSPACE_BRIDGE_PROTOCOL = 1;
const VIVALDI_WORKSPACE_BRIDGE_TIMEOUT_MS = 1000;

const isValidVivaldiWorkspaceId = (value) =>
    (typeof value === "number" && Number.isSafeInteger(value) && value >= 0)
    || (typeof value === "string" && value.length > 0 && value.length <= 128);

const createVivaldiWorkspaceRequestId = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return `dtc-vw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

const sendVivaldiWorkspaceBridgeMessage = (message) => new Promise(resolve => {
    let settled = false;
    const finish = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timerId);
        resolve(value);
    };
    const timerId = setTimeout(() => finish(null), VIVALDI_WORKSPACE_BRIDGE_TIMEOUT_MS);
    try {
        chrome.runtime.sendMessage(VIVALDI_UI_RUNTIME_ID, message, response => {
            const error = chrome.runtime.lastError;
            if (error) return finish(null);
            finish(response ?? null);
        });
    } catch (_) {
        finish(null);
    }
});

const validateVivaldiWorkspaceBridgeResponse = (response, requestId, windowId, tabIds) => {
    if (!response || response.ok !== true) return null;
    if (response.protocolVersion !== VIVALDI_WORKSPACE_BRIDGE_PROTOCOL) return null;
    if (response.requestId !== requestId) return null;
    if (response.requestedWindowId !== windowId) return null;
    if (!Number.isInteger(response.activeTabId) || response.activeTabId <= 0) return null;
    if (!isValidVivaldiWorkspaceId(response.activeWorkspaceId)) return null;
    if (!Array.isArray(response.tabs) || response.tabs.length !== tabIds.length) return null;

    const expectedIds = new Set(tabIds);
    const metadataById = new Map();
    for (const item of response.tabs) {
        if (!item || !Number.isInteger(item.id) || !expectedIds.has(item.id)) return null;
        if (metadataById.has(item.id)) return null;
        if (item.windowId !== windowId) return null;
        if (!isValidVivaldiWorkspaceId(item.workspaceId)) return null;
        metadataById.set(item.id, item);
    }
    if (metadataById.size !== expectedIds.size) return null;

    return {
        activeTabId: response.activeTabId,
        activeWorkspaceId: response.activeWorkspaceId,
        metadataById: metadataById
    };
};

const requestVivaldiWorkspaceSnapshot = async (windowId, tabIds) => {
    if (!Number.isInteger(windowId) || windowId <= 0) return null;
    if (!Array.isArray(tabIds) || tabIds.length === 0) return null;
    if (tabIds.some(id => !Number.isInteger(id) || id <= 0)) return null;
    if (new Set(tabIds).size !== tabIds.length) return null;

    const requestId = createVivaldiWorkspaceRequestId();
    const response = await sendVivaldiWorkspaceBridgeMessage({
        action: "DTC_VIVALDI_WORKSPACE_QUERY",
        protocolVersion: VIVALDI_WORKSPACE_BRIDGE_PROTOCOL,
        requestId: requestId,
        windowId: windowId,
        tabIds: tabIds
    });
    return validateVivaldiWorkspaceBridgeResponse(response, requestId, windowId, tabIds);
};

// eslint-disable-next-line no-unused-vars
const getActiveVivaldiWorkspaceTabs = async (windowId, tabs) => {
    if (!Array.isArray(tabs) || tabs.length === 0) return null;
    const tabIds = tabs.map(tab => tab && tab.id);
    const snapshot = await requestVivaldiWorkspaceSnapshot(windowId, tabIds);
    if (!snapshot) return null;

    const scopedTabs = tabs.filter(tab => {
        const metadata = snapshot.metadataById.get(tab.id);
        return metadata && metadata.workspaceId === snapshot.activeWorkspaceId;
    });
    if (scopedTabs.length === 0) return null;

    return {
        workspaceId: snapshot.activeWorkspaceId,
        activeTabId: snapshot.activeTabId,
        tabs: scopedTabs
    };
};

// Re-read Vivaldi immediately before a close. Every supplied tab must still be
// in the same active Workspace; otherwise the whole close operation is blocked.
// eslint-disable-next-line no-unused-vars
const revalidateActiveVivaldiWorkspaceTabs = async (windowId, workspaceId, tabIds) => {
    if (!isValidVivaldiWorkspaceId(workspaceId)) return false;
    const snapshot = await requestVivaldiWorkspaceSnapshot(windowId, tabIds);
    if (!snapshot || snapshot.activeWorkspaceId !== workspaceId) return false;
    for (const id of tabIds) {
        const metadata = snapshot.metadataById.get(id);
        if (!metadata || metadata.workspaceId !== workspaceId) return false;
    }
    return true;
};

// eslint-disable-next-line no-unused-vars
const probeVivaldiWorkspaceBridge = async () => {
    const requestId = createVivaldiWorkspaceRequestId();
    const response = await sendVivaldiWorkspaceBridgeMessage({
        action: "DTC_VIVALDI_WORKSPACE_PING",
        protocolVersion: VIVALDI_WORKSPACE_BRIDGE_PROTOCOL,
        requestId: requestId
    });
    return !!response
        && response.ok === true
        && response.protocolVersion === VIVALDI_WORKSPACE_BRIDGE_PROTOCOL
        && response.requestId === requestId;
};
