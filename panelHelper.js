"use strict";

// eslint-disable-next-line no-unused-vars
const getElement = (sel, ctx = document) => ctx.querySelector(sel);
// eslint-disable-next-line no-unused-vars
const getElements = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

// eslint-disable-next-line no-unused-vars
const areSameArrays = (array1, array2) => {
    if (!array1 && !array2) return true;
    if (!array1 || !array2 || array1.length !== array2.length) return false;
    return array1.every((t, i) => t.id === array2[i].id
        && t.isRetained === array2[i].isRetained
        && t.whitelisted === array2[i].whitelisted);
};

// eslint-disable-next-line no-unused-vars
const escapeHTML = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');

// eslint-disable-next-line no-unused-vars
const buildTabRow = (duplicateTab, activeWindowId) => {
    const tr = document.createElement("tr");
    tr.setAttribute("tabId", parseInt(duplicateTab.id, 10));
    tr.setAttribute("windowId", parseInt(duplicateTab.windowId, 10));
    if (!duplicateTab.isRetained) tr.classList.add("tab-row-duplicate");
    if (duplicateTab.whitelisted) tr.setAttribute("data-whitelisted", "true");

    const tdIcon = document.createElement("td");
    tdIcon.className = "td-tab-icon";
    const img = document.createElement("img");
    img.src = duplicateTab.icon || "../images/default-favicon.png";
    img.alt = "";
    tdIcon.appendChild(img);

    const tdTitle = document.createElement("td");
    tdTitle.className = "td-tab-title";
    tdTitle.title = duplicateTab.url;
    if (duplicateTab.containerColor) {
        tdTitle.style.textDecorationColor = duplicateTab.containerColor;
    }
    if (duplicateTab.whitelisted) {
        const badge = document.createElement("span");
        badge.className = "whitelist-row-badge fa-solid fa-shield-halved";
        badge.title = chrome.i18n.getMessage("whitelistedTab");
        tdTitle.appendChild(badge);
        tdTitle.appendChild(document.createTextNode(" "));
    }
    if (duplicateTab.windowId === activeWindowId) {
        tdTitle.appendChild(document.createTextNode(duplicateTab.title));
    } else {
        const em = document.createElement("em");
        em.textContent = duplicateTab.title;
        tdTitle.appendChild(em);
    }

    const tdClose = document.createElement("td");
    tdClose.className = "td-close-button";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-tab-close";
    btn.setAttribute("aria-label", "Close");
    btn.textContent = "×";
    tdClose.appendChild(btn);

    tr.appendChild(tdIcon);
    tr.appendChild(tdTitle);
    tr.appendChild(tdClose);
    return tr;
};

// eslint-disable-next-line no-unused-vars
const buildDuplicateTabRows = (duplicateTabs, activeWindowId) => {
    return duplicateTabs.map(tab => buildTabRow(tab, activeWindowId));
};

// eslint-disable-next-line no-unused-vars
const buildGroupedDuplicateTabRows = (duplicateTabs, activeWindowId) => {
    const rows = [];
    const groups = new Map();
    duplicateTabs.forEach(tab => {
        if (!groups.has(tab.groupIndex)) groups.set(tab.groupIndex, []);
        groups.get(tab.groupIndex).push(tab);
    });
    groups.forEach((tabs) => {
        const headerTr = document.createElement("tr");
        headerTr.className = "tr-group-header collapsed";
        headerTr.dataset.groupTabIds = tabs.map(t => t.id).join(",");
        if (tabs.every(tab => tab.whitelisted)) headerTr.setAttribute("data-whitelisted", "true");

        const tdHeader = document.createElement("td");
        tdHeader.className = "td-group-header-cell";
        tdHeader.colSpan = 2;

        const chevron = document.createElement("span");
        chevron.className = "fa-solid fa-chevron-right fa-xs";
        chevron.setAttribute("aria-hidden", "true");

        const img = document.createElement("img");
        img.src = tabs[0].icon || "../images/default-favicon.png";
        img.alt = "";
        img.className = "group-favicon";

        const titleSpan = document.createElement("span");
        titleSpan.className = "group-header-title";
        titleSpan.title = tabs[0].url;
        titleSpan.textContent = tabs[0].title;

        const badge = document.createElement("span");
        badge.className = "group-count-badge";
        badge.textContent = chrome.i18n.getMessage("tabsCount", [String(tabs.length)]);

        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.className = "btn-tab-close btn-group-close";
        closeBtn.setAttribute("aria-label", chrome.i18n.getMessage("closeGroup"));
        closeBtn.textContent = "×";

        const innerDiv = document.createElement("div");
        innerDiv.className = "group-header-inner";
        innerDiv.append(chevron, img, titleSpan, badge);
        tdHeader.appendChild(innerDiv);

        const tdClose = document.createElement("td");
        tdClose.className = "td-close-button";
        tdClose.appendChild(closeBtn);

        headerTr.append(tdHeader, tdClose);
        rows.push(headerTr);

        tabs.forEach(tab => {
            const row = buildTabRow(tab, activeWindowId);
            row.classList.add("group-row", "group-collapsed");
            rows.push(row);
        });
    });
    return rows;
};

