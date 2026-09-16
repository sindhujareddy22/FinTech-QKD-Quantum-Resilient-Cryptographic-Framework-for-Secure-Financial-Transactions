/**
 * QuPay UPI Web Application — Client Controller
 * Professional, clean FinTech UPI payment experience with live channel intercept error detection.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Application State
  let userBalance = 125000.0;
  let isBalanceVisible = true;
  let enteredPin = "";
  let contacts = [];
  let transactionsHistory = [];
  let currentFilter = "ALL";
  let isProcessingPayment = false;
  let eveActive = false;
  let currentPayee = {
    name: "Bob Sharma",
    upi: "bob@okhdfcbank",
    initials: "BS",
    bank: "HDFC Bank",
  };

  // Multi-Bank Balances & PIN Authentication Mode State
  let currentPinMode = "PAYMENT"; // "PAYMENT" | "CHECK_BALANCE"
  let pendingBankCheck = null;
  const bankBalances = {
    hdfc: { name: "HDFC Bank Limited", balance: 125000.0, revealed: false },
    sbi: { name: "State Bank of India", balance: 48500.0, revealed: false },
    icici: { name: "ICICI Bank Limited", balance: 75230.0, revealed: false },
    axis: { name: "Axis Bank Limited", balance: 110400.0, revealed: false },
  };

  // Web Audio Synthesizer for Clean Interaction Sound Effects
  const audioCtx = (typeof window.AudioContext !== "undefined" || typeof window.webkitAudioContext !== "undefined")
    ? new (window.AudioContext || window.webkitAudioContext)()
    : null;

  function playSound(type) {
    if (!audioCtx) return;
    try {
      if (audioCtx.state === "suspended") audioCtx.resume();
      const now = audioCtx.currentTime;

      if (type === "tap") {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(520, now);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.04);
      } else if (type === "success") {
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, now + i * 0.07);
          gain.gain.setValueAtTime(0.14, now + i * 0.07);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.32);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now + i * 0.07);
          osc.stop(now + i * 0.07 + 0.32);
        });
      } else if (type === "error") {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.linearRampToValueAtTime(180, now + 0.25);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch (e) {
      console.warn("Audio playback not supported", e);
    }
  }

  // Toast Notification Helper
  const toastContainer = document.getElementById("toast-container");
  function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(50px)";
      setTimeout(() => toast.remove(), 350);
    }, 4500);
  }

  // Navigation Tab Switching
  const navTabs = document.querySelectorAll(".nav-tab");
  const tabPanes = {
    "transfer-tab": document.getElementById("pane-transfer-tab"),
    "passbook-tab": document.getElementById("pane-passbook-tab"),
    "qr-tab": document.getElementById("pane-qr-tab"),
  };

  function switchTab(tabId) {
    navTabs.forEach((tab) => {
      tab.classList.toggle("active", tab.getAttribute("data-tab") === tabId);
    });
    Object.keys(tabPanes).forEach((key) => {
      if (tabPanes[key]) {
        tabPanes[key].classList.toggle("active", key === tabId);
      }
    });
  }

  navTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const tabId = tab.getAttribute("data-tab");
      switchTab(tabId);
      playSound("tap");
    });
  });

  document.getElementById("link-view-passbook").addEventListener("click", () => {
    switchTab("passbook-tab");
    playSound("tap");
  });

  // Transfer Modes Selector
  const modeCards = document.querySelectorAll(".mode-card");
  modeCards.forEach((card) => {
    card.addEventListener("click", () => {
      modeCards.forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      playSound("tap");
    });
  });

  // Header Elements & Eve Toggle
  const navSystemStatus = document.getElementById("nav-system-status");
  const navStatusDot = document.getElementById("nav-status-dot");
  const navStatusText = document.getElementById("nav-status-text");
  const channelInterceptionToggle = document.getElementById("channel-interception-toggle");
  const eveToggleSwitch = document.getElementById("eve-toggle-switch");
  const eveToggleState = document.getElementById("eve-toggle-state");

  // Balance & Multi-Bank Elements
  const btnOpenMultiBank = document.getElementById("btn-open-multi-bank");
  const cbSubStatus = document.getElementById("cb-sub-status");
  const modalMultiBankBalance = document.getElementById("modal-multi-bank-balance");
  const btnCloseBankBalanceModal = document.getElementById("btn-close-bank-balance-modal");
  const mainBalanceDigits = document.getElementById("main-balance-digits");
  const balanceEyeBtn = document.getElementById("balance-eye-btn");
  const balanceRefreshBtn = document.getElementById("balance-refresh-btn");
  const kpiTotalPaid = document.getElementById("kpi-total-paid");
  const kpiTxnCount = document.getElementById("kpi-txn-count");

  // Form Elements
  const contactsCardsList = document.getElementById("contacts-cards-list");
  const inputPayeeName = document.getElementById("input-payee-name");
  const inputPayeeUpi = document.getElementById("input-payee-upi");
  const inputTransferAmount = document.getElementById("input-transfer-amount");
  const inputTransferNote = document.getElementById("input-transfer-note");
  const btnAmountDisplay = document.getElementById("btn-amount-display");
  const btnProceedToPay = document.getElementById("btn-proceed-to-pay");
  const recentTxnsFeed = document.getElementById("recent-txns-feed");

  // Passbook Elements
  const passbookTableTbody = document.getElementById("passbook-table-tbody");
  const countAll = document.getElementById("count-all");
  const countSettled = document.getElementById("count-settled");
  const countBlocked = document.getElementById("count-blocked");
  const btnRefreshPassbook = document.getElementById("btn-refresh-passbook");

  // PIN Modal Elements
  const modalPinOverlay = document.getElementById("modal-pin-overlay");
  const btnClosePinModal = document.getElementById("btn-close-pin-modal");
  const modalPayeeAvatar = document.getElementById("modal-payee-avatar");
  const modalPayeeName = document.getElementById("modal-payee-name");
  const modalPayeeUpi = document.getElementById("modal-payee-upi");
  const modalPayeeAmount = document.getElementById("modal-payee-amount");
  const pinBubbles = [
    document.getElementById("pin-b-1"),
    document.getElementById("pin-b-2"),
    document.getElementById("pin-b-3"),
    document.getElementById("pin-b-4"),
  ];
  const keyActionClear = document.getElementById("key-action-clear");
  const keyActionPay = document.getElementById("key-action-pay");

  // Receipt Modal Elements
  const modalReceiptOverlay = document.getElementById("modal-receipt-overlay");
  const receiptBannerHeader = document.getElementById("receipt-banner-header");
  const receiptIconContainer = document.getElementById("receipt-icon-container");
  const receiptMainTitle = document.getElementById("receipt-main-title");
  const receiptTimestamp = document.getElementById("receipt-timestamp");
  const receiptAmountTitle = document.getElementById("receipt-amount-title");
  const receiptAmountVal = document.getElementById("receipt-amount-val");
  const receiptPayeeName = document.getElementById("receipt-payee-name");
  const receiptPayeeUpi = document.getElementById("receipt-payee-upi");
  const receiptPayerUpi = document.getElementById("receipt-payer-upi");
  const receiptUtrNo = document.getElementById("receipt-utr-no");
  const receiptNoteVal = document.getElementById("receipt-note-val");
  const receiptErrorDiagnostic = document.getElementById("receipt-error-diagnostic");
  const receiptErrorText = document.getElementById("receipt-error-text");
  const btnCloseReceipt = document.getElementById("btn-close-receipt");

  // QR Code Elements
  const btnCopyUpi = document.getElementById("btn-copy-upi");
  const myUpiIdText = document.getElementById("my-upi-id-text");

  // Eve Channel Interception Switch Handling
  eveToggleSwitch.addEventListener("change", async (e) => {
    const enabled = e.target.checked;
    try {
      const res = await fetch("/api/eve/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: enabled, rate: 1.0 }),
      });
      const data = await res.json();
      updateEveState(data.eve_enabled);
      if (data.eve_enabled) {
        showToast("Error Simulation: Channel interception (Eve) is ACTIVE. The next payment will trigger an error.", "error");
        playSound("error");
      } else {
        showToast("Channel restored to Secure state.", "success");
        playSound("tap");
      }
    } catch (err) {
      console.error("Failed to toggle intercept:", err);
    }
  });

  function updateEveState(isActive) {
    eveActive = isActive;
    eveToggleSwitch.checked = isActive;
    if (isActive) {
      channelInterceptionToggle.classList.add("active");
      eveToggleState.textContent = "ACTIVE";
      navSystemStatus.style.background = "rgba(239, 68, 68, 0.15)";
      navSystemStatus.style.borderColor = "rgba(239, 68, 68, 0.4)";
      navSystemStatus.style.color = "#f87171";
      navStatusDot.style.background = "#ef4444";
      navStatusDot.style.boxShadow = "0 0 10px #ef4444";
      navStatusText.textContent = "Channel Compromised";
    } else {
      channelInterceptionToggle.classList.remove("active");
      eveToggleState.textContent = "OFF";
      navSystemStatus.style.background = "rgba(16, 185, 129, 0.12)";
      navSystemStatus.style.borderColor = "rgba(16, 185, 129, 0.35)";
      navSystemStatus.style.color = "#34d399";
      navStatusDot.style.background = "#10b981";
      navStatusDot.style.boxShadow = "0 0 10px #10b981";
      navStatusText.textContent = "Channel Secure";
    }
  }

  // Multi-Bank Balance Hub Click Listener
  if (btnOpenMultiBank) {
    btnOpenMultiBank.addEventListener("click", () => {
      modalMultiBankBalance.classList.remove("hidden");
      playSound("tap");
    });
  }

  if (btnCloseBankBalanceModal) {
    btnCloseBankBalanceModal.addEventListener("click", () => {
      modalMultiBankBalance.classList.add("hidden");
      playSound("tap");
    });
  }

  if (modalMultiBankBalance) {
    modalMultiBankBalance.addEventListener("click", (e) => {
      if (e.target === modalMultiBankBalance) {
        modalMultiBankBalance.classList.add("hidden");
      }
    });
  }

  // Check Balance for Each Linked Bank
  document.querySelectorAll(".btn-check-single-bal").forEach((btn) => {
    btn.addEventListener("click", () => {
      const bankId = btn.getAttribute("data-bank");
      const bankName = btn.getAttribute("data-bank-name") || "Bank";
      const acc = btn.getAttribute("data-acc") || "••••";
      const initials = btn.getAttribute("data-initials") || "UPI";

      if (bankBalances[bankId] && bankBalances[bankId].revealed) {
        // Toggle re-hide
        bankBalances[bankId].revealed = false;
        const balVal = document.getElementById(`bal-val-${bankId}`);
        if (balVal) {
          balVal.textContent = "₹••••••••";
          balVal.className = "bank-bal-val font-mono masked";
        }
        btn.classList.remove("checked");
        btn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          <span>Check Balance</span>
        `;
        playSound("tap");
      } else {
        // Prompt 4-Digit UPI PIN for authentic quantum-verified check
        currentPinMode = "CHECK_BALANCE";
        pendingBankCheck = { bankId, bankName, acc, initials };

        modalPayeeAvatar.textContent = initials;
        modalPayeeName.textContent = bankName;
        modalPayeeUpi.textContent = `A/C •••••••• ${acc}`;
        modalPayeeAmount.textContent = "VERIFY PIN";
        keyActionPay.textContent = "CHECK";

        enteredPin = "";
        updatePinBubbles();
        modalPinOverlay.classList.remove("hidden");
        playSound("tap");
      }
    });
  });

  function verifyAndRevealBankBalance(bankInfo) {
    const bankId = bankInfo.bankId;
    const bal = (bankId === "hdfc") ? userBalance : (bankBalances[bankId]?.balance || 50000.0);
    if (bankBalances[bankId]) {
      bankBalances[bankId].revealed = true;
    }

    const balValEl = document.getElementById(`bal-val-${bankId}`);
    const btnEl = document.getElementById(`btn-check-bal-${bankId}`);

    if (balValEl) {
      balValEl.textContent = `₹${bal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
      balValEl.className = "bank-bal-val font-mono revealed";
    }

    if (btnEl) {
      btnEl.classList.add("checked");
      btnEl.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
        <span>Hide</span>
      `;
    }

    if (cbSubStatus) {
      cbSubStatus.textContent = `${bankInfo.bankName}: ₹${bal.toLocaleString("en-IN", { minimumFractionDigits: 2 })} (Verified)`;
    }

    playSound("success");
    showToast(`Balance verified for ${bankInfo.bankName}: ₹${bal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, "success");
  }

  // Backward compatibility for balance toggle if elements exist
  if (balanceEyeBtn && mainBalanceDigits) {
    balanceEyeBtn.addEventListener("click", () => {
      isBalanceVisible = !isBalanceVisible;
      if (isBalanceVisible) {
        mainBalanceDigits.textContent = `₹${userBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
      } else {
        mainBalanceDigits.textContent = "₹••••••••";
      }
      playSound("tap");
    });
  }

  if (balanceRefreshBtn) {
    balanceRefreshBtn.addEventListener("click", () => {
      fetchAccountStatus();
      showToast("Account balance refreshed with HDFC Bank.", "info");
      playSound("tap");
    });
  }

  // Amount Input Listener
  inputTransferAmount.addEventListener("input", () => {
    const val = parseFloat(inputTransferAmount.value) || 0;
    btnAmountDisplay.textContent = val.toLocaleString("en-IN", { minimumFractionDigits: 2 });
  });

  // Preset Amount Chips
  document.querySelectorAll(".preset-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const amt = parseInt(chip.getAttribute("data-amt"), 10);
      const current = parseInt(inputTransferAmount.value || 0, 10);
      const total = current + amt;
      inputTransferAmount.value = total;
      btnAmountDisplay.textContent = total.toLocaleString("en-IN", { minimumFractionDigits: 2 });
      playSound("tap");
    });
  });

  // Copy UPI ID
  btnCopyUpi.addEventListener("click", () => {
    navigator.clipboard.writeText(myUpiIdText.textContent.trim());
    showToast("UPI ID copied to clipboard: spandana@okupi", "success");
    playSound("tap");
  });

  // Load Contacts
  async function loadContacts() {
    try {
      const res = await fetch("/api/contacts");
      const data = await res.json();
      contacts = data.contacts || [];

      if (contacts.length > 0) {
        contactsCardsList.innerHTML = "";
        contacts.forEach((contact, idx) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = `contact-pill-btn ${idx === 0 ? "selected" : ""}`;
          btn.innerHTML = `
            <div class="cp-initials-badge">${contact.initials || 'UPI'}</div>
            <div>
              <div class="cp-name">${contact.name}</div>
              <div class="cp-upi font-mono">${contact.upi}</div>
            </div>
          `;
          btn.addEventListener("click", () => {
            document.querySelectorAll(".contact-pill-btn").forEach((b) => b.classList.remove("selected"));
            btn.classList.add("selected");
            currentPayee = contact;
            inputPayeeName.value = contact.name;
            inputPayeeUpi.value = contact.upi;
            playSound("tap");
          });
          contactsCardsList.appendChild(btn);
        });

        // Set default recipient
        currentPayee = contacts[0];
        inputPayeeName.value = contacts[0].name;
        inputPayeeUpi.value = contacts[0].upi;
      }
    } catch (e) {
      console.error("Failed to load contacts:", e);
    }
  }

  // Fetch Account & Transaction Status
  async function fetchAccountStatus() {
    try {
      const res = await fetch("/api/security/status");
      const data = await res.json();
      userBalance = data.user_balance;
      bankBalances.hdfc.balance = userBalance;
      updateEveState(data.eve_enabled);

      if (mainBalanceDigits && isBalanceVisible) {
        mainBalanceDigits.textContent = `₹${userBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
      }

      if (bankBalances.hdfc.revealed) {
        const balValHdfc = document.getElementById("bal-val-hdfc");
        if (balValHdfc) {
          balValHdfc.textContent = `₹${userBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
        }
        if (cbSubStatus) {
          cbSubStatus.textContent = `HDFC Bank: ₹${userBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })} (Verified)`;
        }
      }

      kpiTotalPaid.textContent = `₹${data.total_settled_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
      kpiTxnCount.textContent = data.total_settled_count + data.total_blocked_count;
    } catch (e) {
      console.error("Failed to fetch account status:", e);
    }
  }

  // Open PIN Modal
  btnProceedToPay.addEventListener("click", () => {
    const name = inputPayeeName.value.trim();
    const upi = inputPayeeUpi.value.trim();
    const amount = parseFloat(inputTransferAmount.value) || 0;

    if (!name || !upi) {
      showToast("Please enter beneficiary name and valid UPI ID.", "error");
      playSound("error");
      return;
    }
    if (amount <= 0) {
      showToast("Please enter a valid transfer amount.", "error");
      playSound("error");
      return;
    }
    if (amount > userBalance) {
      showToast("Insufficient settlement balance in account.", "error");
      playSound("error");
      return;
    }

    currentPinMode = "PAYMENT";
    modalPayeeAvatar.textContent = currentPayee.initials || "UPI";
    modalPayeeName.textContent = name;
    modalPayeeUpi.textContent = upi;
    modalPayeeAmount.textContent = `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
    keyActionPay.textContent = "AUTHORIZE";
    enteredPin = "";
    updatePinBubbles();
    modalPinOverlay.classList.remove("hidden");
    playSound("tap");
  });

  btnClosePinModal.addEventListener("click", () => {
    modalPinOverlay.classList.add("hidden");
    playSound("tap");
  });

  // Keypad Logic
  function updatePinBubbles() {
    pinBubbles.forEach((b, idx) => {
      b.classList.toggle("filled", idx < enteredPin.length);
    });
  }

  document.querySelectorAll(".keypad-digit-btn[data-key]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (enteredPin.length < 4) {
        enteredPin += btn.getAttribute("data-key");
        updatePinBubbles();
        playSound("tap");
      }
    });
  });

  keyActionClear.addEventListener("click", () => {
    enteredPin = "";
    updatePinBubbles();
    playSound("tap");
  });

  keyActionPay.addEventListener("click", () => {
    if (enteredPin.length < 4) {
      showToast("Please enter complete 4-digit UPI PIN (e.g. 1234)", "error");
      playSound("error");
      return;
    }
    modalPinOverlay.classList.add("hidden");
    if (currentPinMode === "CHECK_BALANCE" && pendingBankCheck) {
      verifyAndRevealBankBalance(pendingBankCheck);
    } else {
      processUPIPayment();
    }
  });

  // Process UPI Payment
  async function processUPIPayment() {
    if (isProcessingPayment) return;
    isProcessingPayment = true;

    const payeeName = inputPayeeName.value.trim();
    const payeeUpi = inputPayeeUpi.value.trim();
    const amount = parseFloat(inputTransferAmount.value) || 0;
    const note = inputTransferNote.value.trim() || "Corporate Payment Settlement";

    btnProceedToPay.disabled = true;
    btnProceedToPay.style.opacity = "0.7";
    btnProceedToPay.innerHTML = `<span>Processing Settlement...</span>`;

    try {
      const res = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payer_name: "Spandana Rao",
          payer_upi: "spandana@okupi",
          payee_name: payeeName,
          payee_upi: payeeUpi,
          amount: amount,
          currency: "₹",
          note: note,
          sim_level: 1,
        }),
      });

      const data = await res.json();
      const txn = data.transaction;
      const isSettled = txn.status === "SETTLED";

      setTimeout(() => {
        if (!isSettled || data.eve_detected) {
          // PAYMENT FAILED / ERROR DETECTED FLOW
          playSound("error");
          showToast(`Error Detected: Channel interception detected. Payment of ₹${amount.toLocaleString("en-IN")} failed.`, "error");

          // Render Error Mode Receipt
          receiptBannerHeader.className = "receipt-banner-header error-mode";
          receiptIconContainer.className = "receipt-check-circle error-circle";
          receiptIconContainer.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          `;
          receiptMainTitle.textContent = "Payment Failed (Error Detected)";
          receiptTimestamp.textContent = txn.timestamp;
          receiptAmountTitle.textContent = "Amount (Unprocessed)";
          receiptAmountVal.textContent = `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
          receiptAmountVal.className = "amount-number-val font-mono error-val";

          receiptPayeeName.textContent = txn.payee_name;
          receiptPayeeUpi.textContent = txn.payee_upi;
          receiptPayerUpi.textContent = txn.payer_upi;
          receiptUtrNo.textContent = txn.txn_id;
          receiptNoteVal.textContent = txn.note;

          // Reveal error diagnostic card
          receiptErrorDiagnostic.classList.remove("hidden");
          receiptErrorText.textContent = txn.abort_reason || "Error Detected: Unauthorized communication channel interception detected. Payment was blocked to prevent compromise. Zero balance was deducted from your account.";

          modalReceiptOverlay.classList.remove("hidden");
        } else {
          // PAYMENT SUCCESS FLOW
          playSound("success");
          showToast(`Payment of ₹${amount.toLocaleString("en-IN")} settled to ${payeeName}`, "success");

          // Render Success Mode Receipt
          receiptBannerHeader.className = "receipt-banner-header";
          receiptIconContainer.className = "receipt-check-circle";
          receiptIconContainer.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          `;
          receiptMainTitle.textContent = "Payment Successful";
          receiptTimestamp.textContent = txn.timestamp;
          receiptAmountTitle.textContent = "Settled Amount";
          receiptAmountVal.textContent = `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
          receiptAmountVal.className = "amount-number-val font-mono";

          receiptPayeeName.textContent = txn.payee_name;
          receiptPayeeUpi.textContent = txn.payee_upi;
          receiptPayerUpi.textContent = txn.payer_upi;
          receiptUtrNo.textContent = txn.txn_id;
          receiptNoteVal.textContent = txn.note;

          receiptErrorDiagnostic.classList.add("hidden");
          modalReceiptOverlay.classList.remove("hidden");
        }

        fetchAccountStatus();
        fetchHistory();

        isProcessingPayment = false;
        btnProceedToPay.disabled = false;
        btnProceedToPay.style.opacity = "1";
        btnProceedToPay.innerHTML = `<span>Authorize Transfer ₹<span id="btn-amount-display">${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></span> <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>`;
      }, 500);

    } catch (err) {
      console.error("Payment failed:", err);
      showToast("Settlement error. Please try again.", "error");
      playSound("error");
      isProcessingPayment = false;
      btnProceedToPay.disabled = false;
      btnProceedToPay.style.opacity = "1";
      btnProceedToPay.innerHTML = `<span>Authorize Transfer ₹<span id="btn-amount-display">${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></span> <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>`;
    }
  }

  btnCloseReceipt.addEventListener("click", () => {
    modalReceiptOverlay.classList.add("hidden");
    playSound("tap");
  });

  modalReceiptOverlay.addEventListener("click", (e) => {
    if (e.target === modalReceiptOverlay) {
      modalReceiptOverlay.classList.add("hidden");
    }
  });

  // Fetch History
  async function fetchHistory() {
    try {
      const res = await fetch("/api/transactions");
      const data = await res.json();
      transactionsHistory = data.transactions || [];

      countAll.textContent = transactionsHistory.length;
      countSettled.textContent = transactionsHistory.filter((t) => t.status === "SETTLED").length;
      countBlocked.textContent = transactionsHistory.filter((t) => t.status === "BLOCKED").length;

      renderPassbookTable();
      renderRecentFeed();
    } catch (e) {
      console.error("Failed to load history:", e);
    }
  }

  function renderRecentFeed() {
    if (transactionsHistory.length === 0) {
      recentTxnsFeed.innerHTML = `<div class="empty-state-text">No settlements recorded yet. Initiate your first transfer.</div>`;
      return;
    }
    recentTxnsFeed.innerHTML = "";
    transactionsHistory.slice(0, 4).forEach((txn) => {
      const isSettled = txn.status === "SETTLED";
      const div = document.createElement("div");
      div.className = "recent-txn-card";
      div.innerHTML = `
        <div>
          <div style="font-weight: 700; color: #fff;">${txn.payee_name}</div>
          <div style="font-size: 0.7rem; color: #94a3b8;">${txn.timestamp}</div>
        </div>
        <div style="text-align: right;">
          <div class="font-mono" style="font-weight: 800; color: ${isSettled ? '#34d399' : '#f87171'}; font-size: 0.95rem;">
            ${isSettled ? '-' : ''}₹${txn.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div style="font-size: 0.68rem; color: ${isSettled ? '#94a3b8' : '#f87171'}; font-weight: ${isSettled ? '400' : '700'};">
            ${isSettled ? 'Settled' : 'Error Detected'}
          </div>
        </div>
      `;
      recentTxnsFeed.appendChild(div);
    });
  }

  function renderPassbookTable() {
    const filtered = transactionsHistory.filter((t) => {
      if (currentFilter === "SETTLED") return t.status === "SETTLED";
      if (currentFilter === "BLOCKED") return t.status === "BLOCKED";
      return true;
    });

    if (filtered.length === 0) {
      passbookTableTbody.innerHTML = `
        <tr class="empty-row">
          <td colspan="7">No ${currentFilter === 'ALL' ? '' : currentFilter.toLowerCase()} settlements recorded.</td>
        </tr>
      `;
      return;
    }

    passbookTableTbody.innerHTML = "";
    filtered.forEach((txn) => {
      const isSettled = txn.status === "SETTLED";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="font-mono" style="font-weight: 700; color: #38bdf8;">${txn.txn_id}</td>
        <td style="color: #94a3b8; font-size: 0.8rem;">${txn.timestamp}</td>
        <td>
          <div style="font-weight: 600;">${txn.payee_name}</div>
          <div class="font-mono" style="font-size: 0.7rem; color: #64748b;">${txn.payee_upi}</div>
        </td>
        <td>
          <div style="font-weight: 500;">HDFC Bank •••• 4920</div>
          <div class="font-mono" style="font-size: 0.7rem; color: #64748b;">${txn.payer_upi}</div>
        </td>
        <td class="font-mono" style="font-weight: 800; font-size: 0.95rem;">₹${txn.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
        <td>
          <span class="status-badge-pill ${isSettled ? 'success' : 'failed'}">
            ${isSettled ? 'Settled' : 'Error Detected'}
          </span>
        </td>
        <td>
          <button class="btn-view-receipt" data-txnid="${txn.txn_id}">Receipt</button>
        </td>
      `;

      tr.querySelector(".btn-view-receipt").addEventListener("click", () => {
        if (!isSettled) {
          receiptBannerHeader.className = "receipt-banner-header error-mode";
          receiptIconContainer.className = "receipt-check-circle error-circle";
          receiptIconContainer.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          `;
          receiptMainTitle.textContent = "Payment Failed (Error Detected)";
          receiptAmountTitle.textContent = "Amount (Unprocessed)";
          receiptAmountVal.className = "amount-number-val font-mono error-val";
          receiptErrorDiagnostic.classList.remove("hidden");
          receiptErrorText.textContent = txn.abort_reason || "Error Detected: Unauthorized communication channel interception detected. Payment was blocked to protect funds. Zero balance was deducted.";
        } else {
          receiptBannerHeader.className = "receipt-banner-header";
          receiptIconContainer.className = "receipt-check-circle";
          receiptIconContainer.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          `;
          receiptMainTitle.textContent = "Payment Successful";
          receiptAmountTitle.textContent = "Settled Amount";
          receiptAmountVal.className = "amount-number-val font-mono";
          receiptErrorDiagnostic.classList.add("hidden");
        }

        receiptTimestamp.textContent = txn.timestamp;
        receiptAmountVal.textContent = `₹${txn.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
        receiptPayeeName.textContent = txn.payee_name;
        receiptPayeeUpi.textContent = txn.payee_upi;
        receiptPayerUpi.textContent = txn.payer_upi;
        receiptUtrNo.textContent = txn.txn_id;
        receiptNoteVal.textContent = txn.note;
        modalReceiptOverlay.classList.remove("hidden");
        playSound("tap");
      });

      passbookTableTbody.appendChild(tr);
    });
  }

  // Passbook Filter Buttons
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.getAttribute("data-filter");
      renderPassbookTable();
      playSound("tap");
    });
  });

  btnRefreshPassbook.addEventListener("click", () => {
    fetchHistory();
    fetchAccountStatus();
    showToast("Statement synchronized.", "info");
    playSound("tap");
  });

  // Initial Load
  loadContacts();
  fetchAccountStatus();
  fetchHistory();
});
