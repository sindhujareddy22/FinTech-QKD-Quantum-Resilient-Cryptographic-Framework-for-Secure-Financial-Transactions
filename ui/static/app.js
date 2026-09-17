/**
 * FinTech QKD Executive Operations Console • Frontend Controller
 * ===============================================================
 * Real-time WebSocket connection, QBER telemetry, sparkline history,
 * ISO 20022 tabular ledger with filtering and payload inspection.
 */

let ws = null;
let currentStatus = {};
let allSettlementLogs = [];
let currentFilter = "ALL";
let qberHistory = [];

function connectWebSocket() {
    const loc = window.location;
    const wsProto = loc.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProto}//${loc.host}/ws`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log("WebSocket connected to FinTech QKD Node Daemon.");
        const badge = document.getElementById("peer-badge");
        const statusText = document.getElementById("peer-status-text");
        if (badge) badge.className = "connection-pill connected";
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
        if (badge) badge.className = "connection-pill disconnected";
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
        if (settleBtn) settleBtn.style.display = "inline-flex";
        if (autoStreamBtn) autoStreamBtn.style.display = "inline-flex";
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
    const pillText = document.getElementById("channel-state-text");
    const qberDisplay = document.getElementById("qber-display");
    const qberFill = document.getElementById("qber-bar-fill");

    if (data.channel_secure) {
        pill.className = "security-indicator secure";
        pillText.textContent = "SECURE LINK";
        qberFill.className = "meter-bar-fill";
        qberDisplay.className = "qber-big text-emerald";
    } else {
        pill.className = "security-indicator compromised";
        pillText.textContent = "COMPROMISED LINK";
        qberFill.className = "meter-bar-fill compromised";
        qberDisplay.className = "qber-big text-crimson";
    }

    qberDisplay.textContent = `${data.latest_qber.toFixed(1)}%`;
    // Max scale on meter is 50%
    const barPercent = Math.min(100, (data.latest_qber / 50.0) * 100);
    qberFill.style.width = `${barPercent}%`;

    // 4. Update QBER Sparkline History
    if (data.settlement_logs && data.settlement_logs.length > 0) {
        qberHistory = data.settlement_logs.slice(0, 10).map(l => parseFloat(l.qber) || 0).reverse();
    } else {
        qberHistory = [data.latest_qber];
    }
    renderSparklines(qberHistory);

    // 5. Controls sync
    const toggleEveElem = document.getElementById("toggle-eve");
    const toggleTamperElem = document.getElementById("toggle-tamper");
    if (toggleEveElem) toggleEveElem.checked = !!data.eve_active;
    if (toggleTamperElem) toggleTamperElem.checked = !!data.tamper_active;

    const autoStreamLabel = document.getElementById("autostream-label");
    if (autoStreamBtn && autoStreamLabel) {
        if (data.auto_stream) {
            autoStreamBtn.className = "btn btn-secondary active";
            autoStreamLabel.textContent = "AUTO-STREAM: ACTIVE";
        } else {
            autoStreamBtn.className = "btn btn-secondary";
            autoStreamLabel.textContent = "AUTO-STREAM: OFF";
        }
    }

    // 6. Counters
    document.getElementById("stat-total").textContent = data.total_settlements || 0;
    document.getElementById("stat-settled").textContent = data.settled_count || 0;
    document.getElementById("stat-blocked").textContent = data.blocked_count || 0;

    // 7. Ledger rendering
    if (data.settlement_logs) {
        allSettlementLogs = data.settlement_logs;
        applyLedgerFilters();
    }
}

function renderSparklines(history) {
    const container = document.getElementById("sparkline-bars");
    if (!container) return;

    if (!history || history.length === 0) {
        history = [0];
    }

    // Max height 28px
    container.innerHTML = history.map(q => {
        const height = Math.max(4, Math.min(30, (q / 30.0) * 30));
        const isCompromised = q >= 11.0;
        return `<div class="spark-bar ${isCompromised ? 'compromised' : ''}" style="height: ${height}px;" title="QBER: ${q.toFixed(1)}%"></div>`;
    }).join("");
}

