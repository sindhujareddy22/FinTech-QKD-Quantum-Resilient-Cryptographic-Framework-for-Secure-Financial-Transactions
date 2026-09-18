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
let lastProcessedLogId = null;

// Eve Terminal State
let terminalHistory = [];
let terminalHistoryIndex = -1;
let terminalInitialized = false;

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

    // Role-based visibility: Strictly hide Bank-only attack controls & Terminal on Clearing House
    const settleBtn = document.getElementById("btn-settle");
    const autoStreamBtn = document.getElementById("btn-autostream");
    const eveTermBtn = document.getElementById("btn-eve-terminal");
    const advDeck = document.querySelector(".adversary-deck");

    if (data.role === "clearing") {
        if (settleBtn) settleBtn.style.display = "none";
        if (autoStreamBtn) autoStreamBtn.style.display = "none";
        if (eveTermBtn) eveTermBtn.style.display = "none";
        if (advDeck) advDeck.style.display = "none";
        const termModal = document.getElementById("eve-terminal-modal");
        if (termModal && !termModal.classList.contains("hidden")) {
            termModal.classList.add("hidden");
        }
    } else {
        if (settleBtn) settleBtn.style.display = "inline-flex";
        if (autoStreamBtn) autoStreamBtn.style.display = "inline-flex";
        if (eveTermBtn) eveTermBtn.style.display = "inline-flex";
        if (advDeck) advDeck.style.display = "block";
    }

    // Update Terminal telemetry strip if present
    const termLinkDesc = document.getElementById("term-link-desc");
    const termEveState = document.getElementById("term-eve-state-text");
    const termBadge = document.getElementById("term-eve-status-badge");
    if (termLinkDesc) {
        termLinkDesc.textContent = `Bank A (${data.host}:${data.port}) ──[1550nm Optical Link]──► Clearing (${data.peer_host}:${data.peer_port})`;
    }
    if (termEveState) {
        termEveState.textContent = data.eve_active ? "ARMED & INTERCEPTING" : "STANDBY (DISARMED)";
        termEveState.className = data.eve_active ? "target-val text-crimson font-mono font-bold" : "target-val text-muted font-mono";
    }
    if (termBadge) {
        if (data.eve_active) {
            termBadge.textContent = "ARMED // INTERCEPTING";
            termBadge.className = "eve-term-status active";
        } else {
            termBadge.textContent = "STANDBY // READY";
            termBadge.className = "eve-term-status";
        }
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

    // 5. Controls & Status sync
    const advCardStatus = document.getElementById("adv-card-status");
    if (advCardStatus) {
        if (data.eve_active) {
            advCardStatus.textContent = "EVE ARMED (INTERCEPTING)";
            advCardStatus.className = "adv-badge-status active font-mono";
        } else {
            advCardStatus.textContent = "TERMINAL READY (DISARMED)";
            advCardStatus.className = "adv-badge-status font-mono";
        }
    }

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

    // Check for new settlement log to push to terminal live feed
    if (data.settlement_logs && data.settlement_logs.length > 0) {
        const latestLog = data.settlement_logs[0];
        if (latestLog && latestLog.id !== lastProcessedLogId) {
            lastProcessedLogId = latestLog.id;
            onNewSettlementLog(latestLog);
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
    } else {
        fetch("/api/settle", { method: "POST" }).catch(e => console.log("Settle REST fallback error:", e));
    }
}

function toggleEve(checked) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: "TOGGLE_EVE", value: checked }));
    }
    fetch("/api/eve/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: checked })
    }).catch(e => console.log("Eve toggle REST error:", e));
}

function toggleTamper(checked) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: "TOGGLE_TAMPER", value: checked }));
    }
    fetch("/api/eve/tamper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: checked })
    }).catch(e => console.log("Tamper toggle REST error:", e));
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

// ==========================================================================
// EVE ADVERSARY HACKER TERMINAL CONTROLLER
// ==========================================================================

