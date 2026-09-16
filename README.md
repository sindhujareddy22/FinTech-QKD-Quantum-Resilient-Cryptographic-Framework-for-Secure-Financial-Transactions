# FinTech QKD: Quantum-Resilient Cryptographic Framework for Secure Financial Transactions

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Quantum Engine: Qiskit](https://img.shields.io/badge/Quantum%20Engine-Qiskit%202.x-6929C4.svg)](https://qiskit.org/)
[![Cryptography: AES-256-GCM](https://img.shields.io/badge/AEAD-AES--256--GCM-green.svg)](https://csrc.nist.gov/)
[![Dashboard: Streamlit](https://img.shields.io/badge/Dashboard-Streamlit-FF4B4B.svg)](https://streamlit.io/)

A university-grade, production-quality Python application demonstrating how **Quantum Key Distribution (BB84 Protocol)** enables future-proof cryptographic protection for financial transaction streams against "Harvest Now, Decrypt Later" (HNDL) quantum threats.

---

## 🎯 Key Design: Continuous Quantum Re-Keying & Mid-Stream Eavesdropping Catch

Unlike static demos that exchange a single key once, this application models genuine continuous QKD:
1. **Per-Transaction Quantum Re-Keying**: Before *every* synthetic financial transaction, Alice and Bob execute a fresh BB84 quantum exchange to derive a unique, single-use 256-bit symmetric key.
2. **Per-Transaction QBER Integrity Verification**: The system continuously samples and measures the **Quantum Bit Error Rate (QBER)** for each individual transaction round.
   - If $\text{QBER} < 11.00\%$: Key accepted $\rightarrow$ Payload encrypted via AES-256-GCM $\rightarrow$ **`SETTLED`**.
   - If $\text{QBER} \ge 11.00\%$: Key rejected $\rightarrow$ Transaction **`BLOCKED`** immediately $\rightarrow$ Live alert raised!
3. **Mid-Stream Runtime Adversary Toggle**: The user can toggle Eve (the eavesdropper) **ON or OFF at runtime while the stream is actively running**. When Eve is flipped ON, the very next transaction's QBER spikes ($\sim 25\%$), and the alert fires instantaneously!

---

## 📁 Project Architecture & Modules

```
.
├── main.py                     # Single-command launcher (Streamlit Live Dashboard / CLI)
├── requirements.txt            # Python dependencies (Streamlit, Qiskit, PyCryptodome, Faker, Pandas)
├── README.md                   # Full documentation & demonstration guide
├── app/                        # Live Streamlit Dashboard Application
│   ├── __init__.py
│   └── main.py                 # Interactive stream controller, live QBER chart & feed
├── qkd/                        # BB84 Quantum Key Distribution core
│   ├── __init__.py
│   ├── protocol.py             # Data models, Photon representation, SHA-256 Privacy Amplification
│   ├── bb84_classical.py       # Level 1: Classical probabilistic logic simulation
│   └── bb84_qiskit.py          # Level 2: Real Qiskit quantum circuits (X, H gates, Aer/Basic simulator)
├── auth/                       # Classical channel authentication
│   ├── __init__.py
│   └── channel.py              # HMAC-SHA256 authenticated messaging preventing classical MITM
├── crypto/                     # Symmetric post-quantum encryption
│   ├── __init__.py
│   └── aes_gcm.py              # AES-256-GCM AEAD cipher with GMAC integrity validation
├── transactions/               # Synthetic financial transactions
│   ├── __init__.py
│   └── generator.py            # Faker-based SWIFT/Fedwire synthetic transaction generator
├── eve/                        # Adversarial interception simulation
│   ├── __init__.py
│   └── eavesdropper.py         # Intercept-and-resend attack simulator with runtime toggle
├── demo/                       # Terminal CLI comparative runner
│   ├── __init__.py
│   ├── dashboard.py            # ANSI terminal visualizer
│   └── main.py                 # Scenario orchestrator
└── tests/                      # Automated unit test suite
    ├── test_qkd.py             # Level 1 & Level 2 QKD tests
    └── test_crypto_and_system.py # Crypto, Auth, Transactions, Eve tests
```

---

## 🔬 Theoretical Foundations & Cryptographic Reasoning

### 1. Conjugate Bases & Born Rule Measurement
The BB84 protocol uses two mutually unbiased conjugate bases:
- **Rectilinear ($+$ / $Z$) Basis**: State $|0\rangle$ (Bit `0`) and $|1\rangle$ (Bit `1`).
- **Diagonal ($\times$ / $X$) Basis**: State $|+\rangle = \frac{|0\rangle + |1\rangle}{\sqrt{2}}$ (Bit `0`) and $|-\rangle = \frac{|0\rangle - |1\rangle}{\sqrt{2}}$ (Bit `1`).

When Bob measures a state prepared in basis $\mathcal{B}_A$ with basis $\mathcal{B}_B \neq \mathcal{B}_A$, the state vector projects equally onto both eigenstates. By the Born rule:
$$P(\text{outcome } 0) = |\langle 0 | + \rangle|^2 = 50\%, \quad P(\text{outcome } 1) = |\langle 1 | + \rangle|^2 = 50\%$$
Mismatched bases therefore yield pure cryptographic noise and are discarded during authenticated basis sifting.

### 2. No-Cloning Theorem & State Disturbance
By the Wootters-Zurek No-Cloning Theorem (1982), Eve cannot copy unknown quantum states.
In an **Intercept-and-Resend Attack**:
- Eve guesses the basis randomly (50% chance of wrong basis).
- Measuring in the wrong basis collapses the superposition into Eve's basis.
- When Bob measures in Alice's basis, Bob has a 50% probability of an error on that photon.
$$\text{Expected QBER} = P(\text{Eve wrong basis}) \times P(\text{Bob error} \mid \text{Eve wrong}) = \frac{1}{2} \times \frac{1}{2} = 25\%$$

### 3. The 11% QBER Safety Threshold
By the Csiszár-Körner secret key capacity bound:
$$\Delta I = I(A; B) - I(A; E)$$
When $\text{QBER} > 11.00\%$, Eve's mutual information exceeds Bob's mutual information, making secure privacy amplification impossible. The protocol **aborts key generation**, preventing any financial plaintext from being encrypted.

### 4. Channel Authentication Caveat (Preventing Classical MITM)
> **Critical Concept:** QKD guarantees key confidentiality over the quantum channel, but **does not authenticate identities**.
> Without authentication, Eve can mount a classical Man-in-the-Middle (MITM) attack. This framework authenticates the classical reconciliation channel using **HMAC-SHA256**. Because BB84 produces vastly more key bits than consumed by the MAC, QKD acts as a **Quantum Key Expander/Grower**.

---

## 🚀 How to Run (Single Command)

### 1. Launch Live Streamlit Dashboard (Default)
```bash
python main.py
# or
streamlit run app/main.py
```
📍 Opens automatically at: **`http://localhost:8501`**

### 2. Run CLI Comparative Runner
```bash
python main.py --cli
```

### 3. Run Automated Unit Test Suite
```bash
python -m unittest discover -s tests -p "test_*.py"
```

---

## 🎬 How to Demo Live (Step-by-Step Script)

1. **Start the Clean Stream**:
   - Open **`http://localhost:8501`**.
   - Click **`▶️ Start Live Stream`** with Eve disabled.
   - *Observation*: Transactions stream sequentially every ~0.8s. All transactions show green **`SETTLED`** badges, QBER stays at **`0.00%`**, and the live chart shows a flat line well below the 11% red threshold.
2. **Flip Eve ON Mid-Stream**:
   - While the stream is actively running, toggle **`⚠️ Enable Eavesdropper (Eve)`** in the sidebar.
   - *Observation*: On the **very next transaction**, the QBER immediately spikes to **`25.00% - 30.00%`**. The system instantly aborts key derivation, the transaction is marked **`BLOCKED`**, and a prominent red alert banner fires:
     > **🚨 EAVESDROPPER DETECTED — TRANSACTION BLOCKED!**
3. **Turn Eve OFF Mid-Stream**:
   - Switch Eve back to **`OFF`**.
   - *Observation*: The next transaction returns to **`0.00% QBER`**, the alert clears, and transactions resume settling normally.
4. **Switch to Qiskit Circuit Simulation**:
   - Select **`Level 2 (Qiskit Quantum Circuits)`** to show that genuine quantum circuits (with Pauli-X and Hadamard gates) are being executed for each transaction key.