// eslint-disable-next-line no-unused-vars
const applyTheme = (value) => {
    const darkThemes = ["ocean", "charcoal", "purple", "teal", "oled"];
    const lightThemes = ["sage", "rose", "amber", "slate", "violet"];
    const isDark = darkThemes.includes(value);
    document.documentElement.setAttribute("data-bs-theme", isDark ? "dark" : "light");
    document.documentElement.classList.remove(...[...darkThemes, ...lightThemes].map(t => `theme-${t}`));
    if (value !== "light") document.documentElement.classList.add(`theme-${value}`);
};

// eslint-disable-next-line no-unused-vars
const updateIgnorePathPartDependents = (checked) => {
    document.getElementById("ignoreSearchPart").disabled = checked;
    document.getElementById("ignoreHashPart").disabled = checked;
};

// eslint-disable-next-line no-unused-vars
const updatePrioritizeActiveWindowState = (scopeValue) => {
    const el = document.getElementById("prioritizeActiveWindow");
    if (el) el.disabled = scopeValue !== "A" && scopeValue !== "CA";
};

const VIVALDI_UI_RUNTIME_ID_FOR_SCOPE_UI = "mpognobbkildjkofajifpdfhcoklimli";
const VIVALDI_WORKSPACE_SCOPE_PROTOCOL_FOR_UI = 1;
const VIVALDI_WORKSPACE_DIAGNOSTIC_KEY_FOR_UI = "vivaldiWorkspaceDiagnostic";

const createPanelDiagnostic = (code, details = {}) => ({
    code: code,
    at: new Date().toISOString(),
    protocolVersion: VIVALDI_WORKSPACE_SCOPE_PROTOCOL_FOR_UI,
    extensionVersion: chrome.runtime.getManifest().version,
    details: details
});

