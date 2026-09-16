/**
 * QuantumPay — UPI Quantum-Resilient Payment App Frontend Logic
 */

document.addEventListener("DOMContentLoaded", () => {
  // Payer State
  let currentBalance = 125000.0;
  let currentLevel = 1;
  let eveEnabled = false;
  let isProcessing = false;
  let transactionHistory = [];

  // DOM Elements
  const userBalance = document.getElementById("user-balance");
  const contactChips = document.querySelectorAll(".contact-chip");
  const inputPayeeName = document.getElementById("input-payee-name");
  const inputPayeeUpi = document.getElementById("input-payee-upi");
  const inputAmount = document.getElementById("input-amount");
  const inputNote = document.getElementById("input-note");
  const btnPayNow = document.getElementById("btn-pay-now");
  const btnPayText = document.getElementById("btn-pay-text");

  // Eve & Engine
  const toggleEve = document.getElementById("toggle-eve");
  const eveThreatPanel = document.getElementById("eve-threat-panel");
  const eveStatusBadge = document.getElementById("eve-status-badge");
  const engLevel1 = document.getElementById("eng-level-1");
  const engLevel2 = document.getElementById("eng-level-2");
  const diagIntegrity = document.getElementById("diag-integrity");
  const ledgerList = document.getElementById("ledger-list");
  const ledgerCount = document.getElementById("ledger-count");

  // Modal Elements
  const paymentModal = document.getElementById("payment-modal");
  const modalCloseBtn = document.getElementById("modal-close-btn");
  const modalPayerName = document.getElementById("modal-payer-name");
  const modalPayerUpi = document.getElementById("modal-payer-upi");
  const modalPayeeName = document.getElementById("modal-payee-name");
  const modalPayeeUpi = document.getElementById("modal-payee-upi");
  const laserLine = document.getElementById("laser-line");
  const coinStream = document.getElementById("coin-stream");
  const arenaEve = document.getElementById("arena-eve");
  const modalSpinner = document.getElementById("modal-spinner");
  const modalStatusText = document.getElementById("modal-status-text");

  const modalQubits = document.getElementById("modal-qubits");
  const modalSifted = document.getElementById("modal-sifted");
  const modalQber = document.getElementById("modal-qber");

  const modalOutcome = document.getElementById("modal-outcome");
  const outcomeStamp = document.getElementById("outcome-stamp");
  const outcomeIcon = document.getElementById("outcome-icon");
  const outcomeTitle = document.getElementById("outcome-title");
  const outcomeAmount = document.getElementById("outcome-amount");
  const outcomeDesc = document.getElementById("outcome-desc");
  const receiptTxnId = document.getElementById("receipt-txn-id");
  const receiptGmac = document.getElementById("receipt-gmac");
  const btnModalDone = document.getElementById("btn-modal-done");

  // Update Pay Button Text
  function updatePayButtonText() {
    const amt = parseFloat(inputAmount.value) || 0;
    btnPayText.textContent = `Pay ₹${amt.toLocaleString("en-IN")} with Quantum Protection`;
  }

  inputAmount.addEventListener("input", updatePayButtonText);

  // Quick Amount Chips
  document.querySelectorAll(".amt-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const addVal = parseFloat(chip.dataset.val);
      const current = parseFloat(inputAmount.value) || 0;
      inputAmount.value = current + addVal;
      updatePayButtonText();
    });
  });

  // Contact Chips Selection
  contactChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      contactChips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      inputPayeeName.value = chip.dataset.name;
      inputPayeeUpi.value = chip.dataset.upi;
    });
  });

  // Eve Toggle
  toggleEve.addEventListener("change", (e) => {
    eveEnabled = e.target.checked;
    if (eveEnabled) {
      eveThreatPanel.classList.add("attack-active");
      eveStatusBadge.className = "eve-status-badge badge-attack";
      eveStatusBadge.innerHTML = `<span>⚠️ Quantum Intercept Attack Active (Eve 100%)</span>`;
      diagIntegrity.textContent = "Under Attack";
      diagIntegrity.className = "dm-val text-red";
    } else {
      eveThreatPanel.classList.remove("attack-active");
      eveStatusBadge.className = "eve-status-badge badge-clean";
      eveStatusBadge.innerHTML = `<span>🛡️ Honest Channel (Eve Inactive • QBER 0.00%)</span>`;
      diagIntegrity.textContent = "100% Secure";
      diagIntegrity.className = "dm-val text-green";
    }
  });

  // Engine Selector
  engLevel1.addEventListener("click", () => {
    currentLevel = 1;
    engLevel1.classList.add("active");
    engLevel2.classList.remove("active");
  });

  engLevel2.addEventListener("click", () => {
    currentLevel = 2;
    engLevel2.classList.add("active");
    engLevel1.classList.remove("active");
  });

  // Spawn Flying Gold Coins
  function spawnCoins() {
    coinStream.innerHTML = "";
    for (let i = 0; i < 6; i++) {
      const coin = document.createElement("div");
      coin.className = "flying-coin";
      coin.textContent = "₹";
      coin.style.animationDelay = `${i * 0.2}s`;
      coinStream.appendChild(coin);
    }
  }

  // Freeze Coins on Attack
  function freezeCoinsWithAlarm() {
    document.querySelectorAll(".flying-coin").forEach((c) => {
      c.classList.add("freeze-alarm");
    });
    laserLine.classList.add("alarm");
    arenaEve.classList.add("active");
  }

  // Handle Payment Execution
  btnPayNow.addEventListener("click", async () => {
    if (isProcessing) return;
    const amountVal = parseFloat(inputAmount.value);
    if (!amountVal || amountVal <= 0) {
      alert("Please enter a valid transfer amount.");
      return;
    }

    if (amountVal > currentBalance) {
      alert("Insufficient wallet balance for this payment.");
      return;
    }

    isProcessing = true;
    modalOutcome.style.display = "none";
    laserLine.classList.remove("alarm");
    arenaEve.classList.remove("active");
    modalSpinner.style.display = "block";

    // Setup Modal Info
    modalPayeeName.textContent = inputPayeeName.value;
    modalPayeeUpi.textContent = inputPayeeUpi.value;
    modalStatusText.textContent = "Initiating BB84 Quantum Key Agreement...";
    modalQber.textContent = "Scanning...";
    modalSifted.textContent = "--";

    // Open Modal & Spawn Coins
    paymentModal.classList.add("active");
    spawnCoins();

    if (eveEnabled) {
      arenaEve.classList.add("active");
    }

    try {
      // Step 1: Laser Handshake Delay
      await new Promise((r) => setTimeout(r, 600));
      modalStatusText.textContent = "Polarizing Single Photons & Checking QBER...";

      // Step 2: Call Backend API
      const response = await fetch("/api/send-upi-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payer_name: "Spandana Rao",
          payer_upi: "spandana@okquantum",
          payee_name: inputPayeeName.value,
          payee_upi: inputPayeeUpi.value,
          amount: amountVal,
          currency: "₹",
          note: inputNote.value,
          level: currentLevel,
          num_bits: 512,
          eve_enabled: eveEnabled,
          eve_rate: eveEnabled ? 1.0 : 0.0,
        }),
      });

      const data = await response.json();
      await new Promise((r) => setTimeout(r, 700));

      handlePaymentResponse(data, amountVal);
    } catch (err) {
      console.error("Payment API Error:", err);
      modalStatusText.textContent = "Connection Failure: Payment Server Offline";
    } finally {
      isProcessing = false;
    }
  });

  function handlePaymentResponse(data, amountVal) {
    const qkd = data.qkd;
    const isSuccess = data.settlement.status === "SUCCESS";
    const qberPct = (qkd.qber * 100).toFixed(2) + "%";

    modalQubits.textContent = qkd.raw_bit_count;
    modalSifted.textContent = `${qkd.sifted_count} bits`;
    modalQber.textContent = qberPct;

    modalSpinner.style.display = "none";

    if (isSuccess) {
      // Clean Run Success
      currentBalance -= amountVal;
      userBalance.textContent = `₹${currentBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

      modalStatusText.textContent = "✔ Key Accepted • AES-256-GCM Encrypted & Settled";
      outcomeStamp.className = "outcome-stamp stamp-success";
      outcomeIcon.textContent = "✔";
      outcomeTitle.textContent = "PAYMENT SUCCESSFUL";
      outcomeAmount.textContent = `₹${amountVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
      outcomeDesc.textContent = `Transferred to ${data.transaction.payee_name} (${data.transaction.payee_upi})`;

      receiptTxnId.textContent = data.transaction.txn_id;
      receiptGmac.textContent = data.settlement.encrypted_payload.tag;

      addLedgerEntry({
        txn_id: data.transaction.txn_id,
        payee: data.transaction.payee_name,
        amount: amountVal,
        status: "SETTLED",
        qber: qberPct,
      });
    } else {
      // Eavesdropping Detected & Blocked
      freezeCoinsWithAlarm();

      modalStatusText.textContent = "🚨 SECURITY ALERT: QUANTUM INTERCEPTION DETECTED!";
      outcomeStamp.className = "outcome-stamp stamp-failure";
      outcomeIcon.textContent = "🚨";
      outcomeTitle.textContent = "PAYMENT BLOCKED — EVE DETECTED";
      outcomeAmount.textContent = `₹${amountVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
      outcomeDesc.textContent = `QBER (${qberPct}) exceeded 11.00% safety threshold. Zero funds deducted to prevent Harvest-Now-Decrypt-Later attack.`;

      receiptTxnId.textContent = data.transaction.txn_id;
      receiptGmac.textContent = "[SUPPRESSED - ZERO DATA EXPOSED]";

      addLedgerEntry({
        txn_id: data.transaction.txn_id,
        payee: data.transaction.payee_name,
        amount: amountVal,
        status: "BLOCKED",
        qber: qberPct,
      });
    }

    modalOutcome.style.display = "flex";
  }

  function addLedgerEntry(entry) {
    transactionHistory.unshift(entry);
    ledgerCount.textContent = `${transactionHistory.length} recorded`;

    ledgerList.innerHTML = "";
    transactionHistory.forEach((t) => {
      const row = document.createElement("div");
      row.className = "ledger-item";
      const isSettled = t.status === "SETTLED";
      const chipClass = isSettled ? "badge-settled-chip" : "badge-blocked-chip";
      row.innerHTML = `
        <div>
          <div class="ledger-item-title">${t.payee} (₹${t.amount.toLocaleString("en-IN")})</div>
          <div class="ledger-item-sub font-mono">${t.txn_id} • QBER: ${t.qber}</div>
        </div>
        <span class="${chipClass}">${t.status}</span>
      `;
      ledgerList.appendChild(row);
    });
  }

  // Modal Close Actions
  modalCloseBtn.addEventListener("click", () => {
    paymentModal.classList.remove("active");
  });

  btnModalDone.addEventListener("click", () => {
    paymentModal.classList.remove("active");
  });
});