function openEveTerminal() {
    console.log("[EVE TERMINAL] openEveTerminal triggered.");
    const modal = document.getElementById("eve-terminal-modal");
    if (!modal) {
        console.error("Modal element #eve-terminal-modal not found!");
        return;
    }

    modal.classList.remove("hidden");
    modal.style.setProperty("display", "flex", "important");
    modal.style.setProperty("visibility", "visible", "important");
    modal.style.setProperty("pointer-events", "auto", "important");

    if (!terminalInitialized) {
        initTerminalWelcome();
        terminalInitialized = true;
    }

    const input = document.getElementById("terminal-input");
    if (input) {
        setTimeout(() => {
            input.focus();
        }, 50);
    }
    scrollTerminalToBottom();
}

function closeEveTerminal(event) {
    if (event && event.target && event.target !== document.getElementById("eve-terminal-modal") && !event.target.classList.contains("btn-close-modal") && !event.target.classList.contains("dot-close") && !event.target.classList.contains("dot-min")) {
        return;
    }
    const modal = document.getElementById("eve-terminal-modal");
    if (modal) {
        modal.classList.add("hidden");
        modal.style.setProperty("display", "none", "important");
        modal.style.setProperty("visibility", "hidden", "important");
        modal.style.setProperty("pointer-events", "none", "important");
    }
}

function clearTerminalOutput() {
    const output = document.getElementById("terminal-output");
    if (output) {
        output.innerHTML = "";
        appendTermLine("[*] Terminal buffer cleared. Type 'help' for attacker command reference.", "term-muted");
    }
}

function initTerminalWelcome() {
    const output = document.getElementById("terminal-output");
    if (!output) return;

    output.innerHTML = "";

    const asciiArt = `
  ███████╗██╗   ██╗███████╗    ████████╗███████╗██████╗ ███╗   ███╗
  ██╔════╝██║   ██║██╔════╝    ╚══██╔══╝██╔════╝██╔══██╗████╗ ████║
  █████╗  ██║   ██║█████╗         ██║   █████╗  ██████╔╝██╔████╔██║
  ██╔══╝  ╚██╗ ██╔╝██╔══╝         ██║   ██╔══╝  ██╔══██╗██║╚██╔╝██║
  ███████╗ ╚████╔╝ ███████╗       ██║   ███████╗██║  ██║██║ ╚═╝ ██║
  ╚══════╝  ╚═══╝  ╚══════╝       ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝
  [ QUANTUM FIBER TAP & INTERCEPT SYSTEM • INTERBANK ATTACK VECTOR ]
`;

    appendTermLine(asciiArt, "term-ascii");
    appendTermLine("[*] Optical wiretap established on 1550nm interbank quantum fiber link.", "term-info");
    appendTermLine(`[*] Target Peer: ${currentStatus.peer_host || "192.168.136.189"}:${currentStatus.peer_port || 8001} (Clearing House)`, "term-muted");
    appendTermLine("[*] Tap Mechanism: Beam-Splitter Intercept-Measure-Resend.", "term-muted");
    appendTermLine("[+] Type 'attack' to fire an eavesdropping attack round, or 'help' for commands.", "term-success");
    appendTermLine("────────────────────────────────────────────────────────────────────────", "term-muted");
}

function appendTermLine(text, className = "term-info") {
    const output = document.getElementById("terminal-output");
    if (!output) return;

    const line = document.createElement("div");
    line.className = `term-line ${className}`;
    line.textContent = text;
    output.appendChild(line);
    scrollTerminalToBottom();
}

function scrollTerminalToBottom() {
    const output = document.getElementById("terminal-output");
    if (output) {
        output.scrollTop = output.scrollHeight;
    }
}

function handleTerminalKey(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        submitTerminalInput();
    } else if (event.key === "ArrowUp") {
        event.preventDefault();
        if (terminalHistory.length > 0 && terminalHistoryIndex < terminalHistory.length - 1) {
            terminalHistoryIndex++;
            const input = document.getElementById("terminal-input");
            input.value = terminalHistory[terminalHistory.length - 1 - terminalHistoryIndex];
        }
    } else if (event.key === "ArrowDown") {
        event.preventDefault();
        if (terminalHistoryIndex > 0) {
            terminalHistoryIndex--;
            const input = document.getElementById("terminal-input");
            input.value = terminalHistory[terminalHistory.length - 1 - terminalHistoryIndex];
        } else if (terminalHistoryIndex === 0) {
            terminalHistoryIndex = -1;
            const input = document.getElementById("terminal-input");
            input.value = "";
        }
    }
}

