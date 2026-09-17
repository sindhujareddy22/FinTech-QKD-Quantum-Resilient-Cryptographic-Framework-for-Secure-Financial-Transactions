/**
 * FinTech QKD Institutional Ops Console • Clean Frontend Controller
 * =================================================================
 * Handles WebSocket connection, live QBER meter updates, settlement ledger
 * rendering, and operator controls.
 */

let ws = null;
let currentStatus = {};
let settlementLogs = [];

function connectWebSocket() {
    const loc = window.location;
    const wsProto = loc.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProto}//${loc.host}/ws`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log("WebSocket connected to Node Daemon.");
        const badge = document.getElementById("peer-badge");
        const statusText = document.getElementById("peer-status-text");
        if (badge) badge.className = "connection-status connected";
        if (statusText) statusText.textContent = "CONNECTED";
    };

    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            if (msg.type === "STATUS_UPDATE") {
                handleStatusUpdate(msg.data);
            }
        } catch (e) {
            console.error("Failed to parse WebSocket message:", e);
        }
    };

    ws.onclose = () => {
        const badge = document.getElementById("peer-badge");
        const statusText = document.getElementById("peer-status-text");
        if (badge) badge.className = "connection-status disconnected";
        if (statusText) statusText.textContent = "DISCONNECTED";
        setTimeout(connectWebSocket, 2000);
    };
}

function handleStatusUpdate(data) {
    currentStatus = data;

    // 1. Header
    document.getElementById("node-title").textContent = data.node_name || "NODE READY";
    document.getElementById("peer-address").textContent = `${data.peer_host}:${data.peer_port}`;

    // Role-based visibility
    const settleBtn = document.getElementById("btn-settle");
    const autoStreamBtn = document.getElementById("btn-autostream");
    if (data.role === "clearing") {
        if (settleBtn) settleBtn.style.display = "none";
        if (autoStreamBtn) autoStreamBtn.style.display = "none";
    } else {
        if (settleBtn) settleBtn.style.display = "inline-block";
        if (autoStreamBtn) autoStreamBtn.style.display = "inline-block";
    }

    // 2. Alert Banner
    const alertBanner = document.getElementById("alert-banner");
    const alertText = document.getElementById("alert-text");
    if (data.alert_message) {
        alertText.textContent = data.alert_message;
        alertBanner.classList.remove("hidden");
    } else {
        alertBanner.classList.add("hidden");
    }

    // 3. Channel Status
    const pill = document.getElementById("channel-state-pill");
    const qberDisplay = document.getElementById("qber-display");
    const qberFill = document.getElementById("qber-bar-fill");

    if (data.channel_secure) {
        pill.textContent = "SECURE";
        pill.className = "status-pill secure";
        qberFill.className = "meter-fill";
        qberDisplay.className = "qber-number text-green";
    } else {
        pill.textContent = "COMPROMISED";
        pill.className = "status-pill compromised";
        qberFill.className = "meter-fill compromised";
        qberDisplay.className = "qber-number text-red";
    }

    qberDisplay.textContent = `${data.latest_qber.toFixed(1)}%`;
    // Max scale on meter is 50%
    const barPercent = Math.min(100, (data.latest_qber / 50.0) * 100);
    qberFill.style.width = `${barPercent}%`;

    // 4. Controls sync
    const toggleEveElem = document.getElementById("toggle-eve");
    const toggleTamperElem = document.getElementById("toggle-tamper");
    if (toggleEveElem) toggleEveElem.checked = !!data.eve_active;
    if (toggleTamperElem) toggleTamperElem.checked = !!data.tamper_active;

    if (autoStreamBtn) {
        if (data.auto_stream) {
            autoStreamBtn.textContent = "AUTO-STREAM: ACTIVE";
            autoStreamBtn.className = "btn btn-autostream active";
        } else {
            autoStreamBtn.textContent = "AUTO-STREAM: OFF";
            autoStreamBtn.className = "btn btn-autostream";
        }
    }

    // 5. Counters
    document.getElementById("stat-total").textContent = data.total_settlements || 0;
    document.getElementById("stat-settled").textContent = data.settled_count || 0;
    document.getElementById("stat-blocked").textContent = data.blocked_count || 0;

    // 6. Settlement Table
    if (data.settlement_logs) {
        settlementLogs = data.settlement_logs;
        renderLedger(data.settlement_logs);
    }
}

function renderLedger(logs) {
    const tbody = document.getElementById("settlement-tbody");
    if (!tbody) return;

    if (!logs || logs.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="7">No settlement batches executed yet. Click "SETTLE BATCH" to begin.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = logs.map((log, index) => {
        const isSettled = log.status === "SETTLED";
        const tagClass = isSettled ? "status-tag settled" : "status-tag blocked";
        return `
            <tr>
                <td style="font-family: var(--font-mono); color: var(--text-dim);">${log.time}</td>
                <td><code style="font-family: var(--font-mono); font-weight: 700;">${log.batch_id}</code></td>
                <td style="font-family: var(--font-mono); font-weight: 700;">${log.amount} ${log.currency}</td>
                <td style="font-family: var(--font-mono);">${log.tx_count || 0}</td>
                <td style="font-family: var(--font-mono); font-weight: 700; color: ${parseFloat(log.qber) >= 11.0 ? 'var(--color-red)' : 'var(--color-green)'};">${log.qber}</td>
                <td><span class="${tagClass}">${log.status}</span></td>
                <td>
                    <button class="btn-view" onclick="openDetailModal(${index})">View Payload</button>
                </td>
            </tr>
        `;
    }).join("");
}

// User Actions
function triggerSettle() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: "SETTLE" }));
    }
}

function toggleEve(checked) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: "TOGGLE_EVE", value: checked }));
    }
}

function toggleTamper(checked) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: "TOGGLE_TAMPER", value: checked }));
    }
}

function toggleAutoStream() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: "TOGGLE_AUTO_STREAM" }));
    }
}

// Modal Inspection
function openDetailModal(index) {
    const log = settlementLogs[index];
    if (!log) return;

    document.getElementById("modal-title").textContent = `BATCH INSPECTION: ${log.batch_id}`;
    const payloadToShow = log.batch_detail || {
        status: log.status,
        batch_id: log.batch_id,
        amount: log.amount,
        qber: log.qber,
        reason: log.reason,
        timestamp: log.time,
    };
    document.getElementById("modal-json").textContent = JSON.stringify(payloadToShow, null, 2);
    document.getElementById("detail-modal").classList.remove("hidden");
}

function closeModal(event) {
    if (event && event.target && event.target !== document.getElementById("detail-modal") && !event.target.classList.contains("modal-close")) {
        return;
    }
    document.getElementById("detail-modal").classList.add("hidden");
}

// Document Ready Setup
window.addEventListener("DOMContentLoaded", () => {
    connectWebSocket();
});
