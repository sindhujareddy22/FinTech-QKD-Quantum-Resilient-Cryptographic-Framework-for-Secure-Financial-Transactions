/**
 * FinTech QKD Institutional Ops Console • Frontend Controller
 * =============================================================
 * Real-time WebSocket manager, optical fiber particle visualizer,
 * radial QBER gauge renderer, protocol stepper, and ISO 20022 inspector.
 */

let ws = null;
let currentStatus = {};
let allSettlementLogs = [];
let audioEnabled = true;
let audioCtx = null;
let particleInterval = null;

// Initialize Web Audio API for subtle institutional feedback chimes
function initAudio() {
    if (!audioCtx) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn("Web Audio API not supported:", e);
        }
    }
}

function playSettlementChime() {
    if (!audioEnabled || !audioCtx) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880.00, audioCtx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
    } catch (e) {
        console.error("Audio error:", e);
    }
}

function playAlertBuzz() {
    if (!audioEnabled || !audioCtx) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        osc.frequency.setValueAtTime(160, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
    } catch (e) {
        console.error("Audio error:", e);
    }
}

function toggleAudio() {
    audioEnabled = !audioEnabled;
    const icon = document.getElementById("audio-icon");
    icon.innerHTML = audioEnabled ? "&#128266;" : "&#128263;";
    if (audioEnabled) initAudio();
}

// Optical Fiber Photon Stream Visualizer
function startPhotonVisualizer() {
    const container = document.getElementById("particles-container");
    if (!container) return;

    if (particleInterval) clearInterval(particleInterval);

    particleInterval = setInterval(() => {
        const photon = document.createElement("div");
        const isEve = currentStatus && currentStatus.eve_active;
        const bases = ["|0⟩", "|1⟩", "|+⟩", "|-⟩"];
        const randomState = bases[Math.floor(Math.random() * bases.length)];

        photon.className = isEve ? "photon-particle compromised" : "photon-particle";
        photon.textContent = randomState;
        photon.style.top = `${Math.floor(Math.random() * 12) + 6}px`;

        container.appendChild(photon);

        setTimeout(() => {
            if (photon && photon.parentNode) {
                photon.parentNode.removeChild(photon);
            }
        }, 1800);
    }, 380);
}

// Radial Speedometer Gauge Calculation
function updateGauge(qberPercent) {
    const fillArc = document.getElementById("gauge-fill-arc");
    if (!fillArc) return;

    // Total arc length is ~204 units
    const maxScale = 50.0; // 50% QBER maps to full arc
    const clampedQber = Math.min(maxScale, Math.max(0, qberPercent));
    const ratio = clampedQber / maxScale;
    const offset = 204 - (204 * ratio);

    fillArc.style.strokeDashoffset = offset;

    if (qberPercent >= 11.0) {
        fillArc.classList.add("compromised");
    } else {
        fillArc.classList.remove("compromised");
    }
}

// Stepper Progress Animation
function animateStepper(isSuccess) {
    const steps = [1, 2, 3, 4, 5];
    steps.forEach((s) => {
        const node = document.getElementById(`step-${s}`);
        if (!node) return;
        node.className = "step-node";
    });

    // Step 1: Pulses
    document.getElementById("step-1").classList.add("active");

    setTimeout(() => {
        // Step 2: Sifting
        document.getElementById("step-2").classList.add("active");
    }, 150);

    setTimeout(() => {
        // Step 3: QBER Gate
        const step3 = document.getElementById("step-3");
        if (isSuccess) {
            step3.classList.add("active");
            // Step 4 & 5
            setTimeout(() => document.getElementById("step-4").classList.add("active"), 150);
            setTimeout(() => document.getElementById("step-5").classList.add("active"), 300);
        } else {
            step3.classList.add("failed");
        }
    }, 300);
}