function submitTerminalInput() {
    const input = document.getElementById("terminal-input");
    if (!input) return;
    const cmd = input.value.trim();
    if (!cmd) return;

    terminalHistory.push(cmd);
    terminalHistoryIndex = -1;
    input.value = "";

    executeTermCommand(cmd);
}

function executeTermCommand(rawCmd) {
    const cmd = rawCmd.trim();
    const cmdLower = cmd.toLowerCase();

    // Print command prompt echo
    appendTermLine(`eve@quantum-tap:~$ ${cmd}`, "term-prompt-line");

    if (cmdLower === "help" || cmdLower === "?") {
        appendTermLine("AVAILABLE EVE ATTACK COMMANDS:", "term-warn");
        appendTermLine("  attack                - Arm Eve and immediately transmit an attacked batch (~25% QBER)", "term-info");
        appendTermLine("  attack --send         - Same as 'attack'", "term-info");
        appendTermLine("  inject / hack         - Same as 'attack'", "term-info");
        appendTermLine("  disarm                - Disarm Eve & transmit clean settlement (recovers to 0.0% QBER)", "term-info");
        appendTermLine("  tamper                - Flip ciphertext bytes & transmit (tests AES-GCM auth tag rejection)", "term-info");
        appendTermLine("  settle                - Send standard settlement batch in current link state", "term-info");
        appendTermLine("  status                - View real-time quantum tap & link telemetry", "term-info");
        appendTermLine("  clear                 - Clear the terminal screen output", "term-info");
        appendTermLine("  exit / quit           - Close the attacker terminal window", "term-info");
    } else if (
        cmdLower === "attack" ||
        cmdLower === "attack --send" ||
        cmdLower === "attack -s" ||
        cmdLower === "attack --now" ||
        cmdLower === "inject" ||
        cmdLower === "hack" ||
        cmdLower === "strike" ||
        cmdLower === "run attack" ||
        cmdLower === "start attack" ||
        cmdLower === "eavesdrop" ||
        cmdLower === "intercept" ||
        cmdLower === "tap" ||
        cmdLower === "eve" ||
        cmdLower === "eve on"
    ) {
        toggleEve(true);
        appendTermLine("[+] [OPTICAL FIBER TAP ARMED] Beam-splitter mirror activated on 1550nm line.", "term-alert");
        appendTermLine("[+] Intercept-Measure-Resend active across Alice's photon stream.", "term-alert");
        appendTermLine("[!] Wavefunction collapse induced: Expected QBER ~25.0% (Safety threshold: 11.0%).", "term-warn");
        appendTermLine("[*] Dispatching settlement batch under quantum eavesdropping tap...", "term-info");
        setTimeout(() => {
            triggerSettle();
        }, 120);
    } else if (
        cmdLower === "disarm" ||
        cmdLower === "stop" ||
        cmdLower === "clean" ||
        cmdLower === "reset" ||
        cmdLower === "clear-tap" ||
        cmdLower === "eve off" ||
        cmdLower === "off"
    ) {
        toggleEve(false);
        toggleTamper(false);
        appendTermLine("[*] [OPTICAL TAP DISENGAGED] Eve interceptor completely disarmed.", "term-success");
        appendTermLine("[*] Quantum optical channel restored to clean state (0.0% QBER).", "term-success");
        appendTermLine("[*] Transmitting clean settlement batch...", "term-info");
        setTimeout(() => {
            triggerSettle();
        }, 120);
    } else if (
        cmdLower === "tamper" ||
        cmdLower === "tamper on" ||
        cmdLower === "tamper --on" ||
        cmdLower === "tamper --send"
    ) {
        toggleTamper(true);
        appendTermLine("[+] [CIPHERTEXT TAMPER ACTIVE] 1 byte flipped in AES-256-GCM encrypted payload.", "term-alert");
        appendTermLine("[!] Dispatching tampered payload to Clearing House (GCM auth tag will fail)...", "term-warn");
        setTimeout(() => {
            triggerSettle();
        }, 120);
    } else if (cmdLower === "tamper off" || cmdLower === "tamper --off") {
        toggleTamper(false);
        appendTermLine("[*] Ciphertext bit tampering disabled.", "term-info");
    } else if (cmdLower === "settle" || cmdLower === "send" || cmdLower === "transmit" || cmdLower === "settle batch") {
        appendTermLine("[*] Dispatching settlement batch across interbank link...", "term-info");
        triggerSettle();
    } else if (cmdLower === "status") {
        appendTermLine("--- QUANTUM TAP TELEMETRY ---", "term-warn");
        appendTermLine(`  Node Role:        ${currentStatus.role ? currentStatus.role.toUpperCase() : "BANK A"}`, "term-info");
        appendTermLine(`  Peer Endpoint:    ${currentStatus.peer_host}:${currentStatus.peer_port}`, "term-info");
        appendTermLine(`  Eve Interceptor:  ${currentStatus.eve_active ? "ARMED [ACTIVE INTERCEPT]" : "DISARMED [INACTIVE]"}`, currentStatus.eve_active ? "term-alert" : "term-success");
        appendTermLine(`  Tamper Active:    ${currentStatus.tamper_active ? "ENABLED [BIT-FLIP]" : "DISABLED"}`, currentStatus.tamper_active ? "term-warn" : "term-muted");
        appendTermLine(`  Latest QBER:      ${(currentStatus.latest_qber || 0).toFixed(1)}% (Threshold: ${currentStatus.qber_threshold || 11.0}%)`, currentStatus.latest_qber >= 11 ? "term-alert" : "term-success");
        appendTermLine(`  Channel Status:   ${currentStatus.channel_secure ? "SECURE" : "COMPROMISED"}`, currentStatus.channel_secure ? "term-success" : "term-alert");
        appendTermLine(`  Ledger Stats:     Total: ${currentStatus.total_settlements || 0} | Settled: ${currentStatus.settled_count || 0} | Blocked: ${currentStatus.blocked_count || 0}`, "term-info");
    } else if (cmdLower === "clear" || cmdLower === "cls") {
        clearTerminalOutput();
    } else if (cmdLower === "exit" || cmdLower === "quit" || cmdLower === "close") {
        closeEveTerminal();
    } else {
        appendTermLine(`[-] Unknown command: '${cmd}'. Type 'help' for available attacker commands.`, "term-alert");
    }
}

