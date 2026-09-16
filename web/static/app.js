/**
 * QuantumPe — India's 1st Quantum-Resilient UPI Payment App Controller
 */

document.addEventListener("DOMContentLoaded", () => {
  // Payer State
  let userBalance = 125000.0;
  let isBalanceVisible = true;
  let currentEngineLevel = 1;
  let eveEnabled = false;
  let enteredPin = "";
  let passbookHistory = [];

  // DOM Elements
  const displayBalance = document.getElementById("display-balance");
  const btnToggleBalance = document.getElementById("btn-toggle-balance");
  const btnRefreshBalance = document.getElementById("btn-refresh-balance");
  const engineLabel = document.getElementById("engine-label");
  const btnToggleEngine = document.getElementById("btn-toggle-engine");
  const eveSwitch = document.getElementById("eve-switch");
  const eveToggleBox = document.getElementById("eve-toggle-box");
  const eveStateText = document.getElementById("eve-state-text");
  const benchEveMarker = document.getElementById("bench-eve-marker");

  // Phone Clock
  const phoneTime = document.getElementById("phone-time");
  function updateTime() {
    const now = new Date();
    phoneTime.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  updateTime();
  setInterval(updateTime, 30000);

  // Payee & Amount Elements
  const contactBubbles = document.querySelectorAll(".contact-bubble");
  const selectedAvatar = document.getElementById("selected-avatar");
  const selectedName = document.getElementById("selected-name");
  const selectedUpi = document.getElementById("selected-upi");
  const payAmountInput = document.getElementById("pay-amount-input");
  const payNoteInput = document.getElementById("pay-note-input");
  const btnProceedPay = document.getElementById("btn-proceed-pay");
  const btnProceedText = document.getElementById("btn-proceed-text");
  const btnClearForm = document.getElementById("btn-clear-form");

  // Console Telemetry
  const qLiveQber = document.getElementById("q-live-qber");
  const passbookList = document.getElementById("passbook-list");
  const historyCountBadge = document.getElementById("history-count-badge");

  // PIN Modal Elements
  const pinModal = document.getElementById("pin-modal");
  const btnClosePin = document.getElementById("btn-close-pin");
  const pinPayeeName = document.getElementById("pin-payee-name");
  const pinPayeeAmount = document.getElementById("pin-payee-amount");
  const pinDots = document.querySelectorAll(".pin-dot");
  const keyBtns = document.querySelectorAll(".key-btn");
  const keyClear = document.getElementById("key-clear");
  const keySubmit = document.getElementById("key-submit");

  // Transfer Modal Elements
  const transferModal = document.getElementById("transfer-modal");
  const tPayeeAvatar = document.getElementById("t-payee-avatar");
  const tPayeeName = document.getElementById("t-payee-name");
  const tPayeeUpi = document.getElementById("t-payee-upi");
  const laserBeamCore = document.getElementById("laser-beam-core");
  const coinsContainer = document.getElementById("coins-container");
  const eveLaserTrap = document.getElementById("eve-laser-trap");
  const spinnerDot = document.getElementById("spinner-dot");
  const stepStatusMsg = document.getElementById("step-status-msg");

  const mRawBits = document.getElementById("m-raw-bits");
  const mSiftedBits = document.getElementById("m-sifted-bits");
  const mQberVal = document.getElementById("m-qber-val");
  const mQberPill = document.getElementById("m-qber-pill");

  const finalResultCard = document.getElementById("final-result-card");
  const resultBadgeStamp = document.getElementById("result-badge-stamp");
  const stampIcon = document.getElementById("stamp-icon");
  const stampTitle = document.getElementById("stamp-title");
  const stampAmount = document.getElementById("stamp-amount");
  const stampDesc = document.getElementById("stamp-desc");
  const rTxnId = document.getElementById("r-txn-id");
  const rSecurityVerdict = document.getElementById("r-security-verdict");
  const rGmacTag = document.getElementById("r-gmac-tag");
  const btnDoneModal = document.getElementById("btn-done-modal");

  // Balance Visibility Toggle
  btnToggleBalance.addEventListener("click", () => {
    isBalanceVisible = !isBalanceVisible;
    if (isBalanceVisible) {
      displayBalance.textContent = `₹${userBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
      btnToggleBalance.textContent = "👁️";
    } else {
      displayBalance.textContent = "₹••••••••";
      btnToggleBalance.textContent = "🙈";
    }
  });

  btnRefreshBalance.addEventListener("click", () => {
    displayBalance.textContent = `₹${userBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  });

  // Engine Switcher
  btnToggleEngine.addEventListener("click", () => {
    currentEngineLevel = currentEngineLevel === 1 ? 2 : 1;
    if (currentEngineLevel === 1) {
      engineLabel.textContent = "Level 1: Classical BB84";
    } else {
      engineLabel.textContent = "Level 2: Qiskit Circuits";
    }
  });

  // Eve Toggle Switch
  eveSwitch.addEventListener("change", (e) => {
    eveEnabled = e.target.checked;
    if (eveEnabled) {
      eveToggleBox.classList.add("active");
      eveStateText.textContent = "ACTIVE (100% Attack)";
      benchEveMarker.classList.add("active");
      qLiveQber.textContent = "~25.00%";
      qLiveQber.className = "mq-val font-mono text-amber";
    } else {
      eveToggleBox.classList.remove("active");
      eveStateText.textContent = "OFF (Honest)";
      benchEveMarker.classList.remove("active");
      qLiveQber.textContent = "0.00%";
      qLiveQber.className = "mq-val font-mono text-green";
    }
  });

  // Payee Selection
  contactBubbles.forEach((bubble) => {
    bubble.addEventListener("click", () => {
      contactBubbles.forEach((b) => b.classList.remove("active"));
      bubble.classList.add("active");
      selectedAvatar.textContent = bubble.dataset.avatar;
      selectedName.textContent = bubble.dataset.name;
      selectedUpi.textContent = bubble.dataset.upi;
      updatePayButtonText();
    });
  });

  // Quick Amount Chips
  document.querySelectorAll(".chip-btn").forEach((chip) => {
    chip.addEventListener("click", () => {
      const addVal = parseFloat(chip.dataset.add);
      const cur = parseFloat(payAmountInput.value) || 0;
      payAmountInput.value = cur + addVal;
      updatePayButtonText();
    });
  });

  function updatePayButtonText() {
    const amt = parseFloat(payAmountInput.value) || 0;
    btnProceedText.textContent = `Pay ₹${amt.toLocaleString("en-IN")} with Quantum Protection`;
  }
  payAmountInput.addEventListener("input", updatePayButtonText);

  btnClearForm.addEventListener("click", () => {
    payAmountInput.value = 1000;
    payNoteInput.value = "";
    updatePayButtonText();
  });

  // Step 1: Open PIN Modal
  btnProceedPay.addEventListener("click", () => {
    const amt = parseFloat(payAmountInput.value);
    if (!amt || amt <= 0) {
      alert("Please enter a valid transfer amount.");
      return;
    }
    if (amt > userBalance) {
      alert("Insufficient wallet balance.");
      return;
    }

    pinPayeeName.textContent = selectedName.textContent;
    pinPayeeAmount.textContent = `₹${amt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
    enteredPin = "";
    updatePinDots();
    pinModal.classList.add("active");
  });

  btnClosePin.addEventListener("click", () => {
    pinModal.classList.remove("active");
  });

  // PIN Keypad Handling
  keyBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.key;
      if (key && enteredPin.length < 4) {
        enteredPin += key;
        updatePinDots();
        if (enteredPin.length === 4) {
          setTimeout(startQuantumTransfer, 200);
        }
      }
    });
  });

  keyClear.addEventListener("click", () => {
    enteredPin = "";
    updatePinDots();
  });

  keySubmit.addEventListener("click", () => {
    if (enteredPin.length === 4) {
      startQuantumTransfer();
    } else {
      alert("Please enter a 4-digit PIN.");
    }
  });

  function updatePinDots() {
    pinDots.forEach((dot, idx) => {
      if (idx < enteredPin.length) dot.classList.add("filled");
      else dot.classList.remove("filled");
    });
  }

  // Step 2: Flying Coins Stream & Quantum Laser Transfer
  function spawnFlyingCoins() {
    coinsContainer.innerHTML = "";
    for (let i = 0; i < 7; i++) {
      const coin = document.createElement("div");
      coin.className = "golden-coin";
      coin.textContent = "₹";
      coin.style.animationDelay = `${i * 0.18}s`;
      coinsContainer.appendChild(coin);
    }
  }

  function freezeCoinsAlarm() {
    document.querySelectorAll(".golden-coin").forEach((c) => {
      c.classList.add("frozen");
    });
    laserBeamCore.classList.add("alarm");
    eveLaserTrap.classList.add("active");
  }

  async function startQuantumTransfer() {
    pinModal.classList.remove("active");
    const amountToPay = parseFloat(payAmountInput.value);

    // Setup Transfer Modal
    tPayeeAvatar.textContent = selectedAvatar.textContent;
    tPayeeName.textContent = selectedName.textContent;
    tPayeeUpi.textContent = selectedUpi.textContent;

    finalResultCard.style.display = "none";
    laserBeamCore.classList.remove("alarm");
    eveLaserTrap.classList.remove("active");
    spinnerDot.style.display = "block";
    stepStatusMsg.textContent = "Polarizing single photons & establishing BB84 link...";
    mQberVal.textContent = "Scanning...";
    mSiftedBits.textContent = "--";

    transferModal.classList.add("active");
    spawnFlyingCoins();

    if (eveEnabled) {
      eveLaserTrap.classList.add("active");
    }

    try {
      await new Promise((r) => setTimeout(r, 600));
      stepStatusMsg.textContent = "Measuring public sample to calculate QBER error rate...";

      const response = await fetch("/api/send-upi-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payer_name: "Spandana Rao",
          payer_upi: "spandana@okquantum",
          payee_name: selectedName.textContent,
          payee_upi: selectedUpi.textContent,
          amount: amountToPay,
          currency: "₹",
          note: payNoteInput.value,
          level: currentEngineLevel,
          num_bits: 512,
          eve_enabled: eveEnabled,
          eve_rate: eveEnabled ? 1.0 : 0.0,
        }),
      });

      const data = await response.json();
      await new Promise((r) => setTimeout(r, 700));

      handleTransferResult(data, amountToPay);
    } catch (err) {
      console.error("Payment API Error:", err);
      stepStatusMsg.textContent = "Connection Failure: QKD Node Offline";
    }
  }

  function handleTransferResult(data, amountToPay) {
    const qkd = data.qkd;
    const isSuccess = data.settlement.status === "SUCCESS";
    const qberStr = (qkd.qber * 100).toFixed(2) + "%";

    mRawBits.textContent = qkd.raw_bit_count;
    mSiftedBits.textContent = `${qkd.sifted_count} bits`;
    mQberVal.textContent = qberStr;

    spinnerDot.style.display = "none";

    if (isSuccess) {
      userBalance -= amountToPay;
      if (isBalanceVisible) {
        displayBalance.textContent = `₹${userBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
      }

      stepStatusMsg.textContent = "✔ Key Accepted • AES-256-GCM Encrypted & Settled";
      resultBadgeStamp.className = "result-badge-stamp stamp-success";
      stampIcon.textContent = "✔";
      stampTitle.textContent = "PAYMENT SUCCESSFUL";
      stampAmount.textContent = `₹${amountToPay.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
      stampDesc.textContent = `Paid to ${data.transaction.payee_name} (${data.transaction.payee_upi})`;

      rTxnId.textContent = data.transaction.txn_id;
      rSecurityVerdict.textContent = "BB84 QKD 100% Secure (QBER 0.00%)";
      rSecurityVerdict.className = "text-green";
      rGmacTag.textContent = data.settlement.encrypted_payload.tag;

      addPassbookEntry({
        txn_id: data.transaction.txn_id,
        payee: data.transaction.payee_name,
        amount: amountToPay,
        status: "SUCCESS",
        qber: qberStr,
      });
    } else {
      freezeCoinsAlarm();

      stepStatusMsg.textContent = "🚨 SECURITY ALERT: QUANTUM INTERCEPTION DETECTED!";
      resultBadgeStamp.className = "result-badge-stamp stamp-blocked";
      stampIcon.textContent = "🚨";
      stampTitle.textContent = "PAYMENT BLOCKED — EVE DETECTED";
      stampAmount.textContent = `₹${amountToPay.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
      stampDesc.textContent = `QBER (${qberStr}) exceeded 11.00% safety threshold. Zero funds deducted to prevent Harvest-Now-Decrypt-Later attack.`;

      rTxnId.textContent = data.transaction.txn_id;
      rSecurityVerdict.textContent = `Eavesdropping Alert (QBER ${qberStr} > 11.00%)`;
      rSecurityVerdict.className = "text-red";
      rGmacTag.textContent = "[SUPPRESSED - ZERO DATA EXPOSED]";

      addPassbookEntry({
        txn_id: data.transaction.txn_id,
        payee: data.transaction.payee_name,
        amount: amountToPay,
        status: "BLOCKED (EVE)",
        qber: qberStr,
      });
    }

    finalResultCard.style.display = "flex";
  }

  function addPassbookEntry(item) {
    passbookHistory.unshift(item);
    historyCountBadge.textContent = `${passbookHistory.length} transfers`;

    passbookList.innerHTML = "";
    passbookHistory.forEach((t) => {
      const row = document.createElement("div");
      row.className = "passbook-item";
      const isSuccess = t.status === "SUCCESS";
      const tagClass = isSuccess ? "badge-success-tag" : "badge-blocked-tag";
      row.innerHTML = `
        <div>
          <div style="font-weight:700; font-size:0.8rem; color:#fff;">${t.payee} • ₹${t.amount.toLocaleString("en-IN")}</div>
          <div style="font-size:0.65rem; color:#94a3b8; font-family:var(--font-mono);">${t.txn_id} • QBER: ${t.qber}</div>
        </div>
        <span class="${tagClass}">${t.status}</span>
      `;
      passbookList.appendChild(row);
    });
  }

  btnDoneModal.addEventListener("click", () => {
    transferModal.classList.remove("active");
  });
});
