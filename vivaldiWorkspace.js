"use strict";

// Vivaldi exposes Workspace metadata only inside its own UI extension.
// The companion bridge is deliberately read-only. Any missing, malformed or
// inconsistent response fails closed: callers receive null/false and no tab is closed.
const VIVALDI_UI_RUNTIME_ID = "mpognobbkildjkofajifpdfhcoklimli";
const VIVALDI_WORKSPACE_BRIDGE_PROTOCOL = 1;
const VIVALDI_WORKSPACE_BRIDGE_TIMEOUT_MS = 1000;
const VIVALDI_WORKSPACE_DIAGNOSTIC_KEY = "vivaldiWorkspaceDiagnostic";

const sanitizeVivaldiDiagnosticValue = value => {
    if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
    if (typeof value === "string") return value.slice(0, 240);
    return undefined;
};

const setVivaldiWorkspaceDiagnostic = (code, details = {}) => {
    const safeDetails = {};
    for (const [key, value] of Object.entries(details)) {
        const safeValue = sanitizeVivaldiDiagnosticValue(value);
        if (safeValue !== undefined) safeDetails[key] = safeValue;
    }
    const diagnostic = {
        code: code,
        at: new Date().toISOString(),
        protocolVersion: VIVALDI_WORKSPACE_BRIDGE_PROTOCOL,
        extensionVersion: chrome.runtime.getManifest().version,
        details: safeDetails
    };
    console.warn("DTC-VW-DIAGNOSTIC", JSON.stringify(diagnostic));
    chrome.storage.session.set({ [VIVALDI_WORKSPACE_DIAGNOSTIC_KEY]: diagnostic }).catch(() => {});
};

const clearVivaldiWorkspaceDiagnostic = () =>
    chrome.storage.session.remove(VIVALDI_WORKSPACE_DIAGNOSTIC_KEY).catch(() => {});

const isValidVivaldiWorkspaceId = (value) =>
    (typeof value === "number" && Number.isSafeInteger(value) && value >= 0)
    || (typeof value === "string" && value.length > 0 && value.length <= 128);

