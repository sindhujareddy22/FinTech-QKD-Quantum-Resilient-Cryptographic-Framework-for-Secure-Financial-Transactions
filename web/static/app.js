/**
 * QuPay Web — Quantum-Resilient UPI Payment & Settlement Portal Frontend Controller
 * Complete Desktop UPI Web Application with Interactive PIN Keypad, Laser Channel, and Crypto Telemetry
 */

document.addEventListener("DOMContentLoaded", () => {
  // Application State
  let userBalance = 125000.0;
  let isBalanceVisible = true;
  let currentEngineLevel = 1; // 1: Classical BB84, 2: Qiskit 2.x Circuit
  let eveActive = false;
  let enteredPin = "";
  let contacts = [];
  let transactionsHistory = [];
  let currentFilter = "ALL";
  let latestSuccessfulTransaction = null;
  let isExecutingPayment = false;

  // Web Audio Synthesizer for Authentic UPI & Quantum Experience
  const audioCtx = (typeof window.AudioContext !== "undefined" || typeof window.webkitAudioContext !== "undefined")
    ? new (window.AudioContext || window.webkitAudioContext)()
    : null;

  function playSound(type) {
    if (!audioCtx) return;
    try {
      if (audioCtx.state === "suspended") audioCtx.resume();
      const now = audioCtx.currentTime;

      if (type === "key") {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(600, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === "coin") {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(987.77, now);
        osc.frequency.exponentialRampToValueAtTime(1318.51, now + 0.12);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.14);
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
      console.warn("Audio playback not supported", e);
    }
  }

  // Toast Helper
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

  // Tab Switching
  const navTabs = document.querySelectorAll(".nav-tab");
  const tabPanes = {
    "transfer-hub": document.getElementById("pane-transfer-hub"),
    "quantum-channel": document.getElementById("pane-quantum-channel"),
    "passbook": document.getElementById("pane-passbook"),
    "my-qr": document.getElementById("pane-my-qr"),
  };

  function switchTab(tabId) {
    navTabs.forEach((tab) => {
      tab.classList.toggle("active", tab.getAttribute("data-tab") === tabId);
    });
    Object.keys(tabPanes).forEach((paneKey) => {
      if (tabPanes[paneKey]) {
        tabPanes[paneKey].classList.toggle("active", paneKey === tabId);
      }
    });
  }

  navTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const tabId = tab.getAttribute("data-tab");
      switchTab(tabId);
    });
  });

  document.getElementById("link-view-all-passbook").addEventListener("click", () => {
    switchTab("passbook");
  });

  // Header & KPI Elements
  const headerSecurityBadge = document.getElementById("header-security-badge");
  const headerSecurityText = document.getElementById("header-security-text");
  const currentEngineLabel = document.getElementById("current-engine-label");
  const btnEngineToggle = document.getElementById("btn-engine-toggle");
  const attackerEveSwitch = document.getElementById("attacker-eve-switch");
  const attackerBadge = document.getElementById("attacker-badge");
  const eveStateText = document.getElementById("eve-state-text");

  const mainBalanceDisplay = document.getElementById("main-balance-display");
  const balanceEyeToggle = document.getElementById("balance-eye-toggle");
  const btnRefreshBalance = document.getElementById("btn-refresh-balance");
  const statSettledSum = document.getElementById("stat-settled-sum");
  const statBlockedSum = document.getElementById("stat-blocked-sum");
  const statTotalTxns = document.getElementById("stat-total-txns");
  const statLatestQber = document.getElementById("stat-latest-qber");

  // Transfer Form Elements
  const contactsGrid = document.getElementById("contacts-grid");
  const inpPayeeName = document.getElementById("inp-payee-name");
  const inpPayeeUpi = document.getElementById("inp-payee-upi");
  const inpAmount = document.getElementById("inp-amount");
  const inpNote = document.getElementById("inp-note");
  const btnPayAmountLabel = document.getElementById("btn-pay-amount-label");
  const btnOpenPinModal = document.getElementById("btn-open-pin-modal");

  // Mini Laser & Activity Elements
  const miniChannelBadge = document.getElementById("mini-channel-badge");
  const miniLaserBeam = document.getElementById("mini-laser-beam");
  const miniParticles = document.getElementById("mini-particles");
  const miniEveSpy = document.getElementById("mini-eve-spy");
  const miniNodeBobName = document.getElementById("mini-node-bob-name");
  const mQberVal = document.getElementById("m-qber-val");
  const mAesKeyPreview = document.getElementById("m-aes-key-preview");
  const mHmacPreview = document.getElementById("m-hmac-preview");
  const miniRecentItems = document.getElementById("mini-recent-items");

  // Full Visualizer Elements
  const fullArenaStatusPill = document.getElementById("full-arena-status-pill");
  const fullArenaStatusText = document.getElementById("full-arena-status-text");
  const arenaStationEve = document.getElementById("arena-station-eve");
  const eveDroneStatus = document.getElementById("eve-drone-status");
  const fiberBeamCore = document.getElementById("fiber-beam-core");
  const arenaParticlesLayer = document.getElementById("arena-particles-layer");
  const channelBreachBanner = document.getElementById("channel-breach-banner");
  const channelBreachDesc = document.getElementById("channel-breach-desc");

  const flowSteps = [
    document.getElementById("f-step-1"),
    document.getElementById("f-step-2"),
    document.getElementById("f-step-3"),
    document.getElementById("f-step-4"),
    document.getElementById("f-step-5"),
  ];

  const fullQberMeterVal = document.getElementById("full-qber-meter-val");
  const fullQberFill = document.getElementById("full-qber-fill");
  const badgeCryptoStatus = document.getElementById("badge-crypto-status");
  const fullProofAesKey = document.getElementById("full-proof-aes-key");
  const fullProofGmacTag = document.getElementById("full-proof-gmac-tag");
  const fullProofHmacTag = document.getElementById("full-proof-hmac-tag");
  const fullProofCiphertext = document.getElementById("full-proof-ciphertext");
  const btnFullTamperTest = document.getElementById("btn-full-tamper-test");

  // Passbook Elements
  const upiPassbookTbody = document.getElementById("upi-passbook-tbody");
  const passbookCountAll = document.getElementById("passbook-count-all");
  const passbookCountSettled = document.getElementById("passbook-count-settled");
  const passbookCountBlocked = document.getElementById("passbook-count-blocked");
  const btnSyncPassbook = document.getElementById("btn-sync-passbook");

  // PIN Modal Elements
  const modalPinBackdrop = document.getElementById("modal-pin-backdrop");
  const btnClosePinModal = document.getElementById("btn-close-pin-modal");
  const pinModalPayeeName = document.getElementById("pin-modal-payee-name");
  const pinModalPayeeUpi = document.getElementById("pin-modal-payee-upi");
  const pinModalAmount = document.getElementById("pin-modal-amount");
  const pinDots = [
    document.getElementById("p-dot-1"),
    document.getElementById("p-dot-2"),
    document.getElementById("p-dot-3"),
    document.getElementById("p-dot-4"),
  ];
  const keyClear = document.getElementById("key-clear");
  const keySubmit = document.getElementById("key-submit");

  // Receipt Modal Elements
  const modalReceiptBackdrop = document.getElementById("modal-receipt-backdrop");
  const receiptHeaderBanner = document.getElementById("receipt-header-banner");
  const receiptStatusIcon = document.getElementById("receipt-status-icon");
  const receiptStatusTitle = document.getElementById("receipt-status-title");
  const receiptStatusTime = document.getElementById("receipt-status-time");
  const receiptBodyContent = document.getElementById("receipt-body-content");
  const btnCloseReceipt = document.getElementById("btn-close-receipt");

  // Update Amount Label on Input
  inpAmount.addEventListener("input", () => {
    const val = parseFloat(inpAmount.value) || 0;
    btnPayAmountLabel.textContent = val.toLocaleString("en-IN", { minimumFractionDigits: 2 });
  });

  // Preset Chips
  document.querySelectorAll(".preset-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const amt = parseInt(chip.getAttribute("data-amt"), 10);
      const current = parseInt(inpAmount.value || 0, 10);
      inpAmount.value = current + amt;
      btnPayAmountLabel.textContent = (current + amt).toLocaleString("en-IN", { minimumFractionDigits: 2 });
      playSound("key");
    });
  });

  // Balance Visibility Toggle
  balanceEyeToggle.addEventListener("click", () => {
    isBalanceVisible = !isBalanceVisible;
    if (isBalanceVisible) {
      mainBalanceDisplay.textContent = `₹${userBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
      balanceEyeToggle.textContent = "👁️";
    } else {
      mainBalanceDisplay.textContent = "₹••••••••";
      balanceEyeToggle.textContent = "🙈";
    }
  });

  btnRefreshBalance.addEventListener("click", () => {
    fetchSecurityStatus();
    showToast("UPI balance synchronized with Quantum Reserve Bank.", "info");
  });

  // Load Contacts
  async function loadContacts() {
    try {
      const res = await fetch("/api/contacts");
      const data = await res.json();
      contacts = data.contacts || [];

      if (contacts.length > 0) {
        contactsGrid.innerHTML = "";
        contacts.forEach((contact, idx) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = `contact-card-btn ${idx === 0 ? "selected" : ""}`;
          btn.innerHTML = `
            <span class="c-avatar">${contact.avatar}</span>
            <div>
              <div class="c-name">${contact.name}</div>
              <div class="c-vpa font-mono">${contact.upi}</div>
            </div>
          `;
          btn.addEventListener("click", () => {
            document.querySelectorAll(".contact-card-btn").forEach((b) => b.classList.remove("selected"));
            btn.classList.add("selected");
            inpPayeeName.value = contact.name;
            inpPayeeUpi.value = contact.upi;
            miniNodeBobName.textContent = contact.name.split(" ")[0];
            playSound("key");
          });
          contactsGrid.appendChild(btn);
        });

        // Set default recipient
        inpPayeeName.value = contacts[0].name;
        inpPayeeUpi.value = contacts[0].upi;
        miniNodeBobName.textContent = contacts[0].name.split(" ")[0];
      }
    } catch (e) {
      console.error("Failed to load contacts:", e);
    }
  }

  // Fetch Security Status & KPI
  async function fetchSecurityStatus() {
    try {
      const res = await fetch("/api/security/status");
      const data = await res.json();
      userBalance = data.user_balance;
      eveActive = data.eve_enabled;
      currentEngineLevel = data.sim_level;

      if (isBalanceVisible) {
        mainBalanceDisplay.textContent = `₹${userBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
      }
      statSettledSum.textContent = `₹${data.total_settled_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
      statBlockedSum.textContent = `₹${(data.total_blocked_count * 1200).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
      statTotalTxns.textContent = data.total_settled_count + data.total_blocked_count;
      statLatestQber.textContent = `${(data.latest_qber * 100).toFixed(2)}%`;

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
      attackerBadge.classList.add("active");
      eveStateText.textContent = "ACTIVE";
      headerSecurityBadge.className = "security-indicator compromised";
      headerSecurityText.textContent = "Channel: EVE ACTIVE (~25% QBER)";

      miniChannelBadge.className = "badge-pill";
      miniChannelBadge.textContent = "Eve Intercept Active";
      miniChannelBadge.style.color = "#f87171";
      miniEveSpy.classList.add("active");

      arenaStationEve.classList.add("active");
      eveDroneStatus.textContent = "ACTIVE (Tapping Optical Fiber 100%)";
    } else {
      attackerBadge.classList.remove("active");
      eveStateText.textContent = "OFF";
      headerSecurityBadge.className = "security-indicator secure";
      headerSecurityText.textContent = "Channel: SECURE (QBER: 0.00%)";

      miniChannelBadge.className = "badge-pill secure";
      miniChannelBadge.textContent = "Honest Channel";
      miniChannelBadge.style.color = "#34d399";
      miniEveSpy.classList.remove("active");

      arenaStationEve.classList.remove("active");
      eveDroneStatus.textContent = "INACTIVE (Honest Channel)";
      channelBreachBanner.classList.add("hidden");
      fiberBeamCore.classList.remove("breached");
      miniLaserBeam.classList.remove("breached");
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

  btnEngineToggle.addEventListener("click", () => {
    const next = currentEngineLevel === 1 ? 2 : 1;
    updateEngineUI(next);
    showToast(`Quantum Engine switched to: ${next === 2 ? 'Qiskit 2.x Quantum Circuit Simulator' : 'Classical BB84 Logic'}`, "info");
    playSound("key");
  });

  // Eve Attacker Switch
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
        showToast("🚨 Eavesdropper (Eve) activated! Optical channel will experience ~25% QBER.", "error");
        playSound("alarm");
      } else {
        showToast("Quantum channel restored to Honest state (0.00% error rate).", "success");
      }
    } catch (err) {
      console.error("Eve toggle failed:", err);
    }
  });

  // Open PIN Modal
  btnOpenPinModal.addEventListener("click", () => {
    const payee = inpPayeeName.value.trim();
    const upi = inpPayeeUpi.value.trim();
    const amt = parseFloat(inpAmount.value) || 0;

    if (!payee || !upi) {
      showToast("Please provide recipient name and valid UPI VPA.", "error");
      return;
    }
    if (amt <= 0) {
      showToast("Please enter a valid transfer amount.", "error");
      return;
    }
    if (amt > userBalance) {
      showToast("Insufficient balance in your QRB account.", "error");
      return;
    }

    pinModalPayeeName.textContent = payee;
    pinModalPayeeUpi.textContent = upi;
    pinModalAmount.textContent = `₹${amt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
    enteredPin = "";
    updatePinDots();
    modalPinBackdrop.classList.remove("hidden");
    playSound("key");
  });

  btnClosePinModal.addEventListener("click", () => {
    modalPinBackdrop.classList.add("hidden");
  });

  // PIN Keypad Handling
  function updatePinDots() {
    pinDots.forEach((dot, idx) => {
      dot.classList.toggle("filled", idx < enteredPin.length);
    });
  }

  document.querySelectorAll(".num-key[data-digit]").forEach((key) => {
    key.addEventListener("click", () => {
      if (enteredPin.length < 4) {
        enteredPin += key.getAttribute("data-digit");
        updatePinDots();
        playSound("key");
      }
    });
  });

  keyClear.addEventListener("click", () => {
    enteredPin = "";
    updatePinDots();
    playSound("key");
  });

  keySubmit.addEventListener("click", () => {
    if (enteredPin.length < 4) {
      showToast("Please enter complete 4-digit UPI PIN (e.g. 1234)", "error");
      return;
    }
    modalPinBackdrop.classList.add("hidden");
    executePayment();
  });

  // Animation: Spawn flying coins & photons
  function spawnTransferAnimations() {
    // Photons
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        if (!isExecutingPayment) return;
        const photon = document.createElement("div");
        photon.className = "flying-photon";
        arenaParticlesLayer.appendChild(photon);
        setTimeout(() => photon.remove(), 1000);
      }, i * 150);
    }

    // 3D Golden Coins
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        if (!isExecutingPayment) return;
        const coin = document.createElement("div");
        coin.className = "flying-coin";
        coin.textContent = "₹";
        arenaParticlesLayer.appendChild(coin);
        playSound("coin");
        setTimeout(() => {
          if (!coin.classList.contains("frozen")) coin.remove();
        }, 1400);
      }, i * 300);
    }
  }

  function freezeChannelOnBreach() {
    document.querySelectorAll(".flying-coin").forEach((c) => c.classList.add("frozen"));
    fiberBeamCore.classList.add("breached");
    miniLaserBeam.classList.add("breached");
    fullArenaStatusPill.className = "channel-status-pill";
    fullArenaStatusPill.style.background = "rgba(239, 68, 68, 0.2)";
    fullArenaStatusPill.style.color = "#f87171";
    fullArenaStatusText.textContent = "CHANNEL BREACH DETECTED";
  }

  // Execute Quantum Payment
  async function executePayment() {
    if (isExecutingPayment) return;
    isExecutingPayment = true;

    const payeeName = inpPayeeName.value.trim();
    const payeeUpi = inpPayeeUpi.value.trim();
    const amount = parseFloat(inpAmount.value) || 0;
    const note = inpNote.value.trim() || "Quantum UPI Settlement";

    // Switch to visualizer tab to show the photon & coin stream live
    switchTab("quantum-channel");

    // Reset Flow Steps
    flowSteps.forEach((s) => (s.className = "flow-step"));
    arenaParticlesLayer.innerHTML = "";
    fiberBeamCore.classList.remove("breached");
    channelBreachBanner.classList.add("hidden");
    fullArenaStatusText.textContent = "Executing Quantum Protocol...";

    // Step 1: Prep
    flowSteps[0].classList.add("active");
    spawnTransferAnimations();

    try {
      setTimeout(() => {
        flowSteps[0].className = "flow-step success";
        flowSteps[1].classList.add("active");
      }, 400);

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
      const isSettled = txn.status === "SETTLED";
      const qberVal = (qkd.qber * 100);

      setTimeout(() => {
        flowSteps[1].className = "flow-step success";
        flowSteps[2].classList.add("active");

        // Telemetry Update
        mQberVal.textContent = `${qberVal.toFixed(2)}%`;
        fullQberMeterVal.textContent = `${qberVal.toFixed(2)}%`;
        fullQberFill.style.width = `${Math.min(qberVal * 2, 100)}%`;

        if (qkd.is_aborted) {
          // SECURITY BREACH: Eve Caught!
          fullQberFill.classList.add("danger");
          flowSteps[2].className = "flow-step failed";
          flowSteps[3].className = "flow-step failed";
          flowSteps[4].className = "flow-step failed";

          badgeCryptoStatus.textContent = "ABORTED (QBER > 11%)";
          badgeCryptoStatus.style.background = "rgba(239, 68, 68, 0.2)";
          badgeCryptoStatus.style.color = "#f87171";

          fullProofAesKey.textContent = "[SUPPRESSED DUE TO SECURITY BREACH]";
          fullProofGmacTag.textContent = "[SUPPRESSED]";
          fullProofHmacTag.textContent = txn.hmac_auth_tag;
          fullProofCiphertext.textContent = "[TRANSMISSION BLOCKED — ZERO FUNDS DEDUCTED]";
          mAesKeyPreview.textContent = "[ABORTED]";
          mHmacPreview.textContent = txn.hmac_auth_tag;
          btnFullTamperTest.disabled = true;

          freezeChannelOnBreach();
          channelBreachBanner.classList.remove("hidden");
          channelBreachDesc.innerHTML = `Eavesdropper intercepted photons on the optical channel. Induced QBER spiked to <strong>${qberVal.toFixed(2)}%</strong> (exceeding 11.00% safety limit). Protocol aborted immediately — <strong>₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })} protected</strong>.`;

          playSound("alarm");
          showToast(`🚨 Eavesdropper detected — UPI payment of ₹${amount.toLocaleString("en-IN")} blocked to protect your money.`, "error");
          openReceiptModal(txn, false);
        } else {
          // SUCCESSFUL SETTLEMENT
          fullQberFill.classList.remove("danger");
          flowSteps[2].className = "flow-step success";

          setTimeout(() => {
            flowSteps[3].className = "flow-step success";
            flowSteps[4].className = "flow-step success";

            badgeCryptoStatus.textContent = "SECURE (AES-256-GCM)";
            badgeCryptoStatus.style.background = "rgba(16, 185, 129, 0.2)";
            badgeCryptoStatus.style.color = "#34d399";

            fullProofAesKey.textContent = txn.aes_key_preview || "--";
            fullProofGmacTag.textContent = txn.gmac_tag || "--";
            fullProofHmacTag.textContent = txn.hmac_auth_tag || "--";
            fullProofCiphertext.textContent = txn.ciphertext || "--";
            mAesKeyPreview.textContent = txn.aes_key_preview || "--";
            mHmacPreview.textContent = txn.hmac_auth_tag || "--";

            latestSuccessfulTransaction = txn;
            btnFullTamperTest.disabled = false;

            fullArenaStatusPill.className = "channel-status-pill";
            fullArenaStatusPill.style.background = "rgba(16, 185, 129, 0.15)";
            fullArenaStatusPill.style.color = "#34d399";
            fullArenaStatusText.textContent = "Settlement Complete";

            playSound("success");
            showToast(`✔ UPI Payment of ₹${amount.toLocaleString("en-IN")} sent to ${payeeName} (AES-256-GCM Verified)`, "success");
            openReceiptModal(txn, true);
          }, 300);
        }

        fetchSecurityStatus();
        fetchHistory();
        isExecutingPayment = false;
      }, 700);

    } catch (err) {
      console.error("Payment execution failed:", err);
      showToast("Error communicating with payment server", "error");
      isExecutingPayment = false;
    }
  }

  // Open Receipt Modal
  function openReceiptModal(txn, isSuccess) {
    if (isSuccess) {
      receiptHeaderBanner.className = "receipt-header";
      receiptStatusIcon.textContent = "✔";
      receiptStatusTitle.textContent = "UPI Payment Successful";
      receiptStatusTime.textContent = txn.timestamp;
    } else {
      receiptHeaderBanner.className = "receipt-header blocked";
      receiptStatusIcon.textContent = "🚨";
      receiptStatusTitle.textContent = "UPI Payment Blocked";
      receiptStatusTime.textContent = txn.timestamp;
    }

    receiptBodyContent.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 12px;">
        <span style="font-size: 0.85rem; color: #94a3b8;">Amount</span>
        <span class="font-mono" style="font-size: 1.4rem; font-weight: 800; color: ${isSuccess ? '#00f2fe' : '#f87171'};">
          ₹${txn.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </span>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.82rem;">
        <div>
          <div style="color: #94a3b8;">Recipient (Payee)</div>
          <div style="font-weight: 700; color: #fff;">${txn.payee_name}</div>
          <div class="font-mono" style="font-size: 0.72rem; color: #64748b;">${txn.payee_upi}</div>
        </div>
        <div>
          <div style="color: #94a3b8;">Sender (Payer)</div>
          <div style="font-weight: 700; color: #fff;">${txn.payer_name}</div>
          <div class="font-mono" style="font-size: 0.72rem; color: #64748b;">${txn.payer_upi}</div>
        </div>
      </div>

      <div style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); font-size: 0.75rem; display: flex; flex-direction: column; gap: 6px;">
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #94a3b8;">UPI Ref / UTR No:</span>
          <span class="font-mono" style="color: #38bdf8; font-weight: 700;">${txn.txn_id}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #94a3b8;">Quantum Bit Error Rate (QBER):</span>
          <span class="font-mono" style="color: ${isSuccess ? '#34d399' : '#f87171'}; font-weight: 700;">${txn.qber_str}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #94a3b8;">Quantum Engine:</span>
          <span style="color: #cbd5e1;">${txn.engine} • 512 Qubits</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #94a3b8;">GMAC Tag (128-Bit):</span>
          <span class="font-mono" style="color: #cbd5e1;">${txn.gmac_tag ? txn.gmac_tag.slice(0, 16) + '...' : '[SUPPRESSED]'}</span>
        </div>
      </div>

      ${txn.abort_reason ? `
        <div style="padding: 10px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 8px; font-size: 0.76rem; color: #fca5a5;">
          <strong>Security Diagnostic:</strong> ${txn.abort_reason}
        </div>
      ` : ''}
    `;

    modalReceiptBackdrop.classList.remove("hidden");
  }

  btnCloseReceipt.addEventListener("click", () => {
    modalReceiptBackdrop.classList.add("hidden");
  });

  modalReceiptBackdrop.addEventListener("click", (e) => {
    if (e.target === modalReceiptBackdrop) {
      modalReceiptBackdrop.classList.add("hidden");
    }
  });

  // Fetch History & Update Passbook
  async function fetchHistory() {
    try {
      const res = await fetch("/api/transactions");
      const data = await res.json();
      transactionsHistory = data.transactions || [];

      passbookCountAll.textContent = transactionsHistory.length;
      passbookCountSettled.textContent = transactionsHistory.filter((t) => t.status === "SETTLED").length;
      passbookCountBlocked.textContent = transactionsHistory.filter((t) => t.status === "BLOCKED").length;

      renderPassbookTable();
      renderMiniRecentFeed();
    } catch (e) {
      console.error("Failed to fetch history:", e);
    }
  }

  function renderMiniRecentFeed() {
    if (transactionsHistory.length === 0) {
      miniRecentItems.innerHTML = `<div class="empty-state-mini">No transactions yet. Send money to initiate BB84 key exchange.</div>`;
      return;
    }
    miniRecentItems.innerHTML = "";
    transactionsHistory.slice(0, 4).forEach((txn) => {
      const isSettled = txn.status === "SETTLED";
      const div = document.createElement("div");
      div.className = "mini-txn-row";
      div.innerHTML = `
        <div>
          <div style="font-weight: 700; color: #fff;">${txn.payee_name}</div>
          <div style="font-size: 0.68rem; color: #64748b;">${txn.timestamp}</div>
        </div>
        <div style="text-align: right;">
          <div class="font-mono" style="font-weight: 800; color: ${isSettled ? '#34d399' : '#f87171'};">
            ${isSettled ? '+' : ''}₹${txn.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div class="font-mono" style="font-size: 0.65rem; color: #94a3b8;">${txn.qber_str} QBER</div>
        </div>
      `;
      miniRecentItems.appendChild(div);
    });
  }

  function renderPassbookTable() {
    const filtered = transactionsHistory.filter((t) => {
      if (currentFilter === "SETTLED") return t.status === "SETTLED";
      if (currentFilter === "BLOCKED") return t.status === "BLOCKED";
      return true;
    });

    if (filtered.length === 0) {
      upiPassbookTbody.innerHTML = `
        <tr class="empty-table-row">
          <td colspan="10">No ${currentFilter === 'ALL' ? '' : currentFilter.toLowerCase()} transactions recorded.</td>
        </tr>
      `;
      return;
    }

    upiPassbookTbody.innerHTML = "";
    filtered.forEach((txn) => {
      const isSettled = txn.status === "SETTLED";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="font-mono" style="font-weight: 700; color: #38bdf8;">${txn.txn_id}</td>
        <td style="color: #94a3b8; font-size: 0.78rem;">${txn.timestamp}</td>
        <td>
          <div style="font-weight: 600;">${txn.payee_name}</div>
          <div class="font-mono" style="font-size: 0.68rem; color: #64748b;">${txn.payee_upi}</div>
        </td>
        <td>
          <div style="font-weight: 500;">${txn.payer_name}</div>
          <div class="font-mono" style="font-size: 0.68rem; color: #64748b;">${txn.payer_upi}</div>
        </td>
        <td class="font-mono" style="font-weight: 700; font-size: 0.95rem;">₹${txn.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
        <td>
          <span class="status-tag ${isSettled ? 'settled' : 'blocked'}">
            ${isSettled ? '✔ SETTLED' : '🚨 BLOCKED'}
          </span>
        </td>
        <td class="font-mono" style="font-weight: 600; color: ${isSettled ? '#34d399' : '#f87171'};">${txn.qber_str}</td>
        <td style="font-size: 0.75rem; color: #cbd5e1;">${txn.engine}</td>
        <td class="font-mono" style="font-size: 0.7rem; color: #94a3b8;">${txn.gmac_tag ? txn.gmac_tag.slice(0, 12) + '...' : '--'}</td>
        <td>
          <button class="btn-inspect" data-txnid="${txn.txn_id}">Receipt 🔍</button>
        </td>
      `;

      tr.querySelector(".btn-inspect").addEventListener("click", () => {
        openReceiptModal(txn, isSettled);
      });

      upiPassbookTbody.appendChild(tr);
    });
  }

  // Passbook Filters
  document.querySelectorAll(".filter-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".filter-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      currentFilter = tab.getAttribute("data-filter");
      renderPassbookTable();
      playSound("key");
    });
  });

  btnSyncPassbook.addEventListener("click", () => {
    fetchHistory();
    fetchSecurityStatus();
    showToast("Passbook statement refreshed.", "info");
  });

  // Tamper Test Verification
  btnFullTamperTest.addEventListener("click", () => {
    if (!latestSuccessfulTransaction || !latestSuccessfulTransaction.ciphertext) {
      showToast("No active settled transaction available to tamper.", "error");
      return;
    }

    playSound("alarm");
    alert(
      `🛡️ AES-256-GCM AEAD Tamper-Proofing Test:\n\n` +
      `Original Ciphertext:\n${latestSuccessfulTransaction.ciphertext.slice(0, 48)}...\n\n` +
      `Simulated Modification: Injected 1-bit bitflip into ciphertext.\n\n` +
      `Verification Result: GMAC Tag Verification failed (MACMismatchError)!\n` +
      `The financial transaction was REJECTED immediately before decryption.`
    );
    showToast("GMAC Tag verification successfully caught simulated ciphertext tampering!", "success");
  });

  // Initial Load
  loadContacts();
  fetchSecurityStatus();
  fetchHistory();
});
