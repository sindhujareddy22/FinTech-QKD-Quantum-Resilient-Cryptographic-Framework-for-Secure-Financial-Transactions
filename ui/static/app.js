/**
 * FinTech QKD Institutional Ops Console Frontend Controller
 * =========================================================
 * Manages WebSocket connection to local node daemon, handles real-time UI rendering,
 * button triggers, attacker toggle switches, and payload inspection.
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
        console.log("Connected to Node Daemon WebSocket.");
    };

    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            if (msg.type === "STATUS_UPDATE") {
                handleStatusUpdate(msg.data);
            }
        } catch (e) {
            console.error("Failed to parse incoming WebSocket message:", e);
        }
    };

    ws.onclose = () => {
        console.warn("WebSocket disconnected. Retrying in 2 seconds...");
        setTimeout(connectWebSocket, 2000);
    };

    ws.onerror = (err) => {
        console.error("WebSocket error:", err);
    };
}

function handleStatusUpdate(data) {
    currentStatus = data;

    // 1. Header Updates
    document.getElementById("node-title").textContent = data.node_name || "NODE READY";
    document.getElementById("peer-address").textContent = `${data.peer_host}:${data.peer_port}`;

    const peerBadge = document.getElementById("peer-badge");
    const peerStatusText = document.getElementById("peer-status-text");
    if (data.peer_connected) {
        peerBadge.className = "peer-badge connected";
        peerStatusText.textContent = "CONNECTED";
    } else {
        peerBadge.className = "peer-badge disconnected";
        peerStatusText.textContent = "DISCONNECTED";
    }

    // Role-specific button visibility
    const settleBtn = document.getElementById("btn-settle");
    const autoStreamBtn = document.getElementById("btn-autostream");
    if (data.role === "clearing") {
        settleBtn.style.display = "none";
        autoStreamBtn.style.display = "none";
    } else {
        settleBtn.style.display = "inline-block";
        autoStreamBtn.style.display = "inline-block";
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
        pill.className = "status-state-pill secure";
        qberFill.className = "qber-bar-fill";
    } else {
        pill.textContent = "COMPROMISED";
        pill.className = "status-state-pill compromised";
        qberFill.className = "qber-bar-fill compromised";
    }

    qberDisplay.textContent = `${data.latest_qber.toFixed(1)}%`;
    // Max scale on bar is 50%
    const barPercent = Math.min(100, (data.latest_qber / 50.0) * 100);
    qberFill.style.width = `${barPercent}%`;

    // 4. Controls state synchronization
    document.getElementById("toggle-eve").checked = !!data.eve_active;
    document.getElementById("toggle-tamper").checked = !!data.tamper_active;

    if (data.auto_stream) {
        autoStreamBtn.textContent = "AUTO-STREAM: ACTIVE";
        autoStreamBtn.className = "btn btn-secondary active";
    } else {
        autoStreamBtn.textContent = "AUTO-STREAM: OFF";
        autoStreamBtn.className = "btn btn-secondary";
    }

    // 5. Counters
    document.getElementById("stat-total").textContent = data.total_settlements || 0;
    document.getElementById("stat-settled").textContent = data.settled_count || 0;
    document.getElementById("stat-blocked").textContent = data.blocked_count || 0;

    // 6. Settlement Table
    if (data.settlement_logs) {
        settlementLogs = data.settlement_logs;
        renderSettlementTable(data.settlement_logs);
    }
}

function renderSettlementTable(logs) {
    const tbody = document.getElementById("settlement-tbody");
    if (!logs || logs.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="6">No settlement batches executed yet. Click "SETTLE BATCH" to initiate.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = logs.map((log, index) => {
        const isSettled = log.status === "SETTLED";
        const badgeClass = isSettled ? "status-badge settled" : "status-badge blocked";
        return `
            <tr>
                <td>${log.time}</td>
                <td><code>${log.batch_id}</code></td>
                <td>${log.amount} ${log.currency}</td>
                <td><code>${log.qber}</code></td>
                <td><span class="${badgeClass}">${log.status}</span></td>
                <td>
                    <button class="btn-link" onclick="openDetailModal(${index})">View Payload</button>
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

// Inspection Modal
function openDetailModal(index) {
    const log = settlementLogs[index];
    if (!log) return;

    document.getElementById("modal-title").textContent = `BATCH INSPECTION: ${log.batch_id}`;
    const payloadToShow = log.batch_detail || {
        status: log.status,
        reason: log.reason,
        qber: log.qber,
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

// Initialize on page load
window.addEventListener("DOMContentLoaded", () => {
    connectWebSocket();
});