function setFilter(filterType, element) {
    currentFilter = filterType;
    document.querySelectorAll(".filter-tab").forEach(tab => tab.classList.remove("active"));
    if (element) element.classList.add("active");
    applyLedgerFilters();
}

function filterLedger() {
    applyLedgerFilters();
}

function applyLedgerFilters() {
    const query = (document.getElementById("ledger-search").value || "").toLowerCase();
    
    let filtered = allSettlementLogs;

    if (currentFilter !== "ALL") {
        filtered = filtered.filter(l => l.status === currentFilter);
    }

    if (query) {
        filtered = filtered.filter(l => 
            (l.batch_id && l.batch_id.toLowerCase().includes(query)) ||
            (l.amount && l.amount.toLowerCase().includes(query)) ||
            (l.status && l.status.toLowerCase().includes(query))
        );
    }

    renderTable(filtered);
}

function renderTable(logs) {
    const tbody = document.getElementById("settlement-tbody");
    if (!tbody) return;

    if (!logs || logs.length === 0) {
        tbody.innerHTML = `
            <tr class="table-empty-row">
                <td colspan="7">
                    <div class="empty-state-view">
                        <span class="empty-state-icon">&bull;&bull;&bull;</span>
                        <span>No settlement transactions match criteria.</span>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = logs.map((log, index) => {
        const isSettled = log.status === "SETTLED";
        const tagClass = isSettled ? "status-tag settled" : "status-tag blocked";
        return `
            <tr>
                <td class="font-mono text-muted">${log.time}</td>
                <td><strong class="font-mono">${log.batch_id}</strong></td>
                <td><span class="font-mono ${isSettled ? 'text-emerald' : 'text-muted'}">${log.amount} ${log.currency}</span></td>
                <td class="font-mono">${log.tx_count || 0}</td>
                <td><span class="font-mono ${parseFloat(log.qber) >= 11.0 ? 'text-crimson' : 'text-emerald'}">${log.qber}</span></td>
                <td><span class="${tagClass}">${log.status}</span></td>
                <td>
                    <button class="btn-inspect" onclick="openDetailModal(${index})">Inspect</button>
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
    const log = allSettlementLogs[index];
    if (!log) return;

    document.getElementById("modal-title").textContent = `BATCH INSPECTION: ${log.batch_id}`;

    const txList = document.getElementById("modal-tx-list");
    if (log.batch_detail && log.batch_detail.transactions) {
        txList.innerHTML = log.batch_detail.transactions.map(tx => `
            <div class="order-card">
                <div class="order-parties">
                    <span class="order-names">${tx.debtor_name} &rarr; ${tx.creditor_name}</span>
                    <span class="order-ref">IBAN: ${tx.debtor_iban} | Ref: ${tx.remittance_reference}</span>
                </div>
                <div class="order-sum">$${tx.instructed_amount.toLocaleString(undefined, {minimumFractionDigits: 2})} ${tx.currency}</div>
            </div>
        `).join("");
    } else {
        txList.innerHTML = `
            <div class="order-card">
                <div class="order-parties">
                    <span class="order-names text-crimson">SETTLEMENT PAYLOAD BLOCKED / ZERO DATA EXPOSED</span>
                    <span class="order-ref">Reason: ${log.reason || "Quantum Bit Error Rate exceeded security threshold."}</span>
                </div>
            </div>
        `;
    }

    const rawPayload = log.batch_detail || {
        status: log.status,
        batch_id: log.batch_id,
        amount: log.amount,
        qber: log.qber,
        reason: log.reason,
        timestamp: log.time,
    };
    document.getElementById("modal-json").textContent = JSON.stringify(rawPayload, null, 2);
    document.getElementById("detail-modal").classList.remove("hidden");
}

function closeModal(event) {
    if (event && event.target && event.target !== document.getElementById("detail-modal") && !event.target.classList.contains("btn-close-modal")) {
        return;
    }
    document.getElementById("detail-modal").classList.add("hidden");
}

function copyModalJson() {
    const text = document.getElementById("modal-json").textContent;
    navigator.clipboard.writeText(text).then(() => {
        alert("Batch JSON copied to clipboard!");
    });
}

// Document Ready Setup
window.addEventListener("DOMContentLoaded", () => {
    connectWebSocket();
});
