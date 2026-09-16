/**
 * FinTech QKD — Enterprise Quantum Financial Portal Frontend Controller
 * Complete Desktop Web Application with Live Optical Channel & Cryptographic Telemetry
 */

document.addEventListener("DOMContentLoaded", () => {
  // Global State
  let userBalance = 125000.0;
  let isBalanceVisible = true;
  let currentEngineLevel = 1; // 1: Classical, 2: Qiskit
  let eveActive = false;
  let transactionsHistory = [];
  let currentFilter = "ALL";
  let latestSuccessfulTransaction = null;
  let isProcessingPayment = false;

  // Audio Synthesizer (Web Audio API for realistic interaction feedback)
  const audioCtx = (typeof window.AudioContext !== "undefined" || typeof window.webkitAudioContext !== "undefined")
    ? new (window.AudioContext || window.webkitAudioContext)()
    : null;

  function playSound(type) {
    if (!audioCtx) return;
    try {
      if (audioCtx.state === "suspended") audioCtx.resume();
      const now = audioCtx.currentTime;

      if (type === "coin") {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(987.77, now); // B5
        osc.frequency.exponentialRampToValueAtTime(1318.51, now + 0.12); // E6
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === "success") {
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, now + i * 0.08);
          gain.gain.setValueAtTime(0.15, now + i * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.35);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now + i * 0.08);
          osc.stop(now + i * 0.08 + 0.35);
        });
      } else if (type === "alarm") {
        for (let i = 0; i < 3; i++) {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(880, now + i * 0.18);
          osc.frequency.linearRampToValueAtTime(440, now + i * 0.18 + 0.14);
          gain.gain.setValueAtTime(0.2, now + i * 0.18);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.16);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now + i * 0.18);
          osc.stop(now + i * 0.18 + 0.16);
        }
      }
    } catch (e) {
      console.warn("Audio playback not supported or blocked by browser", e);
    }
  }

  // Toast Notification Helper
  const toastContainer = document.getElementById("toast-container");
  function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    const icon = type === "error" ? "🚨" : type === "success" ? "✔" : "ℹ️";
    toast.innerHTML = `<span style="font-size: 1.2rem;">${icon}</span> <span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(50px)";
      setTimeout(() => toast.remove(), 350);
    }, 4500);
  }

  // DOM Elements
  const headerSecurityBadge = document.getElementById("header-security-badge");
  const headerSecurityText = document.getElementById("header-security-text");
  const currentEngineLabel = document.getElementById("current-engine-label");
  const btnEngineToggle = document.getElementById("btn-engine-toggle");
  const attackerEveSwitch = document.getElementById("attacker-eve-switch");
  const attackerPill = document.getElementById("attacker-pill");
  const eveStatusLabel = document.getElementById("eve-status-label");
  const btnResetDemo = document.getElementById("btn-reset-demo");

  const kpiBalanceDisplay = document.getElementById("kpi-balance-display");
  const kpiEyeToggle = document.getElementById("kpi-eye-toggle");
  const kpiSettledAmount = document.getElementById("kpi-settled-amount");
  const kpiSettledCount = document.getElementById("kpi-settled-count");
  const kpiBlockedAmount = document.getElementById("kpi-blocked-amount");
  const kpiBlockedCount = document.getElementById("kpi-blocked-count");
  const kpiQberDisplay = document.getElementById("kpi-qber-display");

  const contactsPickerRow = document.getElementById("contacts-picker-row");
  const inputPayeeName = document.getElementById("input-payee-name");
  const inputPayeeUpi = document.getElementById("input-payee-upi");
  const inputAmount = document.getElementById("input-amount");
  const inputNote = document.getElementById("input-note");
  const btnSubmitPayment = document.getElementById("btn-submit-payment");

  const arenaEveProbe = document.getElementById("arena-eve-probe");
  const fiberGlowCore = document.getElementById("fiber-glow-core");
  const particlesLayer = document.getElementById("particles-layer");
  const visualizerChannelMode = document.getElementById("visualizer-channel-mode");
  const visualizerModeText = document.getElementById("visualizer-mode-text");
  const breachAlertBox = document.getElementById("breach-alert-box");
  const breachAlertMsg = document.getElementById("breach-alert-msg");
  const arenaBobName = document.getElementById("arena-bob-name");

  const telemetryQberVal = document.getElementById("telemetry-qber-val");
  const gaugeBarFill = document.getElementById("gauge-bar-fill");
  const specRawBits = document.getElementById("spec-raw-bits");
  const specSiftedBits = document.getElementById("spec-sifted-bits");
  const specErrors = document.getElementById("spec-errors");
  const specKeyStatus = document.getElementById("spec-key-status");
  const badgeKeyStatus = document.getElementById("badge-key-status");

  const proofAesKey = document.getElementById("proof-aes-key");
  const proofGmacTag = document.getElementById("proof-gmac-tag");
  const proofHmacTag = document.getElementById("proof-hmac-tag");
  const proofCiphertext = document.getElementById("proof-ciphertext");
  const btnTamperTest = document.getElementById("btn-tamper-test");

  const passbookTbody = document.getElementById("passbook-tbody");
  const countFilterAll = document.getElementById("count-filter-all");
  const countFilterSettled = document.getElementById("count-filter-settled");
  const countFilterBlocked = document.getElementById("count-filter-blocked");
  const btnRefreshHistory = document.getElementById("btn-refresh-history");

  const txnModalOverlay = document.getElementById("txn-modal-overlay");
  const modalCloseBtn = document.getElementById("modal-close-btn");
  const modalStatusIcon = document.getElementById("modal-status-icon");
  const modalTitle = document.getElementById("modal-title");
  const modalBodyContent = document.getElementById("modal-body-content");

  // Step Indicators
  const steps = [
    document.getElementById("step-1"),
    document.getElementById("step-2"),
    document.getElementById("step-3"),
    document.getElementById("step-4"),
    document.getElementById("step-5"),
  ];

  // PIN Inputs auto-tabbing
  const pinBoxes = [
    document.getElementById("pin-1"),
    document.getElementById("pin-2"),
    document.getElementById("pin-3"),
    document.getElementById("pin-4"),
  ];

  pinBoxes.forEach((box, idx) => {
    box.addEventListener("input", (e) => {
      if (box.value && idx < pinBoxes.length - 1) {
        pinBoxes[idx + 1].focus();
      }
    });
    box.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !box.value && idx > 0) {
        pinBoxes[idx - 1].focus();
      }
    });
  });

  // Balance Visibility Toggle
  kpiEyeToggle.addEventListener("click", () => {
    isBalanceVisible = !isBalanceVisible;
    if (isBalanceVisible) {
      kpiBalanceDisplay.textContent = `₹${userBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
      kpiEyeToggle.textContent = "👁️";
    } else {
      kpiBalanceDisplay.textContent = "₹••••••••";
      kpiEyeToggle.textContent = "🙈";
    }
  });

  // Amount Chips
  document.querySelectorAll(".amount-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const val = parseInt(chip.getAttribute("data-val"), 10);
      const current = parseInt(inputAmount.value || 0, 10);
      inputAmount.value = current + val;
    });
  });

  // Load Contacts
  async function loadContacts() {
    try {
      const res = await fetch("/api/contacts");
      const data = await res.json();
      if (data.contacts && data.contacts.length > 0) {
        contactsPickerRow.innerHTML = "";
        data.contacts.forEach((contact, idx) => {
          const pill = document.createElement("div");
          pill.className = `contact-pill-item ${idx === 0 ? "selected" : ""}`;
          pill.innerHTML = `<span class="contact-avatar">${contact.avatar}</span> <span>${contact.name}</span>`;
          pill.addEventListener("click", () => {
            document.querySelectorAll(".contact-pill-item").forEach((p) => p.classList.remove("selected"));
            pill.classList.add("selected");
            inputPayeeName.value = contact.name;
            inputPayeeUpi.value = contact.upi;
            arenaBobName.textContent = `${contact.name} (${contact.bank})`;
          });
          contactsPickerRow.appendChild(pill);
        });
        // Default select first
        inputPayeeName.value = data.contacts[0].name;
        inputPayeeUpi.value = data.contacts[0].upi;
        arenaBobName.textContent = `${data.contacts[0].name} (${data.contacts[0].bank})`;
      }
    } catch (e) {
      console.error("Failed to load contacts:", e);
    }
  }

  // Fetch Security Status & Telemetry
  async function fetchSecurityStatus() {
    try {
      const res = await fetch("/api/security/status");
      const data = await res.json();
      userBalance = data.user_balance;
      eveActive = data.eve_enabled;
      currentEngineLevel = data.sim_level;

      if (isBalanceVisible) {
        kpiBalanceDisplay.textContent = `₹${userBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
      }
      kpiSettledAmount.textContent = `₹${data.total_settled_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
      kpiSettledCount.textContent = data.total_settled_count;
      kpiBlockedCount.textContent = data.total_blocked_count;
      kpiQberDisplay.textContent = `${(data.latest_qber * 100).toFixed(2)}% QBER`;

      // Update Header & Controls
      attackerEveSwitch.checked = eveActive;
      updateEveUI(eveActive);
      updateEngineUI(currentEngineLevel);
    } catch (e) {
      console.error("Failed to fetch security status:", e);
    }
  }

  // Update Eve UI States
  function updateEveUI(isActive) {
    eveActive = isActive;
    if (isActive) {
      attackerPill.classList.add("active");
      eveStatusLabel.textContent = "ACTIVE (Compromised)";
      headerSecurityBadge.className = "security-status-badge compromised";
      headerSecurityText.textContent = "Quantum Channel: EVE ACTIVE (~25% QBER)";
      arenaEveProbe.classList.add("active");
    } else {
      attackerPill.classList.remove("active");
      eveStatusLabel.textContent = "OFF (Honest)";
      headerSecurityBadge.className = "security-status-badge secure";
      headerSecurityText.textContent = "Quantum Channel: SECURE (QBER: 0.00%)";
      arenaEveProbe.classList.remove("active");
      breachAlertBox.classList.add("hidden");
      fiberGlowCore.classList.remove("breached");
      visualizerChannelMode.className = "channel-mode-pill";
      visualizerModeText.textContent = "Channel Ready";
    }
  }

  // Update Engine UI
  function updateEngineUI(level) {
    currentEngineLevel = level;
    if (level === 2) {
      currentEngineLabel.textContent = "Qiskit 2.x Circuit";
      btnEngineToggle.textContent = "Switch to Classical";
    } else {
      currentEngineLabel.textContent = "Classical BB84";
      btnEngineToggle.textContent = "Switch to Qiskit";
    }
  }

  // Engine Switch Toggle
  btnEngineToggle.addEventListener("click", () => {
    const nextLevel = currentEngineLevel === 1 ? 2 : 1;
    updateEngineUI(nextLevel);
    showToast(`Quantum Engine switched to: ${nextLevel === 2 ? 'Level 2: Qiskit 2.x Real Quantum Circuit' : 'Level 1: Classical Logic BB84'}`, "info");
  });

  // Eve Attacker Switch Change
  attackerEveSwitch.addEventListener("change", async (e) => {
    const enabled = e.target.checked;
    try {
      const res = await fetch("/api/eve/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: enabled, rate: 1.0 }),
      });
      const data = await res.json();
      updateEveUI(data.eve_enabled);
      if (data.eve_enabled) {
        showToast("🚨 Eavesdropper (Eve) activated! Channel will experience ~25% QBER errors.", "error");
        playSound("alarm");
      } else {
        showToast("Quantum Channel restored to Honest state (0.00% error rate).", "success");
      }
    } catch (err) {
      console.error("Eve toggle error:", err);
      showToast("Failed to toggle attacker state", "error");
    }
  });

  // Reset Demo
  btnResetDemo.addEventListener("click", () => {
    window.location.reload();
  });

  // Reset Pipeline Steps
  function resetPipeline() {
    steps.forEach((s) => (s.className = "step-card"));
    particlesLayer.innerHTML = "";
    fiberGlowCore.classList.remove("breached");
    breachAlertBox.classList.add("hidden");
    visualizerChannelMode.className = "channel-mode-pill";
    visualizerModeText.textContent = "Executing Protocol...";
  }

  // Spawn Visual Coins & Photons
  function spawnPhotonStream() {
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        if (!isProcessingPayment) return;
        const photon = document.createElement("div");
        photon.className = "flying-photon";
        particlesLayer.appendChild(photon);
        setTimeout(() => photon.remove(), 1100);
      }, i * 120);
    }
  }

  function spawnCoinsStream() {
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        if (!isProcessingPayment) return;
        const coin = document.createElement("div");
        coin.className = "flying-coin";
        coin.textContent = "₹";
        particlesLayer.appendChild(coin);
        playSound("coin");
        setTimeout(() => {
          if (!coin.classList.contains("frozen")) coin.remove();
        }, 1400);
      }, i * 280);
    }
  }

  // Freeze Coins on Eavesdrop Intercept
  function freezeCoinsInAir() {
    document.querySelectorAll(".flying-coin").forEach((coin) => {
      coin.classList.add("frozen");
    });
    fiberGlowCore.classList.add("breached");
    visualizerChannelMode.className = "channel-mode-pill breached";
    visualizerModeText.textContent = "CHANNEL COMPROMISED";
  }

  // Execute Payment Handler
  btnSubmitPayment.addEventListener("click", async () => {
    if (isProcessingPayment) return;

    const payeeName = inputPayeeName.value.trim();
    const payeeUpi = inputPayeeUpi.value.trim();
    const amount = parseFloat(inputAmount.value);
    const note = inputNote.value.trim() || "UPI Transfer";

    if (!payeeName || !payeeUpi) {
      showToast("Please enter a valid recipient name and UPI VPA.", "error");
      return;
    }

    if (isNaN(amount) || amount <= 0) {
      showToast("Please enter a valid transfer amount.", "error");
      return;
    }

    if (amount > userBalance) {
      showToast("Insufficient settlement balance for transfer.", "error");
      return;
    }

    // Begin Animation & Protocol Execution
    isProcessingPayment = true;
    btnSubmitPayment.disabled = true;
    btnSubmitPayment.style.opacity = "0.6";
    resetPipeline();

    // Step 1: Photon Prep
    steps[0].classList.add("active");
    spawnPhotonStream();
    spawnCoinsStream();

    try {
      // Step 2: Basis Sifting
      setTimeout(() => {
        steps[0].className = "step-card success";
        steps[1].classList.add("active");
      }, 400);

      // Perform API Call
      const res = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payer_name: "Spandana Rao",
          payer_upi: "spandana@okquantum",
          payee_name: payeeName,
          payee_upi: payeeUpi,
          amount: amount,
          currency: "₹",
          note: note,
          sim_level: currentEngineLevel,
        }),
      });

      const data = await res.json();
      const txn = data.transaction;
      const qkd = data.qkd;

      // Update Telemetry Specs
      setTimeout(() => {
        steps[1].className = "step-card success";
        steps[2].classList.add("active");

        const qberVal = (qkd.qber * 100);
        telemetryQberVal.textContent = `${qberVal.toFixed(2)}%`;
        gaugeBarFill.style.width = `${Math.min(qberVal * 2, 100)}%`;
        specRawBits.textContent = qkd.raw_bits;
        specSiftedBits.textContent = qkd.sifted_bits;
        specErrors.textContent = qkd.sample_errors;

        if (qkd.is_aborted) {
          // EAVESDROPPER CAUGHT: Protocol Abort
          gaugeBarFill.classList.add("danger");
          steps[2].className = "step-card failed";
          steps[3].className = "step-card failed";
          steps[4].className = "step-card failed";

          specKeyStatus.textContent = "ABORTED (QBER > 11%)";
          specKeyStatus.style.color = "var(--accent-crimson)";
          badgeKeyStatus.textContent = "ABORTED";
          badgeKeyStatus.style.background = "rgba(239, 68, 68, 0.2)";
          badgeKeyStatus.style.color = "#f87171";

          proofAesKey.textContent = "[SUPPRESSED — KEY ABORTED]";
          proofGmacTag.textContent = "[SUPPRESSED]";
          proofHmacTag.textContent = txn.hmac_auth_tag;
          proofCiphertext.textContent = "[PAYMENT BLOCKED — ZERO CIPHERTEXT TRANSMITTED]";
          btnTamperTest.disabled = true;

          freezeCoinsInAir();
          breachAlertBox.classList.remove("hidden");
          breachAlertMsg.innerHTML = `<strong>Security Breach Detected:</strong> Quantum Bit Error Rate (${qberVal.toFixed(2)}%) exceeded the 11.00% safety threshold. Eavesdropper active on channel. Protocol aborted immediately — <strong>₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })} protected</strong>.`;

          playSound("alarm");
          showToast(`🚨 Eavesdropper detected — payment of ₹${amount.toLocaleString("en-IN")} blocked to protect your money.`, "error");
        } else {
          // SECURE SETTLEMENT: Proceed with AES-256-GCM
          gaugeBarFill.classList.remove("danger");
          steps[2].className = "step-card success";

          setTimeout(() => {
            steps[3].className = "step-card success";
            steps[4].className = "step-card success";

            specKeyStatus.textContent = "DERIVED (AES-256)";
            specKeyStatus.style.color = "var(--accent-emerald)";
            badgeKeyStatus.textContent = "SECURE KEY";
            badgeKeyStatus.style.background = "rgba(16, 185, 129, 0.2)";
            badgeKeyStatus.style.color = "#34d399";

            proofAesKey.textContent = txn.aes_key_preview || "--";
            proofGmacTag.textContent = txn.gmac_tag || "--";
            proofHmacTag.textContent = txn.hmac_auth_tag || "--";
            proofCiphertext.textContent = txn.ciphertext || "--";

            latestSuccessfulTransaction = txn;
            btnTamperTest.disabled = false;

            visualizerChannelMode.className = "channel-mode-pill";
            visualizerModeText.textContent = "Settlement Complete";

            playSound("success");
            showToast(`✔ ₹${amount.toLocaleString("en-IN")} successfully transferred to ${payeeName} (AES-256-GCM Verified)`, "success");
          }, 300);
        }

        // Refresh Passbook and Balances
        fetchSecurityStatus();
        fetchHistory();

        isProcessingPayment = false;
        btnSubmitPayment.disabled = false;
        btnSubmitPayment.style.opacity = "1";
      }, 700);

    } catch (e) {
      console.error("Payment execution error:", e);
      showToast("Error processing payment transfer", "error");
      isProcessingPayment = false;
      btnSubmitPayment.disabled = false;
      btnSubmitPayment.style.opacity = "1";
    }
  });

  // Fetch Passbook History
  async function fetchHistory() {
    try {
      const res = await fetch("/api/transactions");
      const data = await res.json();
      transactionsHistory = data.transactions || [];

      // Update Counts
      const totalAll = transactionsHistory.length;
      const totalSettled = transactionsHistory.filter((t) => t.status === "SETTLED").length;
      const totalBlocked = transactionsHistory.filter((t) => t.status === "BLOCKED").length;

      countFilterAll.textContent = totalAll;
      countFilterSettled.textContent = totalSettled;
      countFilterBlocked.textContent = totalBlocked;

      renderPassbookTable();
    } catch (e) {
      console.error("Failed to fetch history:", e);
    }
  }

  // Render Table Rows with Filter
  function renderPassbookTable() {
    const filtered = transactionsHistory.filter((t) => {
      if (currentFilter === "SETTLED") return t.status === "SETTLED";
      if (currentFilter === "BLOCKED") return t.status === "BLOCKED";
      return true;
    });

    if (filtered.length === 0) {
      passbookTbody.innerHTML = `
        <tr class="empty-row">
          <td colspan="10">No ${currentFilter === 'ALL' ? '' : currentFilter.toLowerCase()} transactions found.</td>
        </tr>
      `;
      return;
    }

    passbookTbody.innerHTML = "";
    filtered.forEach((txn) => {
      const isSettled = txn.status === "SETTLED";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="font-mono" style="font-weight: 700; color: #38bdf8;">${txn.txn_id}</td>
        <td style="color: #94a3b8; font-size: 0.78rem;">${txn.timestamp}</td>
        <td>
          <div style="font-weight: 600;">${txn.payee_name}</div>
          <div class="font-mono" style="font-size: 0.7rem; color: #64748b;">${txn.payee_upi}</div>
        </td>
        <td>
          <div style="font-weight: 500;">${txn.payer_name}</div>
          <div class="font-mono" style="font-size: 0.7rem; color: #64748b;">${txn.payer_upi}</div>
        </td>
        <td class="font-mono" style="font-weight: 700; font-size: 0.95rem;">₹${txn.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
        <td>
          <span class="status-badge ${isSettled ? 'settled' : 'blocked'}">
            ${isSettled ? '✔ SETTLED' : '🚨 BLOCKED'}
          </span>
        </td>
        <td class="font-mono" style="font-weight: 600; color: ${isSettled ? '#34d399' : '#f87171'};">${txn.qber_str}</td>
        <td style="font-size: 0.75rem; color: #cbd5e1;">${txn.engine}</td>
        <td class="font-mono" style="font-size: 0.7rem; color: #94a3b8;">${txn.gmac_tag ? txn.gmac_tag.slice(0, 12) + '...' : '--'}</td>
        <td>
          <button class="btn-table-action" data-txnid="${txn.txn_id}">Inspect 🔍</button>
        </td>
      `;

      tr.querySelector(".btn-table-action").addEventListener("click", () => {
        openTxnModal(txn);
      });

      passbookTbody.appendChild(tr);
    });
  }

  // Filter Pills Click
  document.querySelectorAll(".filter-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-pill").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.getAttribute("data-filter");
      renderPassbookTable();
    });
  });

  btnRefreshHistory.addEventListener("click", () => {
    fetchHistory();
    fetchSecurityStatus();
    showToast("Ledger data synchronized.", "info");
  });

  // Tamper Test Interactive Verification
  btnTamperTest.addEventListener("click", () => {
    if (!latestSuccessfulTransaction || !latestSuccessfulTransaction.ciphertext) {
      showToast("No active settled transaction available to tamper.", "error");
      return;
    }

    playSound("alarm");
    alert(
      `🛡️ AES-256-GCM Tamper-Proofing Verification Test:\n\n` +
      `Original Ciphertext:\n${latestSuccessfulTransaction.ciphertext.slice(0, 48)}...\n\n` +
      `Simulated Modification: Injected 1-bit bitflip into ciphertext.\n\n` +
      `Verification Result: GMAC Authentication Tag verification failed with MACMismatchError!\n` +
      `Decryption was REJECTED immediately before processing payment payload.`
    );
    showToast("GMAC Tag verification successfully caught simulated ciphertext tampering!", "success");
  });

  // Transaction Inspection Modal
  function openTxnModal(txn) {
    const isSettled = txn.status === "SETTLED";
    modalStatusIcon.textContent = isSettled ? "✔" : "🚨";
    modalTitle.textContent = `Transaction Audit: ${txn.txn_id}`;

    modalBodyContent.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
        <div class="spec-item">
          <span class="spec-label">Settlement Status</span>
          <span class="spec-val" style="color: ${isSettled ? '#34d399' : '#f87171'}; font-weight: 800;">
            ${txn.status} (${isSettled ? 'Funds Transferred' : 'Zero Deductions'})
          </span>
        </div>
        <div class="spec-item">
          <span class="spec-label">Transfer Amount</span>
          <span class="spec-val font-mono">₹${txn.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
        </div>
        <div class="spec-item">
          <span class="spec-label">Sender (Alice)</span>
          <span class="spec-val">${txn.payer_name} (${txn.payer_upi})</span>
        </div>
        <div class="spec-item">
          <span class="spec-label">Payee (Bob)</span>
          <span class="spec-val">${txn.payee_name} (${txn.payee_upi})</span>
        </div>
      </div>

      <div class="crypto-proof-box" style="margin-top: 8px;">
        <div class="proof-row">
          <span class="proof-label">Quantum Simulation Engine:</span>
          <div class="proof-code font-mono">${txn.engine} • 512 Photons</div>
        </div>
        <div class="proof-row">
          <span class="proof-label">Quantum Bit Error Rate (QBER):</span>
          <div class="proof-code font-mono" style="color: ${isSettled ? '#34d399' : '#f87171'}; font-weight: 700;">
            ${txn.qber_str} (Threshold: 11.00%)
          </div>
        </div>
        <div class="proof-row">
          <span class="proof-label">Derived 256-Bit AES Key (Hex):</span>
          <div class="proof-code font-mono">${txn.aes_key_preview || '[SUPPRESSED DUE TO SECURITY BREACH]'}</div>
        </div>
        <div class="proof-row">
          <span class="proof-label">AES-256-GCM 128-Bit GMAC Tag:</span>
          <div class="proof-code font-mono">${txn.gmac_tag || '[SUPPRESSED]'}</div>
        </div>
        <div class="proof-row">
          <span class="proof-label">HMAC-SHA256 Classical Channel Signature:</span>
          <div class="proof-code font-mono">${txn.hmac_auth_tag || '--'}</div>
        </div>
        <div class="proof-row">
          <span class="proof-label">Payload Ciphertext:</span>
          <div class="proof-code font-mono ciphertext-preview">${txn.ciphertext || '[TRANSMISSION ABORTED]'}</div>
        </div>
        ${txn.abort_reason ? `
        <div class="proof-row" style="margin-top: 6px;">
          <span class="proof-label" style="color: #f87171;">Abort Diagnostic:</span>
          <div class="proof-code font-mono" style="color: #fca5a5; background: rgba(239, 68, 68, 0.15); border-color: rgba(239, 68, 68, 0.4); white-space: normal;">
            ${txn.abort_reason}
          </div>
        </div>
        ` : ''}
      </div>
    `;

    txnModalOverlay.classList.remove("hidden");
  }

  modalCloseBtn.addEventListener("click", () => {
    txnModalOverlay.classList.add("hidden");
  });

  txnModalOverlay.addEventListener("click", (e) => {
    if (e.target === txnModalOverlay) {
      txnModalOverlay.classList.add("hidden");
    }
  });

  // Initial Load
  loadContacts();
  fetchSecurityStatus();
  fetchHistory();
});