const createVivaldiWorkspaceRequestId = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return `dtc-vw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

const sendVivaldiWorkspaceBridgeMessage = (message, operation) => new Promise(resolve => {
    let settled = false;
    const finish = result => {
        if (settled) return;
        settled = true;
        clearTimeout(timerId);
        resolve(result);
    };
    const timerId = setTimeout(() => finish({
        response: null,
        errorCode: "VW-BRIDGE-TIMEOUT",
        details: { operation: operation }
    }), VIVALDI_WORKSPACE_BRIDGE_TIMEOUT_MS);

    try {
        chrome.runtime.sendMessage(VIVALDI_UI_RUNTIME_ID, message, response => {
            const error = chrome.runtime.lastError;
            if (error) {
                finish({
                    response: null,
                    errorCode: "VW-BRIDGE-UNREACHABLE",
                    details: { operation: operation, lastError: error.message || "runtime error" }
                });
                return;
            }
            finish({ response: response ?? null, errorCode: null, details: {} });
        });
    } catch (error) {
        finish({
            response: null,
            errorCode: "VW-BRIDGE-EXCEPTION",
            details: { operation: operation, lastError: String(error) }
        });
    }
});

const invalidVivaldiWorkspaceResponse = (code, operation, details = {}) => {
    setVivaldiWorkspaceDiagnostic(code, { operation: operation, ...details });
    return null;
};

const validateVivaldiWorkspaceBridgeResponse = (response, requestId, windowId, tabIds, operation) => {
    if (!response) return invalidVivaldiWorkspaceResponse("VW-RESPONSE-MISSING", operation);
    if (response.ok !== true) return invalidVivaldiWorkspaceResponse("VW-BRIDGE-REJECTED", operation, { reason: response.reason || "unknown" });
    if (response.protocolVersion !== VIVALDI_WORKSPACE_BRIDGE_PROTOCOL)
        return invalidVivaldiWorkspaceResponse("VW-PROTOCOL-MISMATCH", operation, { receivedProtocol: response.protocolVersion });
    if (response.requestId !== requestId) return invalidVivaldiWorkspaceResponse("VW-REQUEST-MISMATCH", operation);
    if (response.requestedWindowId !== windowId)
        return invalidVivaldiWorkspaceResponse("VW-WINDOW-MISMATCH", operation, { requestedWindowId: windowId, receivedWindowId: response.requestedWindowId });
    if (!Number.isInteger(response.activeTabId) || response.activeTabId <= 0)
        return invalidVivaldiWorkspaceResponse("VW-ACTIVE-TAB-INVALID", operation);
    if (!isValidVivaldiWorkspaceId(response.activeWorkspaceId))
        return invalidVivaldiWorkspaceResponse("VW-ACTIVE-WORKSPACE-INVALID", operation);
    if (!Array.isArray(response.tabs) || response.tabs.length !== tabIds.length)
        return invalidVivaldiWorkspaceResponse("VW-TAB-COUNT-MISMATCH", operation, { expectedCount: tabIds.length, receivedCount: Array.isArray(response.tabs) ? response.tabs.length : -1 });

    const expectedIds = new Set(tabIds);
    const metadataById = new Map();
    for (const item of response.tabs) {
        if (!item || !Number.isInteger(item.id) || !expectedIds.has(item.id))
            return invalidVivaldiWorkspaceResponse("VW-TAB-ID-MISMATCH", operation);
        if (metadataById.has(item.id)) return invalidVivaldiWorkspaceResponse("VW-TAB-DUPLICATE-METADATA", operation);
        if (item.windowId !== windowId)
            return invalidVivaldiWorkspaceResponse("VW-TAB-WINDOW-MISMATCH", operation, { tabId: item.id, receivedWindowId: item.windowId });
        if (!isValidVivaldiWorkspaceId(item.workspaceId))
            return invalidVivaldiWorkspaceResponse("VW-TAB-WORKSPACE-INVALID", operation, { tabId: item.id });
        metadataById.set(item.id, item);
    }
    if (metadataById.size !== expectedIds.size) return invalidVivaldiWorkspaceResponse("VW-TAB-METADATA-INCOMPLETE", operation);

    clearVivaldiWorkspaceDiagnostic();
    return {
        activeTabId: response.activeTabId,
        activeWorkspaceId: response.activeWorkspaceId,
        metadataById: metadataById
    };
};

const requestVivaldiWorkspaceSnapshot = async (windowId, tabIds, operation = "query") => {
    if (!Number.isInteger(windowId) || windowId <= 0) {
        setVivaldiWorkspaceDiagnostic("VW-INPUT-WINDOW-INVALID", { operation: operation, windowId: windowId });
        return null;
    }
    if (!Array.isArray(tabIds) || tabIds.length === 0) {
        setVivaldiWorkspaceDiagnostic("VW-INPUT-TABS-EMPTY", { operation: operation });
        return null;
    }
    if (tabIds.some(id => !Number.isInteger(id) || id <= 0) || new Set(tabIds).size !== tabIds.length) {
        setVivaldiWorkspaceDiagnostic("VW-INPUT-TABS-INVALID", { operation: operation, tabCount: tabIds.length });
        return null;
    }

    const requestId = createVivaldiWorkspaceRequestId();
    const transport = await sendVivaldiWorkspaceBridgeMessage({
        action: "DTC_VIVALDI_WORKSPACE_QUERY",
        protocolVersion: VIVALDI_WORKSPACE_BRIDGE_PROTOCOL,
        requestId: requestId,
        windowId: windowId,
        tabIds: tabIds
    }, operation);

    if (transport.errorCode) {
        setVivaldiWorkspaceDiagnostic(transport.errorCode, transport.details);
        return null;
    }
    return validateVivaldiWorkspaceBridgeResponse(transport.response, requestId, windowId, tabIds, operation);
};

// Filter candidate tabs to the active Workspace. requiredTabs are validated too,
// but are not added to the returned candidate list. This matters during a URL
// navigation race where chrome.tabs.query({url: ...}) can temporarily omit the
// observed tab even though other matching candidates are already returned.
// eslint-disable-next-line no-unused-vars
const getActiveVivaldiWorkspaceTabs = async (windowId, tabs, requiredTabs = []) => {
    if (!Array.isArray(tabs) || !Array.isArray(requiredTabs)) {
        setVivaldiWorkspaceDiagnostic("VW-CANDIDATE-TABS-INVALID", { operation: "filter" });
        return null;
    }
    if (tabs.length === 0 && requiredTabs.length === 0) {
        setVivaldiWorkspaceDiagnostic("VW-NO-CANDIDATE-TABS", { operation: "filter" });
        return null;
    }

    const requestedIds = [];
    const seenIds = new Set();
    for (const tab of [...tabs, ...requiredTabs]) {
        if (!tab || !Number.isInteger(tab.id) || tab.id <= 0) {
            setVivaldiWorkspaceDiagnostic("VW-CANDIDATE-TAB-ID-INVALID", { operation: "filter" });
            return null;
        }
        if (!seenIds.has(tab.id)) {
            seenIds.add(tab.id);
            requestedIds.push(tab.id);
        }
    }

    const snapshot = await requestVivaldiWorkspaceSnapshot(windowId, requestedIds, "filter");
    if (!snapshot) return null;

    for (const requiredTab of requiredTabs) {
        const metadata = snapshot.metadataById.get(requiredTab.id);
        if (!metadata || metadata.workspaceId !== snapshot.activeWorkspaceId) {
            setVivaldiWorkspaceDiagnostic("VW-REQUIRED-TAB-OUTSIDE-ACTIVE-WORKSPACE", {
                operation: "filter",
                tabId: requiredTab.id
            });
            return null;
        }
    }

    const scopedTabs = tabs.filter(tab => {
        const metadata = snapshot.metadataById.get(tab.id);
        return metadata && metadata.workspaceId === snapshot.activeWorkspaceId;
    });

    clearVivaldiWorkspaceDiagnostic();
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
    if (!isValidVivaldiWorkspaceId(workspaceId)) {
        setVivaldiWorkspaceDiagnostic("VW-REVALIDATE-WORKSPACE-INVALID", { operation: "revalidate" });
        return false;
    }
    const snapshot = await requestVivaldiWorkspaceSnapshot(windowId, tabIds, "revalidate");
    if (!snapshot) return false;
    if (snapshot.activeWorkspaceId !== workspaceId) {
        setVivaldiWorkspaceDiagnostic("VW-WORKSPACE-CHANGED", { operation: "revalidate" });
        return false;
    }
    for (const id of tabIds) {
        const metadata = snapshot.metadataById.get(id);
        if (!metadata || metadata.workspaceId !== workspaceId) {
            setVivaldiWorkspaceDiagnostic("VW-TAB-MOVED-WORKSPACE", { operation: "revalidate", tabId: id });
            return false;
        }
    }
    clearVivaldiWorkspaceDiagnostic();
    return true;
};

// eslint-disable-next-line no-unused-vars
const probeVivaldiWorkspaceBridge = async () => {
    const requestId = createVivaldiWorkspaceRequestId();
    const transport = await sendVivaldiWorkspaceBridgeMessage({
        action: "DTC_VIVALDI_WORKSPACE_PING",
        protocolVersion: VIVALDI_WORKSPACE_BRIDGE_PROTOCOL,
        requestId: requestId
    }, "ping");
    if (transport.errorCode) {
        setVivaldiWorkspaceDiagnostic(transport.errorCode, transport.details);
        return false;
    }
    const response = transport.response;
    const valid = !!response
        && response.ok === true
        && response.protocolVersion === VIVALDI_WORKSPACE_BRIDGE_PROTOCOL
        && response.requestId === requestId;
    if (!valid) {
        setVivaldiWorkspaceDiagnostic("VW-PING-INVALID", { operation: "ping", reason: response?.reason || "invalid response" });
        return false;
    }
    clearVivaldiWorkspaceDiagnostic();
    return true;
};

// Popup/options historically close individual rows directly via helper.removeTab.
// Under VW those calls are routed here so stale UI cannot bypass Workspace checks.
// Outside VW this preserves the existing direct-close behavior.
// eslint-disable-next-line no-unused-vars
const closePanelTabs = async (tabIds) => {
    if (!Array.isArray(tabIds) || tabIds.length === 0
            || tabIds.some(id => !Number.isInteger(id) || id <= 0)
            || new Set(tabIds).size !== tabIds.length) {
        if (options.searchInActiveVivaldiWorkspace)
            setVivaldiWorkspaceDiagnostic("VW-PANEL-TAB-IDS-INVALID", { operation: "panel-close" });
        return false;
    }

    if (!options.searchInActiveVivaldiWorkspace) {
        try {
            await Promise.all(tabIds.map(id => removeTab(id)));
            return true;
        } catch (_) {
            return false;
        }
    }

    const tabs = await Promise.all(tabIds.map(id => getTab(id, true)));
    if (tabs.some(tab => !tab)) {
        setVivaldiWorkspaceDiagnostic("VW-PANEL-TAB-MISSING", { operation: "panel-close" });
        return false;
    }
    const windowId = tabs[0].windowId;
    if (!Number.isInteger(windowId) || windowId <= 0 || tabs.some(tab => tab.windowId !== windowId)) {
        setVivaldiWorkspaceDiagnostic("VW-PANEL-WINDOW-MISMATCH", { operation: "panel-close" });
        return false;
    }

    const scoped = await getActiveVivaldiWorkspaceTabs(windowId, tabs, tabs);
    if (!scoped || scoped.tabs.length !== tabs.length) return false;

    const safe = await revalidateActiveVivaldiWorkspaceTabs(windowId, scoped.workspaceId, tabIds);
    if (!safe) return false;

    try {
        await chrome.tabs.remove(tabIds);
        return true;
    } catch (error) {
        setVivaldiWorkspaceDiagnostic("VW-PANEL-CLOSE-FAILED", {
            operation: "panel-close",
            lastError: String(error)
        });
        return false;
    }
};
