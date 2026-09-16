/**
 * QuPay — Quantum-Resilient Mobile UPI Payment App Frontend Controller
 */

document.addEventListener("DOMContentLoaded", () => {
  // App State
  let userBalance = 125000.0;
  let isBalanceVisible = true;
  let currentEngineLevel = 1;
  let eveActive = false;
  let enteredPin = "";
  let contacts = [];
  let selectedPayee = {
    name: "Bob Sharma",
    upi: "bob@okhdfcbank",
    avatar: "👨‍💻",
    bank: "HDFC Bank",
  };

  // Toast Helper
  const toastContainer = document.getElementById("toast-container");
  function showToast(message, type = "error") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${type === 'error' ? '🚨' : '✔'}</span> <span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // Time Display
  const deviceTime = document.getElementById("device-time");
  function updateDeviceTime() {
    const now = new Date();
    deviceTime.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  updateDeviceTime();
  setInterval(updateDeviceTime, 30000);

  // Screen Switching
  const screens = {
    home: document.getElementById("screen-home"),
    pay: document.getElementById("screen-pay"),
    pin: document.getElementById("screen-pin"),
    processing: document.getElementById("screen-processing"),
    result: document.getElementById("screen-result"),
    history: document.getElementById("screen-history"),
  };

  function switchScreen(screenName) {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    if (screens[screenName]) {
      screens[screenName].classList.add("active");
    }

    // Update Bottom Nav
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
    if (screenName === "home") document.getElementById("tab-nav-home").classList.add("active");
    if (screenName === "pay") document.getElementById("tab-nav-pay").classList.add("active");
    if (screenName === "history") document.getElementById("tab-nav-history").classList.add("active");
  }

  // Bottom Navigation
  document.getElementById("tab-nav-home").addEventListener("click", () => switchScreen("home"));
  document.getElementById("tab-nav-pay").addEventListener("click", () => openPayScreen(selectedPayee));
  document.getElementById("tab-nav-history").addEventListener("click", () => {
    fetchHistory();
    switchScreen("history");
  });

  // Home Screen Elements
  const homeBalanceDisplay = document.getElementById("home-balance-display");
  const homeEyeToggle = document.getElementById("home-eye-toggle");
  const homeRefreshBalance = document.getElementById("home-refresh-balance");
  const recentsAvatarRow = document.getElementById("recents-avatar-row");
  const telemetryStatusIcon = document.getElementById("telemetry-status-icon");
  const telemetryHeadline = document.getElementById("telemetry-headline");
  const telemetrySub = document.getElementById("telemetry-sub");
  const miniActivityFeed = document.getElementById("mini-activity-feed");

  // Top Attacker Controls
  const currentEngineLabel = document.getElementById("current-engine-label");
  const btnEngineToggle = document.getElementById("btn-engine-toggle");
  const attackerEveSwitch = document.getElementById("attacker-eve-switch");
  const eveAttackerPill = document.getElementById("eve-attacker-pill");
  const eveStatusLabel = document.getElementById("eve-status-label");

  // Balance Visibility Toggle
  homeEyeToggle.addEventListener("click", () => {
    isBalanceVisible = !isBalanceVisible;
    if (isBalanceVisible) {
      homeBalanceDisplay.textContent = `₹${userBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
      homeEyeToggle.textContent = "👁️";
    } else {
      homeBalanceDisplay.textContent = "₹••••••••";
      homeEyeToggle.textContent = "🙈";
    }
  });

  homeRefreshBalance.addEventListener("click", () => {
    homeBalanceDisplay.textContent = `₹${userBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  });

  // Engine Switch
  btnEngineToggle.addEventListener("click", () => {
    currentEngineLevel = currentEngineLevel === 1 ? 2 : 1;
    currentEngineLabel.textContent = currentEngineLevel === 1 ? "Level 1: Classical BB84" : "Level 2: Qiskit Circuits";
  });

  // Eve Attacker Switch (Runtime Mid-Stream Catch)
  attackerEveSwitch.addEventListener("change", async (e) => {
    eveActive = e.target.checked;
    if (eveActive) {
      eveAttackerPill.classList.add("active");
      eveStatusLabel.textContent = "ACTIVE (100%)";
      telemetryStatusIcon.textContent = "⚠️";
      telemetryHeadline.textContent = "Channel Under Adversary Attack";
      telemetryHeadline.style.color = "var(--accent-red)";
      telemetrySub.textContent = "Quantum superpositions perturbed by Eve (Expected QBER ~25%)";
    } else {
      eveAttackerPill.classList.remove("active");
      eveStatusLabel.textContent = "OFF (Honest)";
      telemetryStatusIcon.textContent = "🛡️";
      telemetryHeadline.textContent = "Channel Integrity: 100% Secure";
      telemetryHeadline.style.color = "var(--accent-green)";
      telemetrySub.textContent = "Observed QBER: 0.00% (Below 11.00% safety cutoff)";
    }

    try {
      await fetch("/api/eve/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: eveActive, rate: eveActive ? 1.0 : 0.0 }),
      });
    } catch (err) {
      console.error("Eve toggle error:", err);
    }
  });

  // Quick Service Shortcuts
  document.getElementById("svc-to-contact").addEventListener("click", () => openPayScreen(selectedPayee));
  document.getElementById("svc-to-upi").addEventListener("click", () => openPayScreen(selectedPayee));
  document.getElementById("svc-to-bank").addEventListener("click", () => openPayScreen(selectedPayee));
  document.getElementById("svc-check-balance").addEventListener("click", () => {
    alert(`Quantum Reserve Bank (•••• 4920)\nAvailable Balance: ₹${userBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`);
  });
  document.getElementById("btn-goto-history").addEventListener("click", () => {
    fetchHistory();
    switchScreen("history");
  });

  // Fetch Quick Pay Contacts
  async function fetchContacts() {
    try {
      const res = await fetch("/api/contacts");
      const data = await res.json();
      contacts = data.contacts;
      renderContacts();
    } catch (e) {
      console.error("Failed to load contacts:", e);
    }
  }

  function renderContacts() {
    recentsAvatarRow.innerHTML = "";
    contacts.forEach((c) => {
      const item = document.createElement("div");
      item.className = "avatar-contact-item";
      item.innerHTML = `
        <div class="contact-avatar-bubble">${c.avatar}</div>
        <span class="contact-label-name">${c.name.split(" ")[0]}</span>
      `;
      item.addEventListener("click", () => openPayScreen(c));
      recentsAvatarRow.appendChild(item);
    });
  }

  // Pay Screen Elements
  const btnBackFromPay = document.getElementById("btn-back-from-pay");
  const payeeAvatarIcon = document.getElementById("payee-avatar-icon");
  const payeeDisplayName = document.getElementById("payee-display-name");
  const payeeDisplayUpi = document.getElementById("payee-display-upi");
  const payeeDisplayBank = document.getElementById("payee-display-bank");
  const amountNumberInput = document.getElementById("amount-number-input");
  const paymentNoteField = document.getElementById("payment-note-field");
  const btnProceedCta = document.getElementById("btn-proceed-cta");
  const btnProceedLabel = document.getElementById("btn-proceed-label");

  function openPayScreen(contact) {
    selectedPayee = contact;
    payeeAvatarIcon.textContent = contact.avatar;
    payeeDisplayName.textContent = contact.name;
    payeeDisplayUpi.textContent = contact.upi;
    payeeDisplayBank.textContent = contact.bank || "HDFC Bank";
    updateProceedButton();
    switchScreen("pay");
  }

  btnBackFromPay.addEventListener("click", () => switchScreen("home"));

  function updateProceedButton() {
    const amt = parseFloat(amountNumberInput.value) || 0;
    btnProceedLabel.textContent = `PROCEED TO PAY ₹${amt.toLocaleString("en-IN")}`;
  }

  amountNumberInput.addEventListener("input", updateProceedButton);

  document.querySelectorAll(".amt-chip-btn").forEach((chip) => {
    chip.addEventListener("click", () => {
      const addVal = parseFloat(chip.dataset.add);
      const cur = parseFloat(amountNumberInput.value) || 0;
      amountNumberInput.value = cur + addVal;
      updateProceedButton();
    });
  });

  // PIN Screen Elements
  const btnCancelPin = document.getElementById("btn-cancel-pin");
  const pinTargetName = document.getElementById("pin-target-name");
  const pinTargetAmount = document.getElementById("pin-target-amount");
  const pinDots = document.querySelectorAll(".p-dot");
  const numpadBtns = document.querySelectorAll(".numpad-btn");
  const btnNumpadClear = document.getElementById("btn-numpad-clear");
  const btnNumpadSubmit = document.getElementById("btn-numpad-submit");

  btnProceedCta.addEventListener("click", () => {
    const amt = parseFloat(amountNumberInput.value);
    if (!amt || amt <= 0) {
      alert("Please enter a valid transfer amount.");
      return;
    }
    if (amt > userBalance) {
      alert("Insufficient wallet balance.");
      return;
    }

    pinTargetName.textContent = selectedPayee.name;
    pinTargetAmount.textContent = `₹${amt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
    enteredPin = "";
    updatePinDots();
    switchScreen("pin");
  });

  btnCancelPin.addEventListener("click", () => switchScreen("pay"));

  numpadBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const val = btn.dataset.val;
      if (val && enteredPin.length < 4) {
        enteredPin += val;
        updatePinDots();
        if (enteredPin.length === 4) {
          setTimeout(startProcessingPayment, 250);
        }
      }
    });
  });

  btnNumpadClear.addEventListener("click", () => {
    enteredPin = "";
    updatePinDots();
  });

  btnNumpadSubmit.addEventListener("click", () => {
    if (enteredPin.length === 4) {
      startProcessingPayment();
    } else {
      alert("Please enter a 4-digit PIN.");
    }
  });

  function updatePinDots() {
    pinDots.forEach((dot, i) => {
      if (i < enteredPin.length) dot.classList.add("filled");
      else dot.classList.remove("filled");
    });
  }

  // Processing & Coin Animation Screen Elements
  const procPayeeAvatar = document.getElementById("proc-payee-avatar");
  const procPayeeName = document.getElementById("proc-payee-name");
  const procPayeeUpi = document.getElementById("proc-payee-upi");
  const laserCoreLine = document.getElementById("laser-core-line");
  const coinsStreamLayer = document.getElementById("coins-stream-layer");
  const eveLaserIntruder = document.getElementById("eve-laser-intruder");
  const procStatusText = document.getElementById("proc-status-text");
  const procSiftedBits = document.getElementById("proc-sifted-bits");
  const procQberVal = document.getElementById("proc-qber-val");
  const procQberPill = document.getElementById("proc-qber-pill");

  // Result Screen Elements
  const resultHeroBox = document.getElementById("result-hero-box");
  const resultIconCircle = document.getElementById("result-icon-circle");
  const resultTitle = document.getElementById("result-title");
  const resultAmountHeadline = document.getElementById("result-amount-headline");
  const resultSubtitle = document.getElementById("result-subtitle");
  const recTxnId = document.getElementById("rec-txn-id");
  const recSecurityStatus = document.getElementById("rec-security-status");
  const recGmacTag = document.getElementById("rec-gmac-tag");
  const btnResultDone = document.getElementById("btn-result-done");

  function spawnCoins() {
    coinsStreamLayer.innerHTML = "";
    for (let i = 0; i < 7; i++) {
      const c = document.createElement("div");
      c.className = "golden-coin-3d";
      c.textContent = "₹";
      c.style.animationDelay = `${i * 0.16}s`;
      coinsStreamLayer.appendChild(c);
    }
  }

  function freezeCoinsAlarm() {
    document.querySelectorAll(".golden-coin-3d").forEach((c) => {
      c.classList.add("frozen");
    });
    laserCoreLine.classList.add("alarm");
    eveLaserIntruder.classList.add("active");
  }

  async function startProcessingPayment() {
    switchScreen("processing");
    const amountVal = parseFloat(amountNumberInput.value);

    procPayeeAvatar.textContent = selectedPayee.avatar;
    procPayeeName.textContent = selectedPayee.name;
    procPayeeUpi.textContent = selectedPayee.upi;

    laserCoreLine.classList.remove("alarm");
    eveLaserIntruder.classList.remove("active");
    procStatusText.textContent = "Polarizing single photons across BB84 bases...";
    procQberVal.textContent = "Scanning...";
    procSiftedBits.textContent = "--";

    spawnCoins();

    if (eveActive) {
      eveLaserIntruder.classList.add("active");
    }

    try {
      await new Promise((r) => setTimeout(r, 600));
      procStatusText.textContent = "Executing quantum public sampling & QBER verification...";

      const res = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payer_name: "Spandana Rao",
          payer_upi: "spandana@okquantum",
          payee_name: selectedPayee.name,
          payee_upi: selectedPayee.upi,
          amount: amountVal,
          currency: "₹",
          note: paymentNoteField.value,
          sim_level: currentEngineLevel,
        }),
      });

      const data = await res.json();
      await new Promise((r) => setTimeout(r, 700));

      renderPaymentResult(data, amountVal);
    } catch (err) {
      console.error("Payment Execution Error:", err);
      procStatusText.textContent = "Connection Failure: QKD Node Offline";
    }
  }

  function renderPaymentResult(data, amountVal) {
    const txn = data.transaction;
    const isSuccess = data.status === "SETTLED";
    const qberStr = data.qkd.qber_str;

    procSiftedBits.textContent = `${data.qkd.sifted_bits} bits`;
    procQberVal.textContent = qberStr;

    if (isSuccess) {
      userBalance = data.user_balance;
      if (isBalanceVisible) {
        homeBalanceDisplay.textContent = `₹${userBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
      }

      resultHeroBox.className = "result-hero-box state-success";
      resultIconCircle.textContent = "✔";
      resultTitle.textContent = "Payment Successful";
      resultAmountHeadline.textContent = `₹${amountVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
      resultSubtitle.textContent = `Paid to ${txn.payee_name} (${txn.payee_upi})`;

      recTxnId.textContent = txn.txn_id;
      recSecurityStatus.textContent = "BB84 QKD 100% Secure (QBER 0.00%)";
      recSecurityStatus.className = "rec-val text-green";
      recGmacTag.textContent = txn.gmac_tag;

      switchScreen("result");
    } else {
      freezeCoinsAlarm();
      showToast("Eavesdropper detected — payment blocked to protect your money.", "error");

      resultHeroBox.className = "result-hero-box state-blocked";
      resultIconCircle.textContent = "🚨";
      resultTitle.textContent = "Payment Blocked";
      resultAmountHeadline.textContent = `₹${amountVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
      resultSubtitle.textContent = `Secure Channel Compromised: Eavesdropping Detected (QBER ${qberStr} > 11.00%). Zero funds deducted.`;

      recTxnId.textContent = txn.txn_id;
      recSecurityStatus.textContent = `Eavesdropping Breach (${qberStr} QBER)`;
      recSecurityStatus.className = "rec-val text-red";
      recGmacTag.textContent = "[SUPPRESSED - ZERO DATA EXPOSED]";

      setTimeout(() => {
        switchScreen("result");
      }, 700);
    }
    fetchHistory();
  }

  btnResultDone.addEventListener("click", () => switchScreen("home"));

  // History Feed Elements
  const btnBackFromHistory = document.getElementById("btn-back-from-history");
  const historyFeedList = document.getElementById("history-feed-list");

  btnBackFromHistory.addEventListener("click", () => switchScreen("home"));

  async function fetchHistory() {
    try {
      const res = await fetch("/api/transactions");
      const data = await res.json();
      renderHistory(data.transactions);
      renderMiniActivity(data.transactions);
    } catch (e) {
      console.error("Failed to load history:", e);
    }
  }

  function renderHistory(txns) {
    historyFeedList.innerHTML = "";
    if (!txns || txns.length === 0) {
      historyFeedList.innerHTML = `<div class="activity-empty-state">No past transactions found.</div>`;
      return;
    }

    txns.forEach((t) => {
      const row = document.createElement("div");
      row.className = "history-item-row";
      const isSettled = t.status === "SETTLED";
      row.innerHTML = `
        <div>
          <div class="h-payee">${t.payee_name}</div>
          <div class="h-time">${t.timestamp} • Ref: ${t.txn_id.substring(0, 10)}...</div>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: 800; font-size: 0.95rem; color: #fff;">₹${Number(t.amount).toLocaleString("en-IN")}</div>
          <span class="h-status-tag ${isSettled ? 'tag-settled' : 'tag-blocked'}">${t.status} (QBER: ${t.qber_str})</span>
        </div>
      `;
      historyFeedList.appendChild(row);
    });
  }

  function renderMiniActivity(txns) {
    miniActivityFeed.innerHTML = "";
    if (!txns || txns.length === 0) {
      miniActivityFeed.innerHTML = `<div class="activity-empty-state">No payments executed yet. Tap a contact to pay!</div>`;
      return;
    }

    txns.slice(0, 2).forEach((t) => {
      const row = document.createElement("div");
      row.className = "history-item-row";
      const isSettled = t.status === "SETTLED";
      row.innerHTML = `
        <div>
          <div class="h-payee">${t.payee_name}</div>
          <div class="h-time">${t.timestamp}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: 800; font-size: 0.85rem; color: #fff;">₹${Number(t.amount).toLocaleString("en-IN")}</div>
          <span class="h-status-tag ${isSettled ? 'tag-settled' : 'tag-blocked'}">${t.status}</span>
        </div>
      `;
      miniActivityFeed.appendChild(row);
    });
  }

  // Initial Load
  fetchContacts();
  fetchHistory();
});
