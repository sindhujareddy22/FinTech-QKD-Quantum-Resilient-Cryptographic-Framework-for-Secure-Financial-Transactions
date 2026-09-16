/**
 * FinTech QKD Minimal Dashboard Frontend Logic
 */

document.addEventListener("DOMContentLoaded", () => {
  // State
  let currentLevel = 1;
  let eveEnabled = false;
  let isSimulating = false;

  // DOM Elements
  const btnLevel1 = document.getElementById("btn-level-1");
  const btnLevel2 = document.getElementById("btn-level-2");
  const btnModeClean = document.getElementById("btn-mode-clean");
  const btnModeAttack = document.getElementById("btn-mode-attack");
  const btnRun = document.getElementById("btn-run");

  const navStatusText = document.getElementById("nav-status-text");
  const photonStream = document.getElementById("photon-stream");
  const eveInterceptor = document.getElementById("eve-interceptor");

  // Quantum Metrics
  const statSifted = document.getElementById("stat-sifted");
  const statQber = document.getElementById("stat-qber");
  const cardQber = document.getElementById("card-qber");
  const statStatus = document.getElementById("stat-status");
  const statStatusSub = document.getElementById("stat-status-sub");
  const keyDisplay = document.getElementById("key-display");
  const telemetryCount = document.getElementById("telemetry-count");
  const telemetryGrid = document.getElementById("telemetry-grid");

  // Finance Elements
  const txnCategory = document.getElementById("txn-category");
  const txnId = document.getElementById("txn-id");
  const txnCurrency = document.getElementById("txn-currency");
  const txnAmount = document.getElementById("txn-amount");
  const txnFrom = document.getElementById("txn-from");
  const txnTo = document.getElementById("txn-to");

  const envNonce = document.getElementById("env-nonce");
  const envTag = document.getElementById("env-tag");
  const envCiphertext = document.getElementById("env-ciphertext");

  const settlementBanner = document.getElementById("settlement-banner");
  const settlementIcon = document.getElementById("settlement-icon");
  const settlementTitle = document.getElementById("settlement-title");
  const settlementDesc = document.getElementById("settlement-desc");

  // Engine Level Switcher
  btnLevel1.addEventListener("click", () => {
    currentLevel = 1;
    btnLevel1.classList.add("active");
    btnLevel2.classList.remove("active");
  });

  btnLevel2.addEventListener("click", () => {
    currentLevel = 2;
    btnLevel2.classList.add("active");
    btnLevel1.classList.remove("active");
  });

  // Channel Mode Presets
  btnModeClean.addEventListener("click", () => {
    eveEnabled = false;
    btnModeClean.classList.add("active");
    btnModeAttack.classList.remove("active");
    eveInterceptor.classList.remove("active");
  });

  btnModeAttack.addEventListener("click", () => {
    eveEnabled = true;
    btnModeAttack.classList.add("active");
    btnModeClean.classList.remove("active");
    eveInterceptor.classList.add("active");
  });

  // Run Button
  btnRun.addEventListener("click", () => {
    triggerSimulation();
  });

  // Photon Stream Animation
  function startPhotons() {
    photonStream.innerHTML = "";
    for (let i = 0; i < 5; i++) {
      const dot = document.createElement("div");
      dot.className = "photon-dot";
      dot.style.animationDelay = `${i * 0.28}s`;
      if (eveEnabled) {
        dot.style.background = "#f43f5e";
        dot.style.boxShadow = "0 0 8px #f43f5e";
      }
      photonStream.appendChild(dot);
    }
  }

  // Simulation API Call
  async function triggerSimulation() {
    if (isSimulating) return;
    isSimulating = true;
    btnRun.disabled = true;
    btnRun.innerHTML = `<span class="run-icon">⏳</span> <span>Executing...</span>`;
    navStatusText.textContent = "Simulating QKD...";

    startPhotons();

    try {
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: currentLevel,
          num_bits: 512,
          eve_enabled: eveEnabled,
          eve_rate: eveEnabled ? 1.0 : 0.0,
        }),
      });

      const data = await response.json();
      renderResults(data);
    } catch (err) {
      console.error("Simulation request error:", err);
      navStatusText.textContent = "Connection Error";
    } finally {
      isSimulating = false;
      btnRun.disabled = false;
      btnRun.innerHTML = `<span class="run-icon">▶</span> <span>Execute Simulation</span>`;
    }
  }

  function renderResults(data) {
    // 1. Quantum Stats
    statSifted.textContent = `${data.sifted_length} bits`;
    const qberStr = (data.qber * 100).toFixed(2) + "%";
    statQber.textContent = qberStr;

    if (data.is_aborted) {
      statQber.style.color = "var(--accent-red)";
      statStatus.textContent = "REJECTED";
      statStatus.style.color = "var(--accent-red)";
      statStatusSub.textContent = "Eavesdropping detected";
      navStatusText.textContent = "Attack Detected (QBER > 11%)";
      keyDisplay.textContent = "[ABORTED - ZERO KEY EXPOSED]";
      keyDisplay.style.color = "var(--accent-red)";
    } else {
      statQber.style.color = "var(--accent-green)";
      statStatus.textContent = "ACCEPTED";
      statStatus.style.color = "var(--accent-green)";
      statStatusSub.textContent = "100% quantum secure";
      navStatusText.textContent = "Quantum Secure (0% QBER)";
      keyDisplay.textContent = data.final_aes_key_hex || "--";
      keyDisplay.style.color = "var(--accent-cyan)";
    }

    // 2. Telemetry Accordion
    telemetryCount.textContent = data.visual_photons.length;
    telemetryGrid.innerHTML = "";
    data.visual_photons.forEach((p) => {
      const cell = document.createElement("div");
      cell.className = "t-cell";
      if (p.is_sample && !p.bits_match) {
        cell.classList.add("t-error");
      } else if (p.is_sifted) {
        cell.classList.add("t-matched");
      }
      cell.textContent = `${p.alice_bit}${p.alice_basis}➔${p.bob_bit}${p.bob_basis}`;
      telemetryGrid.appendChild(cell);
    });

    // 3. Financial Transaction
    const txn = data.transaction;
    txnCategory.textContent = txn.merchant_category;
    txnId.textContent = txn.txn_id;
    txnCurrency.textContent = txn.currency;
    txnAmount.textContent = Number(txn.amount).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    txnFrom.textContent = txn.from_acct;
    txnTo.textContent = txn.to_acct;

    // 4. Cryptographic Envelope & Settlement Decision
    const settlement = data.settlement;
    if (settlement.status === "SETTLED") {
      const enc = settlement.encrypted_payload;
      envNonce.textContent = enc.nonce;
      envTag.textContent = enc.tag;
      envCiphertext.textContent = enc.ciphertext;

      settlementBanner.className = "settlement-banner banner-settled";
      settlementIcon.textContent = "🛡️";
      settlementTitle.textContent = "★ TRANSACTION SETTLED ★";
      settlementDesc.textContent = "Encrypted with AES-256-GCM. 100% GMAC integrity tag verified by recipient bank.";
    } else {
      envNonce.textContent = "--";
      envTag.textContent = "--";
      envCiphertext.textContent = "[PAYLOAD SUPPRESSED - PROTOCOL ABORTED]";

      settlementBanner.className = "settlement-banner banner-blocked";
      settlementIcon.textContent = "🚨";
      settlementTitle.textContent = "✖ TRANSACTION BLOCKED ✖";
      settlementDesc.textContent = `QBER of ${qberStr} breached safety threshold (11.00%). Zero financial data was transmitted.`;
    }
  }

  // Initial trigger
  triggerSimulation();
});
