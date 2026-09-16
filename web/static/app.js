/**
 * FinTech QKD Interactive Studio Frontend Controller
 */

document.addEventListener("DOMContentLoaded", () => {
  // Global Simulation State
  let currentLevel = 1;
  let eveRate = 0.0;
  let currentStep = 1;
  let isAutoPlaying = false;
  let autoPlayTimer = null;
  let cachedSimData = null;

  // Single-Photon Lab State
  let labAliceBit = 0;
  let labAliceBasis = "+";
  let labEveIntercept = false;
  let labEveBasis = "+";
  let labBobBasis = "+";

  // --- Tab Navigation ---
  const navTabs = document.querySelectorAll(".nav-tab");
  const tabContents = document.querySelectorAll(".tab-content");

  navTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetId = tab.dataset.tab;
      navTabs.forEach((t) => t.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));

      tab.classList.add("active");
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add("active");
    });
  });

  // --- Global Controls ---
  const btnEngine1 = document.getElementById("btn-engine-1");
  const btnEngine2 = document.getElementById("btn-engine-2");
  const sliderEveRate = document.getElementById("slider-eve-rate");
  const eveRateText = document.getElementById("eve-rate-text");
  const presetClean = document.getElementById("preset-clean");
  const presetAttack = document.getElementById("preset-attack");
  const eveTrap = document.getElementById("eve-trap");
  const eveTrapTag = document.getElementById("eve-trap-tag");

  const btnAutoPlay = document.getElementById("btn-auto-play");
  const btnNextStep = document.getElementById("btn-next-step");
  const btnReset = document.getElementById("btn-reset");

  const globalStatusPill = document.getElementById("global-status-pill");
  const globalStatusText = document.getElementById("global-status-text");

  // Stepper Elements
  const stepNodes = document.querySelectorAll(".step-node");
  const stepBadgeIndicator = document.getElementById("step-badge-indicator");
  const stepCardTitle = document.getElementById("step-card-title");
  const stepCardDesc = document.getElementById("step-card-desc");
  const liveStepPreview = document.getElementById("live-step-preview");

  // Metrics
  const metricRawQubits = document.getElementById("metric-raw-qubits");
  const metricSiftedBits = document.getElementById("metric-sifted-bits");
  const metricSampleBits = document.getElementById("metric-sample-bits");
  const metricSampleErrors = document.getElementById("metric-sample-errors");
  const metricQberVal = document.getElementById("metric-qber-val");
  const qberProgressBar = document.getElementById("qber-progress-bar");
  const keyStreamHex = document.getElementById("key-stream-hex");
  const authTagPill = document.getElementById("auth-tag-pill");

  // Fiber & Telemetry
  const photonCanvas = document.getElementById("photon-canvas");
  const aliceLiveState = document.getElementById("alice-live-state");
  const bobLiveState = document.getElementById("bob-live-state");
  const telemetryHeaderToggle = document.getElementById("telemetry-header-toggle");
  const telemetryBody = document.getElementById("telemetry-body");
  const photonStreamGrid = document.getElementById("photon-stream-grid");

  // Engine Selectors
  btnEngine1.addEventListener("click", () => {
    currentLevel = 1;
    btnEngine1.classList.add("active");
    btnEngine2.classList.remove("active");
    fetchSimulationData();
  });

  btnEngine2.addEventListener("click", () => {
    currentLevel = 2;
    btnEngine2.classList.add("active");
    btnEngine1.classList.remove("active");
    fetchSimulationData();
  });

  // Eve Rate Controls
  sliderEveRate.addEventListener("input", (e) => {
    const val = parseInt(e.target.value);
    eveRate = val / 100.0;
    updateEveRateDisplay(val);
    fetchSimulationData();
  });

  presetClean.addEventListener("click", () => {
    sliderEveRate.value = 0;
    eveRate = 0.0;
    updateEveRateDisplay(0);
    presetClean.classList.add("active");
    presetAttack.classList.remove("active");
    fetchSimulationData();
  });

  presetAttack.addEventListener("click", () => {
    sliderEveRate.value = 100;
    eveRate = 1.0;
    updateEveRateDisplay(100);
    presetAttack.classList.add("active");
    presetClean.classList.remove("active");
    fetchSimulationData();
  });

  function updateEveRateDisplay(val) {
    if (val === 0) {
      eveRateText.textContent = "0% (Clean Channel)";
      eveTrap.classList.remove("active");
      eveTrapTag.textContent = "Eve: Passive (0%)";
    } else {
      eveRateText.textContent = `${val}% Interception`;
      eveTrap.classList.add("active");
      eveTrapTag.textContent = `Eve: Intercepting (${val}%)`;
    }
    updateChartMarker(eveRate);
  }

  // Telemetry Accordion
  telemetryHeaderToggle.addEventListener("click", () => {
    const isHidden = telemetryBody.style.display === "none";
    telemetryBody.style.display = isHidden ? "block" : "none";
  });

  // Stepper Controller
  const STEP_DETAILS = {
    1: {
      title: "Stage 1: State Preparation (Alice)",
      desc: "Alice emits single photons, randomly choosing a binary bit (0 or 1) and a conjugate polarization basis (+ or ×).",
      render: (data) => {
        aliceLiveState.textContent = "Emitting 512 states";
        bobLiveState.textContent = "Listening";
        liveStepPreview.textContent = `Alice prepared ${data.num_bits} quantum states across + and × bases.`;
      },
    },
    2: {
      title: "Stage 2: Quantum Transmission & Eavesdropping",
      desc: "Photons propagate across optical fiber. If Eve is active, she intercepts, measures in a random basis (collapsing quantum superpositions), and resends.",
      render: (data) => {
        spawnPhotons(eveRate > 0);
        if (eveRate > 0) {
          liveStepPreview.textContent = `⚠️ Eve intercepted ${(eveRate * 100).toFixed(0)}% of photons, disturbing wavefunctions.`;
        } else {
          liveStepPreview.textContent = `✔ Undisturbed transmission across honest quantum channel.`;
        }
      },
    },
    3: {
      title: "Stage 3: Bob's Measurement",
      desc: "Bob measures incoming photons using his own randomly selected bases (+ or ×), recording raw classical bits according to the Born rule.",
      render: (data) => {
        bobLiveState.textContent = "Measurement complete";
        liveStepPreview.textContent = `Bob measured all ${data.num_bits} incoming single-photon states.`;
      },
    },
    4: {
      title: "Stage 4: Authenticated Basis Sifting",
      desc: "Alice and Bob announce their chosen bases over the HMAC-SHA256 authenticated classical channel. Mismatched bases are discarded (~50% retention).",
      render: (data) => {
        metricSiftedBits.textContent = `${data.sifted_length} bits`;
        authTagPill.textContent = `HMAC: ${data.hmac_auth_tag.substring(0, 16)}... (Valid)`;
        liveStepPreview.textContent = `Sifting complete: ${data.sifted_length} bits retained where bases matched.`;
      },
    },
    5: {
      title: "Stage 5: Public Sampling & QBER Calculation",
      desc: "A random subset of sifted bits is sacrificed publicly to calculate QBER. If QBER exceeds 11.00%, eavesdropping is detected and the protocol aborts.",
      render: (data) => {
        metricSampleBits.textContent = `${data.sample_length} bits`;
        metricSampleErrors.textContent = `${data.sample_errors} error mismatches`;
        const qberPct = (data.qber * 100).toFixed(2);
        metricQberVal.textContent = `${qberPct}%`;
        qberProgressBar.style.width = `${Math.min(100, (data.qber / 0.25) * 100)}%`;

        if (data.is_aborted) {
          metricQberVal.style.color = "var(--accent-red)";
          qberProgressBar.style.backgroundColor = "var(--accent-red)";
          globalStatusText.textContent = "Attack Detected (QBER > 11%)";
          globalStatusPill.style.borderColor = "var(--accent-red)";
          liveStepPreview.textContent = `🚨 PROTOCOL ABORTED: QBER of ${qberPct}% exceeds 11.00% safety threshold!`;
        } else {
          metricQberVal.style.color = "var(--accent-green)";
          qberProgressBar.style.backgroundColor = "var(--accent-green)";
          globalStatusText.textContent = "Quantum Secure (0% QBER)";
          globalStatusPill.style.borderColor = "var(--accent-green)";
          liveStepPreview.textContent = `✔ SECURE: QBER is ${qberPct}%. Negligible eavesdropper mutual information.`;
        }
      },
    },
    6: {
      title: "Stage 6: Privacy Amplification & Financial Settlement",
      desc: "Remaining secret bits are hashed using SHA-256 into a 256-bit AES key. High-value financial wire is encrypted with AES-256-GCM and settled.",
      render: (data) => {
        if (!data.is_aborted && data.final_aes_key_hex) {
          keyStreamHex.textContent = data.final_aes_key_hex;
          keyStreamHex.style.color = "var(--accent-cyan)";
          liveStepPreview.textContent = `★ 256-bit AES Key Derived. Synthetic SWIFT transfer cleared with 100% GMAC integrity!`;
        } else {
          keyStreamHex.textContent = "[ABORTED - ZERO KEY EXPOSED TO PREVENT DATA HARVESTING]";
          keyStreamHex.style.color = "var(--accent-red)";
          liveStepPreview.textContent = `✖ TRANSACTION BLOCKED: No cryptographic key was generated.`;
        }
        updateFinanceTerminal(data);
      },
    },
  };

  function setStep(stepNum) {
    currentStep = Math.max(1, Math.min(6, stepNum));
    stepNodes.forEach((node) => {
      const s = parseInt(node.dataset.step);
      if (s <= currentStep) node.classList.add("active");
      else node.classList.remove("active");
    });

    const info = STEP_DETAILS[currentStep];
    stepBadgeIndicator.textContent = `Step ${currentStep} of 6`;
    stepCardTitle.textContent = info.title;
    stepCardDesc.textContent = info.desc;

    if (cachedSimData) {
      info.render(cachedSimData);
    }
  }

  btnNextStep.addEventListener("click", () => {
    if (currentStep < 6) {
      setStep(currentStep + 1);
    } else {
      setStep(1);
    }
  });

  btnReset.addEventListener("click", () => {
    stopAutoPlay();
    setStep(1);
    fetchSimulationData();
  });

  btnAutoPlay.addEventListener("click", () => {
    if (isAutoPlaying) {
      stopAutoPlay();
    } else {
      startAutoPlay();
    }
  });

  function startAutoPlay() {
    isAutoPlaying = true;
    btnAutoPlay.innerHTML = `<span class="icon">⏸</span> <span>Pause</span>`;
    if (currentStep >= 6) setStep(1);

    autoPlayTimer = setInterval(() => {
      if (currentStep < 6) {
        setStep(currentStep + 1);
      } else {
        stopAutoPlay();
      }
    }, 1200);
  }

  function stopAutoPlay() {
    isAutoPlaying = false;
    clearInterval(autoPlayTimer);
    btnAutoPlay.innerHTML = `<span class="icon">▶</span> <span>Auto Play</span>`;
  }

  // Photon Stream Animation
  function spawnPhotons(isAttacked) {
    photonCanvas.innerHTML = "";
    const symbols = ["↑", "→", "↗", "↘", "|0⟩", "|1⟩", "|+⟩", "|-⟩"];
    for (let i = 0; i < 6; i++) {
      const p = document.createElement("div");
      p.className = "animated-photon";
      p.style.animationDelay = `${i * 0.25}s`;
      p.textContent = symbols[i % symbols.length];
      if (isAttacked && i % 2 === 0) {
        p.style.background = "var(--accent-red)";
        p.style.boxShadow = "0 0 10px var(--accent-red)";
      }
      photonCanvas.appendChild(p);
    }
  }

  // Fetch Simulation from Backend
  async function fetchSimulationData() {
    try {
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: currentLevel,
          num_bits: 512,
          eve_enabled: eveRate > 0,
          eve_rate: eveRate,
        }),
      });

      cachedSimData = await response.json();
      renderTelemetryGrid(cachedSimData.visual_photons);
      setStep(currentStep);
    } catch (err) {
      console.error("Simulation API Error:", err);
    }
  }

  function renderTelemetryGrid(photons) {
    photonStreamGrid.innerHTML = "";
    photons.forEach((p) => {
      const cell = document.createElement("div");
      cell.className = "p-cell";
      if (p.is_sample && !p.bits_match) {
        cell.classList.add("p-error");
      } else if (p.is_sifted) {
        cell.classList.add("p-matched");
      }
      cell.textContent = `${p.alice_bit}${p.alice_basis}➔${p.bob_bit}${p.bob_basis}`;
      photonStreamGrid.appendChild(cell);
    });
  }

  // Update Financial Terminal Tab
  function updateFinanceTerminal(data) {
    const txn = data.transaction;
    document.getElementById("form-txn-id").value = txn.txn_id;
    document.getElementById("form-txn-routing").value = txn.routing_code;
    document.getElementById("form-txn-from").value = txn.from_acct;
    document.getElementById("form-txn-to").value = txn.to_acct;
    document.getElementById("form-txn-amount").value = `${txn.currency} ${Number(txn.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    document.getElementById("form-txn-category").value = txn.merchant_category;
    document.getElementById("form-txn-json").textContent = JSON.stringify(txn, null, 2);

    const stamp = document.getElementById("terminal-settlement-stamp");
    const icon = document.getElementById("terminal-stamp-icon");
    const heading = document.getElementById("terminal-stamp-heading");
    const subtext = document.getElementById("terminal-stamp-subtext");
    const wirePill = document.getElementById("wire-security-pill");

    const nonceVal = document.getElementById("env-nonce-val");
    const tagVal = document.getElementById("env-tag-val");
    const cipherVal = document.getElementById("env-cipher-val");

    if (data.settlement.status === "SETTLED") {
      const enc = data.settlement.encrypted_payload;
      nonceVal.textContent = enc.nonce;
      tagVal.textContent = enc.tag;
      cipherVal.textContent = enc.ciphertext;

      stamp.className = "settlement-stamp stamp-settled";
      icon.textContent = "🛡️";
      heading.textContent = "★ WIRE TRANSACTION SETTLED ★";
      subtext.textContent = "Encrypted via post-quantum AES-256-GCM. 100% GMAC verification passed.";
      wirePill.textContent = "AES-256-GCM Verified";
      wirePill.style.color = "var(--accent-green)";
    } else {
      nonceVal.textContent = "--";
      tagVal.textContent = "--";
      cipherVal.textContent = "[SUPPRESSED - ZERO DATA EXPOSED TO QUANTUM INTERCEPTOR]";

      stamp.className = "settlement-stamp stamp-blocked";
      icon.textContent = "🚨";
      heading.textContent = "✖ WIRE TRANSACTION BLOCKED ✖";
      subtext.textContent = `Eavesdropping detected on quantum channel (QBER ${(data.qber * 100).toFixed(2)}%).`;
      wirePill.textContent = "BLOCKED (No Key)";
      wirePill.style.color = "var(--accent-red)";
    }
  }

  // Generate New Transaction
  document.getElementById("btn-generate-new-txn").addEventListener("click", async () => {
    try {
      const res = await fetch("/api/new-transaction", { method: "POST" });
      const d = await res.json();
      if (cachedSimData) {
        cachedSimData.transaction = d.transaction;
        updateFinanceTerminal(cachedSimData);
      }
    } catch (e) {
      console.error(e);
    }
  });

  // --- TAB 2: Single-Photon Lab Logic ---
  const labBit0 = document.getElementById("lab-bit-0");
  const labBit1 = document.getElementById("lab-bit-1");
  const labBasisRect = document.getElementById("lab-basis-rect");
  const labBasisDiag = document.getElementById("lab-basis-diag");
  const labAliceStateBadge = document.getElementById("lab-alice-state-badge");

  const labEveNo = document.getElementById("lab-eve-no");
  const labEveYes = document.getElementById("lab-eve-yes");
  const labEveBasisGroup = document.getElementById("lab-eve-basis-group");
  const labEveBasisRect = document.getElementById("lab-eve-basis-rect");
  const labEveBasisDiag = document.getElementById("lab-eve-basis-diag");
  const labEveStateBadge = document.getElementById("lab-eve-state-badge");

  const labBobBasisRect = document.getElementById("lab-bob-basis-rect");
  const labBobBasisDiag = document.getElementById("lab-bob-basis-diag");
  const labBobStateBadge = document.getElementById("lab-bob-state-badge");
  const btnFireLabPhoton = document.getElementById("btn-fire-lab-photon");

  const labOutcomeTitle = document.getElementById("lab-outcome-title");
  const labOutcomeDesc = document.getElementById("lab-outcome-desc");

  // Alice Lab Controls
  labBit0.addEventListener("click", () => { labAliceBit = 0; labBit0.classList.add("active"); labBit1.classList.remove("active"); updateLabAliceDisplay(); });
  labBit1.addEventListener("click", () => { labAliceBit = 1; labBit1.classList.add("active"); labBit0.classList.remove("active"); updateLabAliceDisplay(); });
  labBasisRect.addEventListener("click", () => { labAliceBasis = "+"; labBasisRect.classList.add("active"); labBasisDiag.classList.remove("active"); updateLabAliceDisplay(); });
  labBasisDiag.addEventListener("click", () => { labAliceBasis = "x"; labBasisDiag.classList.add("active"); labBasisRect.classList.remove("active"); updateLabAliceDisplay(); });

  function updateLabAliceDisplay() {
    let stateName = "";
    if (labAliceBasis === "+") {
      stateName = labAliceBit === 0 ? "|0⟩ (Horizontal 0°)" : "|1⟩ (Vertical 90°)";
    } else {
      stateName = labAliceBit === 0 ? "|+⟩ (Diagonal +45°)" : "|-⟩ (Diagonal -45°)";
    }
    labAliceStateBadge.textContent = `Prepared: ${stateName}`;
  }

  // Eve Lab Controls
  labEveNo.addEventListener("click", () => {
    labEveIntercept = false;
    labEveNo.classList.add("active");
    labEveYes.classList.remove("active");
    labEveBasisGroup.style.opacity = "0.4";
    labEveStateBadge.textContent = "Eve: Bypassed";
  });
  labEveYes.addEventListener("click", () => {
    labEveIntercept = true;
    labEveYes.classList.add("active");
    labEveNo.classList.remove("active");
    labEveBasisGroup.style.opacity = "1";
    labEveStateBadge.textContent = `Eve: Intercepting in '${labEveBasis}' Basis`;
  });
  labEveBasisRect.addEventListener("click", () => { labEveBasis = "+"; labEveBasisRect.classList.add("active"); labEveBasisDiag.classList.remove("active"); labEveStateBadge.textContent = "Eve: Intercepting in '+' Basis"; });
  labEveBasisDiag.addEventListener("click", () => { labEveBasis = "x"; labEveBasisDiag.classList.add("active"); labEveBasisRect.classList.remove("active"); labEveStateBadge.textContent = "Eve: Intercepting in 'x' Basis"; });

  // Bob Lab Controls
  labBobBasisRect.addEventListener("click", () => { labBobBasis = "+"; labBobBasisRect.classList.add("active"); labBobBasisDiag.classList.remove("active"); });
  labBobBasisDiag.addEventListener("click", () => { labBobBasis = "x"; labBobBasisDiag.classList.add("active"); labBobBasisRect.classList.remove("active"); });

  // Fire Photon in Lab
  btnFireLabPhoton.addEventListener("click", () => {
    let currentBit = labAliceBit;
    let currentBasis = labAliceBasis;
    let eveMeasuredBit = null;
    let eveDisturbed = false;

    // 1. Eve Interception
    if (labEveIntercept) {
      if (labEveBasis === currentBasis) {
        eveMeasuredBit = currentBit;
      } else {
        eveMeasuredBit = Math.random() < 0.5 ? 0 : 1;
        eveDisturbed = true;
        currentBasis = labEveBasis;
        currentBit = eveMeasuredBit;
      }
    }

    // 2. Bob Measurement
    let bobMeasuredBit = null;
    if (labBobBasis === currentBasis) {
      bobMeasuredBit = currentBit;
    } else {
      bobMeasuredBit = Math.random() < 0.5 ? 0 : 1;
    }

    labBobStateBadge.textContent = `Bob Measured: Bit ${bobMeasuredBit} (in ${labBobBasis} Basis)`;

    // 3. Analysis & Explanation
    const basesMatch = (labAliceBasis === labBobBasis);
    const bitsMatch = (labAliceBit === bobMeasuredBit);

    if (labEveIntercept && eveDisturbed && basesMatch && !bitsMatch) {
      labOutcomeTitle.textContent = "🚨 Quantum Collapse Error Detected!";
      labOutcomeDesc.textContent = `Alice and Bob chose the SAME basis (${labAliceBasis}), but Bob read Bit ${bobMeasuredBit} instead of Alice's Bit ${labAliceBit}. Why? Because Eve measured in the incompatible '${labEveBasis}' basis, collapsing the quantum superposition and irreversibly altering the polarization!`;
    } else if (labEveIntercept && eveDisturbed) {
      labOutcomeTitle.textContent = "⚠️ Quantum Disturbance Injected";
      labOutcomeDesc.textContent = `Eve intercepted in '${labEveBasis}' basis and resent a collapsed state. Even if Bob got ${bobMeasuredBit} this time, statistical tests over multiple qubits will reliably uncover Eve via a 25% QBER spike.`;
    } else if (basesMatch && bitsMatch) {
      labOutcomeTitle.textContent = "✔ Deterministic Match (Sifted Key Bit)";
      labOutcomeDesc.textContent = `Alice and Bob both used '${labAliceBasis}' basis. The photon was an exact eigenstate of Bob's measurement operator, yielding 100% deterministic fidelity (Bit ${bobMeasuredBit}).`;
    } else {
      labOutcomeTitle.textContent = "ℹ Incompatible Basis (Discarded in Sifting)";
      labOutcomeDesc.textContent = `Alice used '${labAliceBasis}' while Bob used '${labBobBasis}'. Measuring in conjugate non-orthogonal bases yields a purely random 50/50 measurement outcome by Heisenberg's uncertainty principle. This bit is discarded during basis sifting.`;
    }
  });

  // --- TAB 4: Interactive QBER Chart Marker ---
  function updateChartMarker(p) {
    const chartMarker = document.getElementById("chart-marker");
    const chartMarkerText = document.getElementById("chart-marker-text");
    if (!chartMarker || !chartMarkerText) return;

    // SVG coordinates: x from 60 (p=0) to 560 (p=1.0)
    const cx = 60 + p * 500;
    // Expected QBER = p * 0.25 -> y from 280 (qber=0) to 80 (qber=0.25)
    const qberExpected = p * 0.25;
    const cy = 280 - (qberExpected / 0.25) * 200;

    chartMarker.setAttribute("cx", cx);
    chartMarker.setAttribute("cy", cy);

    const isAboveLimit = qberExpected > 0.11;
    chartMarker.setAttribute("fill", isAboveLimit ? "#f43f5e" : "#10b981");

    chartMarkerText.setAttribute("x", cx + 12);
    chartMarkerText.setAttribute("y", cy - 4);
    chartMarkerText.setAttribute("fill", isAboveLimit ? "#f43f5e" : "#10b981");
    chartMarkerText.textContent = `Eve ${(p * 100).toFixed(0)}% (QBER ~${(qberExpected * 100).toFixed(1)}%)`;
  }

  // Initial Boot
  fetchSimulationData();
});