function onNewSettlementLog(log) {
    if (!log) return;
    
    // If the terminal has been opened, log the intercept result
    if (log.status === "BLOCKED") {
        appendTermLine(`────────────────────────────────────────────────────────────────────────`, "term-muted");
        appendTermLine(`[!] [BATCH INTERCEPTED & BLOCKED] Batch ID: ${log.batch_id}`, "term-alert");
        appendTermLine(`    Measured QBER: ${log.qber} (Safety Threshold: ${currentStatus.qber_threshold || 11.0}%)`, "term-warn");
        appendTermLine(`    Reason: ${log.reason || "Eavesdropper detected"}`, "term-alert");
        appendTermLine(`    Security Result: Bank A aborted transmission. ZERO financial bytes transmitted.`, "term-success");
    } else if (log.status === "SETTLED") {
        appendTermLine(`────────────────────────────────────────────────────────────────────────`, "term-muted");
        appendTermLine(`[*] [CLEAN SETTLEMENT TRANSMITTED] Batch ID: ${log.batch_id} (${log.amount})`, "term-success");
        appendTermLine(`    QBER: ${log.qber} | Status: SETTLED via QKD + Kyber + AES-256-GCM`, "term-info");
    }
}

// Expose functions globally for inline HTML event handlers
window.openEveTerminal = openEveTerminal;
window.closeEveTerminal = closeEveTerminal;
window.clearTerminalOutput = clearTerminalOutput;
window.handleTerminalKey = handleTerminalKey;
window.submitTerminalInput = submitTerminalInput;
window.executeTermCommand = executeTermCommand;
window.triggerSettle = triggerSettle;
window.toggleEve = toggleEve;
window.toggleTamper = toggleTamper;
window.toggleAutoStream = toggleAutoStream;
window.openDetailModal = openDetailModal;
window.closeModal = closeModal;
window.copyModalJson = copyModalJson;
window.setFilter = setFilter;
window.filterLedger = filterLedger;

// Document Ready Setup
window.addEventListener("DOMContentLoaded", () => {
    connectWebSocket();
});