// WebSocket Connection
function connectWebSocket() {
    const loc = window.location;
    const wsProto = loc.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProto}//${loc.host}/ws`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log("WebSocket connected to FinTech QKD Node Daemon.");
        const capsule = document.getElementById("peer-capsule");
        const statusText = document.getElementById("peer-status-text");
        if (capsule) capsule.className = "peer-capsule connected";
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
        const capsule = document.getElementById("peer-capsule");
        const statusText = document.getElementById("peer-status-text");
        if (capsule) capsule.className = "peer-capsule disconnected";
        if (statusText) statusText.textContent = "DISCONNECTED";
        setTimeout(connectWebSocket, 2000);
    };
}

function handleStatusUpdate(data) {
    const prevTotal = currentStatus.total_settlements || 0;
    const isNewBatch = (data.total_settlements || 0) > prevTotal;

    currentStatus = data;

    // Header updates
    document.getElementById("node-title").textContent = data.node_name || "NODE ONLINE";
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

    // Alert Banner
    const alertBanner = document.getElementById("alert-banner");
    const alertText = document.getElementById("alert-text");
    if (data.alert_message) {
        alertText.textContent = data.alert_message;
        alertBanner.classList.remove("hidden");
    } else {
        alertBanner.classList.add("hidden");
    }

    // Channel Status Badge & Fiber Beam
    const pill = document.getElementById("channel-state-pill");
    const pillText = document.getElementById("channel-state-text");
    const fiberBeam = document.getElementById("fiber-beam");
    const eveSensor = document.getElementById("eve-sensor");

    if (data.channel_secure) {
        pill.className = "status-badge secure";
        pillText.textContent = "SECURE";
        if (fiberBeam) fiberBeam.className = "fiber-beam";
    } else {
        pill.className = "status-badge compromised";
        pillText.textContent = "COMPROMISED";
        if (fiberBeam) fiberBeam.className = "fiber-beam compromised";
    }

    if (eveSensor) {
        if (data.eve_active) {
            eveSensor.classList.add("active");
        } else {
            eveSensor.classList.remove("active");
        }
    }

    // QBER Readout & Gauge
    const qberDisplay = document.getElementById("qber-display");
    if (qberDisplay) {
        qberDisplay.textContent = `${data.latest_qber.toFixed(1)}%`;
        if (data.latest_qber >= 11.0) {
            qberDisplay.classList.add("text-crimson");
            qberDisplay.classList.remove("text-emerald");
        } else {
            qberDisplay.classList.add("text-emerald");
            qberDisplay.classList.remove("text-crimson");
        }
    }
    updateGauge(data.latest_qber);

    // Controls sync
    const toggleEveElem = document.getElementById("toggle-eve");
    const toggleTamperElem = document.getElementById("toggle-tamper");
    if (toggleEveElem) toggleEveElem.checked = !!data.eve_active;
    if (toggleTamperElem) toggleTamperElem.checked = !!data.tamper_active;

    const autoStreamText = document.getElementById("autostream-btn-text");
    if (autoStreamBtn && autoStreamText) {
        if (data.auto_stream) {
            autoStreamBtn.className = "btn btn-secondary active";
            autoStreamText.textContent = "AUTO-STREAM: ACTIVE";
        } else {
            autoStreamBtn.className = "btn btn-secondary";
            autoStreamText.textContent = "AUTO-STREAM: OFF";
        }
    }

    // Counters
    document.getElementById("stat-total").textContent = data.total_settlements || 0;
    document.getElementById("stat-settled").textContent = data.settled_count || 0;
    document.getElementById("stat-blocked").textContent = data.blocked_count || 0;

    // Logs & Stepper Animation
    if (data.settlement_logs) {
        allSettlementLogs = data.settlement_logs;
        renderLedger(allSettlementLogs);

        if (isNewBatch && allSettlementLogs.length > 0) {
            const latest = allSettlementLogs[0];
            const wasSettled = latest.status === "SETTLED";
            animateStepper(wasSettled);
            if (wasSettled) {
                playSettlementChime();
            } else {
                playAlertBuzz();
            }
        }
    }
}