const probeVivaldiWorkspaceBridgeFromPanel = () => new Promise(resolve => {
    const requestId = `dtc-vw-ui-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    let settled = false;
    const finish = value => {
        if (settled) return;
        settled = true;
        clearTimeout(timerId);
        resolve(value);
    };
    const timerId = setTimeout(() => finish({
        available: false,
        diagnostic: createPanelDiagnostic("VW-BRIDGE-TIMEOUT", { operation: "ui-ping" })
    }), 1000);
    try {
        chrome.runtime.sendMessage(
            VIVALDI_UI_RUNTIME_ID_FOR_SCOPE_UI,
            {
                action: "DTC_VIVALDI_WORKSPACE_PING",
                protocolVersion: VIVALDI_WORKSPACE_SCOPE_PROTOCOL_FOR_UI,
                requestId: requestId
            },
            response => {
                if (chrome.runtime.lastError) {
                    finish({
                        available: false,
                        diagnostic: createPanelDiagnostic("VW-BRIDGE-UNREACHABLE", {
                            operation: "ui-ping",
                            lastError: (chrome.runtime.lastError.message || "runtime error").slice(0, 240)
                        })
                    });
                    return;
                }
                const valid = !!response
                    && response.ok === true
                    && response.protocolVersion === VIVALDI_WORKSPACE_SCOPE_PROTOCOL_FOR_UI
                    && response.requestId === requestId;
                finish({
                    available: valid,
                    diagnostic: valid ? null : createPanelDiagnostic("VW-PING-INVALID", {
                        operation: "ui-ping",
                        reason: (response?.reason || "invalid response").slice(0, 240)
                    })
                });
            }
        );
    } catch (error) {
        finish({
            available: false,
            diagnostic: createPanelDiagnostic("VW-BRIDGE-EXCEPTION", {
                operation: "ui-ping",
                lastError: String(error).slice(0, 240)
            })
        });
    }
});

const copyVivaldiWorkspaceDiagnostic = async (diagnostic, button) => {
    const text = JSON.stringify(diagnostic, null, 2);
    try {
        await navigator.clipboard.writeText(text);
    } catch (_) {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
    }
    const original = button.textContent;
    button.textContent = chrome.i18n.getMessage("vivaldiWorkspaceDiagnosticsCopied") || "Copied";
    setTimeout(() => { button.textContent = original; }, 1500);
};

const initializeVivaldiWorkspaceScopeUi = async () => {
    const scopeSelect = document.getElementById("scope");
    if (!scopeSelect) return;

    let workspaceOption = scopeSelect.querySelector("option[value='VW']");
    if (!workspaceOption) {
        workspaceOption = document.createElement("option");
        workspaceOption.value = "VW";
        workspaceOption.className = "vivaldiWorkspaceItem";
        workspaceOption.textContent = chrome.i18n.getMessage("activeVivaldiWorkspace") || "Active Vivaldi Workspace";
        const activeWindowOption = scopeSelect.querySelector("option[value='C']");
        scopeSelect.insertBefore(workspaceOption, activeWindowOption || null);
    }

    let status = document.getElementById("vivaldiWorkspaceBridgeStatus");
    if (!status) {
        status = document.createElement("div");
        status.id = "vivaldiWorkspaceBridgeStatus";
        status.className = "form-text text-muted hidden";
        const message = document.createElement("span");
        message.className = "vivaldi-workspace-error-message";
        const copyButton = document.createElement("button");
        copyButton.type = "button";
        copyButton.className = "btn btn-link btn-sm p-0 ms-1";
        copyButton.textContent = chrome.i18n.getMessage("copyVivaldiWorkspaceDiagnostics") || "Copy diagnostics";
        status.append(message, document.createTextNode(" "), copyButton);
        scopeSelect.insertAdjacentElement("afterend", status);
    }

    const message = status.querySelector(".vivaldi-workspace-error-message");
    const copyButton = status.querySelector("button");
    let currentDiagnostic = null;
    let storedScope = scopeSelect.value;
    try {
        const response = await sendMessage("getStoredOptions");
        storedScope = response?.data?.storedOptions?.scope?.value ?? storedScope;
    } catch (_) {}

    const probe = await probeVivaldiWorkspaceBridgeFromPanel();
    const readStoredDiagnostic = async () => {
        try {
            const data = await chrome.storage.session.get(VIVALDI_WORKSPACE_DIAGNOSTIC_KEY_FOR_UI);
            return data[VIVALDI_WORKSPACE_DIAGNOSTIC_KEY_FOR_UI] || null;
        } catch (_) {
            return null;
        }
    };

    const renderState = async () => {
        const selected = scopeSelect.value === "VW";
        const storedDiagnostic = await readStoredDiagnostic();
        currentDiagnostic = storedDiagnostic || (!probe.available ? probe.diagnostic : null);
        workspaceOption.disabled = !probe.available;
        workspaceOption.classList.toggle("hidden", !probe.available && !selected);
        const showError = selected && !!currentDiagnostic;
        status.classList.toggle("hidden", !showError);
        if (showError && message) {
            const prefix = chrome.i18n.getMessage("vivaldiWorkspaceError") || "Vivaldi Workspace error";
            message.textContent = `${prefix}: ${currentDiagnostic.code}. ${chrome.i18n.getMessage("vivaldiWorkspaceFailClosed") || "No tabs will be closed."}`;
        }
    };

    if (storedScope === "VW") workspaceOption.selected = true;
    await renderState();

    scopeSelect.addEventListener("change", renderState);
    if (copyButton) copyButton.addEventListener("click", () => {
        if (currentDiagnostic) copyVivaldiWorkspaceDiagnostic(currentDiagnostic, copyButton);
    });
    chrome.storage.session.onChanged.addListener(changes => {
        if (Object.prototype.hasOwnProperty.call(changes, VIVALDI_WORKSPACE_DIAGNOSTIC_KEY_FOR_UI)) renderState();
    });
};

// eslint-disable-next-line no-unused-vars
const updateGroupButton = (grouped) => {
    const btn = document.getElementById("groupDuplicateTabsBtn");
    if (!btn) return;
    btn.classList.toggle("active", grouped);
    btn.setAttribute("aria-pressed", String(grouped));
};

// eslint-disable-next-line no-unused-vars
const updateHideWhitelistedButton = (hidden) => {
    const btn = document.getElementById("hideWhitelistedTabsBtn");
    if (!btn) return;
    btn.classList.toggle("active", hidden);
    btn.setAttribute("aria-pressed", String(hidden));
    document.getElementById("duplicateTabsTable")?.classList.toggle("hide-whitelisted", hidden);
};

let highlightBottomScrollShadowTimer = null;
// eslint-disable-next-line no-unused-vars
const highlightBottomScrollShadow = () => {
    clearTimeout(highlightBottomScrollShadowTimer);
    const container = document.getElementById("duplicateTabsTableContainer");
    if (!container.classList.contains("table-scrollable-overflow")) return;
    container.classList.toggle("highlight-scroll-bottom", true);
    highlightBottomScrollShadowTimer = setTimeout(() => container.classList.toggle("highlight-scroll-bottom", false), 400);
};

// eslint-disable-next-line no-unused-vars
const getHighlightBounds = (textarea) => {
    const cs = window.getComputedStyle(textarea);
    const pt = parseFloat(cs.paddingTop);
    const text = textarea.value;
    const pos = textarea.selectionStart;
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    const lineEndRaw = text.indexOf('\n', pos);
    const lineEnd = lineEndRaw === -1 ? text.length : lineEndRaw;
    let m = textarea._mirror;
    if (!m) {
        m = document.createElement('div');
        m.setAttribute('aria-hidden', 'true');
        m.style.cssText = 'position:fixed;top:-9999px;visibility:hidden;white-space:pre-wrap;overflow-wrap:break-word;padding:0;margin:0;border:0;box-sizing:content-box;';
        document.body.appendChild(m);
        textarea._mirror = m;
    }
    m.style.width = (textarea.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) + 'px';
    m.style.font = cs.font;
    m.style.lineHeight = cs.lineHeight;
    let topOffset = 0;
    if (lineStart > 0) {
        m.textContent = text.substring(0, lineStart);
        topOffset = m.scrollHeight;
    }
    m.textContent = text.substring(lineStart, lineEnd) || ' ';
    return { top: pt + topOffset, bottom: pt + topOffset + m.scrollHeight };
};

// eslint-disable-next-line no-unused-vars
const saveActiveWindowId = async () => {
    activeWindowId = await getActiveWindowId();
};

// eslint-disable-next-line no-unused-vars
const requestCloseDuplicateTabs = (skipWhitelisted) => sendMessage("closeDuplicateTabs", { "windowId": activeWindowId, "skipWhitelisted": skipWhitelisted });

// eslint-disable-next-line no-unused-vars
const saveOption = (name, value, refresh) => sendMessage("setStoredOption", { "name": name, "value": value, "refresh": refresh });

// eslint-disable-next-line no-unused-vars
const requestGetDuplicateTabs = () => sendMessage("getDuplicateTabs", { "windowId": activeWindowId });

document.addEventListener("DOMContentLoaded", initializeVivaldiWorkspaceScopeUi);
