/**
 * FinTech QKD Interactive Dashboard Frontend Logic
 */

document.addEventListener("DOMContentLoaded", () => {
  // State
  let currentLevel = 1;
  let rawQubits = 512;
  let eveEnabled = false;
  let eveRate = 1.0;
  let isSimulating = false;

  // DOM Elements
  const btnLevel1 = document.getElementById("btn-level-1");
  const btnLevel2 = document.getElementById("btn-level-2");
  const qubitsSlider = document.getElementById("qubits-slider");
  const qubitsVal = document.getElementById("qubits-val");
  const eveToggle = document.getElementById("eve-toggle");
  const eveSliderWrap = document.getElementById("eve-slider-wrap");
  const eveRateSlider = document.getElementById("eve-rate-slider");
  const eveRateVal = document.getElementById("eve-rate-val");
  const eveNode = document.getElementById("eve-node");
  const eveNodeLabel = document.getElementById("eve-node-label");
  const photonBeam = document.getElementById("photon-beam");

  const btnRunSim = document.getElementById("btn-run-sim");
  const btnQuickClean = document.getElementById("btn-quick-clean");
  const btnQuickAttack = document.getElementById("btn-quick-attack");

  // Metrics
  const metricRaw = document.getElementById("metric-raw");
  const metricSifted = document.getElementById("metric-sifted");
  const metricSample = document.getElementById("metric-sample");
  const metricErrors = document.getElementById("metric-errors");
  const metricQber = document.getElementById("metric-qber");

  // Banner & Grid
  const securityBanner = document.getElementById("security-banner");
  const bannerIcon = document.getElementById("banner-icon");
  const bannerTitle = document.getElementById("banner-title");
  const bannerDesc = document.getElementById("banner-desc");
  const photonGrid = document.getElementById("photon-grid");

  // Transaction & Settlement
  const txnId = document.getElementById("txn-id");
  const txnFrom = document.getElementById("txn-from");
  const txnTo = document.getElementById("txn-to");
  const txnAmount = document.getElementById("txn-amount");
  const txnCategory = document.getElementById("txn-category");
  const txnRouting = document.getElementById("txn-routing");

  const cipherStatusBadge = document.getElementById("cipher-status-badge");
  const cipherKey = document.getElementById("cipher-key");
  const cipherNonce = document.getElementById("cipher-nonce");
  const cipherCiphertext = document.getElementById("cipher-ciphertext");
  const cipherTag = document.getElementById("cipher-tag");

  const settlementStamp = document.getElementById("settlement-stamp");
  const stampTitle = document.getElementById("stamp-title");
  const stampSub = document.getElementById("stamp-sub");

  // Level Switcher
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

  // Qubits Slider
  qubitsSlider.addEventListener("input", (e) => {
    rawQubits = parseInt(e.target.value);
    qubitsVal.textContent = `${rawQubits} qubits`;
  });

  // Eve Controls
  eveToggle.addEventListener("change", (e) => {
    eveEnabled = e.target.checked;
    updateEveVisualState();
  });

  eveRateSlider.addEventListener("input", (e) => {
    eveRate = parseInt(e.target.value) / 100.0;
    eveRateVal.textContent = `${e.target.value}% Interception Rate`;
  });

  function updateEveVisualState() {
    if (eveEnabled) {
      eveSliderWrap.style.display = "flex";
      eveNode.classList.add("active");
      eveNodeLabel.textContent = `Eve: Intercepting (${Math.round(eveRate * 100)}%)`;
    } else {
      eveSliderWrap.style.display = "none";
      eveNode.classList.remove("active");
      eveNodeLabel.textContent = "Eve: Inactive";
    }
  }

  // Quick Presets
  btnQuickClean.addEventListener("click", () => {
    eveEnabled = false;
    eveToggle.checked = false;
    updateEveVisualState();
    triggerSimulation();
  });

  btnQuickAttack.addEventListener("click", () => {
    eveEnabled = true;
    eveToggle.checked = true;
    eveRateSlider.value = 100;
    eveRate = 1.0;
    eveRateVal.textContent = "100% (Full Interception)";
    updateEveVisualState();
    triggerSimulation();
  });

  btnRunSim.addEventListener("click", () => {
    triggerSimulation();
  });

  // Spawning Flying Photons Animation
  function startPhotonStream() {
    photonBeam.innerHTML = "";
    const symbols = ["↑", "→", "↗", "↘", "|0⟩", "|1⟩", "|+⟩", "|-⟩"];
    for (let i = 0; i < 8; i++) {
      const photon = document.createElement("div");
      photon.className = "floating-photon";
      photon.style.animationDelay = `${i * 0.25}s`;
      photon.textContent = symbols[i % symbols.length];
      if (eveEnabled && i % 2 === 0) {
        photon.style.background = "#ef4444";
        photon.style.boxShadow = "0 0 12px #ef4444";
      }
      photonBeam.appendChild(photon);
    }
  }

  // API Call & Simulation Engine
  async function triggerSimulation() {
    if (isSimulating) return;
    isSimulating = true;
    btnRunSim.disabled = true;
    btnRunSim.innerHTML = `<span class="btn-icon">⏳</span> Simulating...`;

    startPhotonStream();

    try {
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: currentLevel,
          num_bits: rawQubits,
          eve_enabled: eveEnabled,
          eve_rate: eveRate,
        }),
      });

      const data = await response.json();
      renderSimulationResults(data);
    } catch (err) {
      console.error("Simulation error:", err);
      alert("Failed to communicate with QKD backend server.");
    } finally {
      isSimulating = false;
      btnRunSim.disabled = false;
      btnRunSim.innerHTML = `<span class="btn-icon">🚀</span> Run Simulation`;
    }
  }

  function renderSimulationResults(data) {
    // 1. Update Metrics
    metricRaw.textContent = data.num_bits;
    metricSifted.textContent = `${data.sifted_length} bits`;
    metricSample.textContent = `${data.sample_length} bits`;
    metricErrors.textContent = `${data.sample_errors} errors`;

    const qberPercent = (data.qber * 100).toFixed(2) + "%";
    metricQber.textContent = qberPercent;

    // 2. QBER Styling
    if (data.is_aborted) {
      metricQber.style.color = "var(--neon-red)";
      securityBanner.className = "security-banner banner-attacked";
      bannerIcon.textContent = "🚨";
      bannerTitle.textContent = "KEY REJECTED — EAVESDROPPING DETECTED";
      bannerDesc.textContent = `QBER of ${qberPercent} breached the 11.00% safety threshold. Quantum channel state disturbed by Eve.`;
    } else {
      metricQber.style.color = "var(--neon-green)";
      securityBanner.className = "security-banner banner-secure";
      bannerIcon.textContent = "🛡️";
      bannerTitle.textContent = "KEY ACCEPTED — 100% QUANTUM SECURE";
      bannerDesc.textContent = `QBER is ${qberPercent} (≤ 11.00% threshold). 256-bit AES key derived via SHA-256 privacy amplification.`;
    }

    // 3. Render Photon Grid
    photonGrid.innerHTML = "";
    data.visual_photons.forEach((p) => {
      const cell = document.createElement("div");
      cell.className = "photon-cell";
      if (p.is_sample && !p.bits_match) {
        cell.classList.add("cell-error");
      } else if (p.is_sifted) {
        cell.classList.add("cell-matched");
      }

      const matchIcon = p.bases_match ? (p.bits_match ? "✔" : "✖") : "·";
      cell.innerHTML = `
        <span class="cell-index">#${p.index}</span>
        <div class="cell-states">A:${p.alice_bit}${p.alice_basis}</div>
        <div class="cell-states">B:${p.bob_bit}${p.bob_basis}</div>
        <span style="font-size:0.65rem; color:${p.bits_match ? '#38bdf8' : '#ef4444'}">${matchIcon}</span>
      `;
      photonGrid.appendChild(cell);
    });

    // 4. Financial Transaction
    const txn = data.transaction;
    txnId.textContent = txn.txn_id;
    txnFrom.textContent = txn.from_acct;
    txnTo.textContent = txn.to_acct;
    txnAmount.textContent = `${txn.currency} ${Number(txn.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    txnCategory.textContent = txn.merchant_category;
    txnRouting.textContent = txn.routing_code;

    // 5. Ciphertext & Settlement Decision
    const settlement = data.settlement;
    if (settlement.status === "SETTLED") {
      const enc = settlement.encrypted_payload;
      cipherStatusBadge.textContent = "AES-256-GCM Verified";
      cipherStatusBadge.style.color = "var(--neon-green)";
      cipherStatusBadge.style.background = "rgba(16, 185, 129, 0.15)";
      
      cipherKey.textContent = data.final_aes_key_hex ? `${data.final_aes_key_hex.substring(0, 32)}...` : "--";
      cipherNonce.textContent = enc.nonce;
      cipherCiphertext.textContent = `${enc.ciphertext.substring(0, 36)}...`;
      cipherTag.textContent = enc.tag;

      settlementStamp.className = "settlement-decision stamp-settled";
      stampTitle.textContent = "★ TRANSACTION SETTLED ★";
      stampSub.textContent = "100% GMAC Integrity Tag Verified • Fedwire Cleared";
    } else {
      cipherStatusBadge.textContent = "BLOCKED";
      cipherStatusBadge.style.color = "var(--neon-red)";
      cipherStatusBadge.style.background = "rgba(239, 68, 68, 0.15)";

      cipherKey.textContent = "[ABORTED - ZERO KEY DISCLOSED]";
      cipherNonce.textContent = "--";
      cipherCiphertext.textContent = "--";
      cipherTag.textContent = "--";

      settlementStamp.className = "settlement-decision stamp-blocked";
      stampTitle.textContent = "✖ TRANSACTION BLOCKED ✖";
      stampSub.textContent = "Eavesdropping Detected • Zero Payload Transmitted";
    }
  }

  // Initial trigger
  triggerSimulation();
});