function renderLedger(logs) {
    const tbody = document.getElementById("settlement-tbody");
    if (!tbody) return;

    if (!logs || logs.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-state">
                <td colspan="6">
                    <div class="empty-message">
                        <span class="empty-icon">&#128179;</span>
                        <span>No settlement batches executed yet.</span>
                        <small>Click "EXECUTE SETTLEMENT" to initiate quantum key exchange.</small>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = logs.map((log, index) => {
        const isSettled = log.status === "SETTLED";
        const badgeClass = isSettled ? "badge-pill settled" : "badge-pill blocked";
        return `
            <tr>
                <td class="font-mono text-muted">${log.time}</td>
                <td><strong class="font-mono">${log.batch_id}</strong></td>
                <td><span class="font-mono ${isSettled ? 'text-emerald' : 'text-muted'}">${log.amount} ${log.currency}</span></td>
                <td><span class="font-mono ${parseFloat(log.qber) >= 11.0 ? 'text-crimson' : 'text-emerald'}">${log.qber}</span></td>
                <td><span class="${badgeClass}">${log.status}</span></td>
                <td>
                    <button class="btn-inspect" onclick="openDetailModal(${index})">Inspect</button>
                </td>
            </tr>
        `;
    }).join("");
}

function filterLedger() {
    const query = (document.getElementById("ledger-search").value || "").toLowerCase();
    if (!query) {
        renderLedger(allSettlementLogs);
        return;
    }

    const filtered = allSettlementLogs.filter(l => 
        (l.batch_id && l.batch_id.toLowerCase().includes(query)) ||
        (l.amount && l.amount.toLowerCase().includes(query)) ||
        (l.status && l.status.toLowerCase().includes(query))
    );
    renderLedger(filtered);
}

// User Actions
function triggerSettle() {
    initAudio();
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: "SETTLE" }));
    }
}

function toggleEve(checked) {
    initAudio();
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: "TOGGLE_EVE", value: checked }));
    }
}

function toggleTamper(checked) {
    initAudio();
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: "TOGGLE_TAMPER", value: checked }));
    }
}

function toggleAutoStream() {
    initAudio();
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
            <div class="tx-item-card">
                <div class="tx-meta">
                    <span class="tx-parties">${tx.debtor_name} &rarr; ${tx.creditor_name}</span>
                    <span class="tx-ref">IBAN: ${tx.debtor_iban} | Ref: ${tx.remittance_reference}</span>
                </div>
                <div class="tx-amount">$${tx.instructed_amount.toLocaleString(undefined, {minimumFractionDigits: 2})} ${tx.currency}</div>
            </div>
        `).join("");
    } else {
        txList.innerHTML = `
            <div class="tx-item-card">
                <div class="tx-meta">
                    <span class="tx-parties text-crimson">TRANSACTION DATA BLOCKED / SUPPRESSED</span>
                    <span class="tx-ref">Reason: ${log.reason || "Security violation detected on quantum link."}</span>
                </div>
            </div>
        `;
    }

    const rawPayload = log.batch_detail || {
        status: log.status,
        batch_id: log.batch_id,
        qber: log.qber,
        reason: log.reason,
        timestamp: log.time,
    };
    document.getElementById("modal-json").textContent = JSON.stringify(rawPayload, null, 2);
    document.getElementById("detail-modal").classList.remove("hidden");
}

function closeModal(event) {
    if (event && event.target && event.target !== document.getElementById("detail-modal") && !event.target.classList.contains("btn-close")) {
        return;
    }
    document.getElementById("detail-modal").classList.add("hidden");
}

function copyModalJson() {
    const text = document.getElementById("modal-json").textContent;
    navigator.clipboard.writeText(text).then(() => {
        alert("Payload JSON copied to clipboard!");
    });
}

// Document Ready Setup
window.addEventListener("DOMContentLoaded", () => {
    connectWebSocket();
    startPhotonVisualizer();
    updateGauge(0);
});
