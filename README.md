# FinTech QKD: Quantum-Resilient Cryptographic Framework for Secure Financial Transactions

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Quantum Engine: Qiskit](https://img.shields.io/badge/Quantum%20Engine-Qiskit%202.x-6929C4.svg)](https://qiskit.org/)
[![Cryptography: AES-256-GCM](https://img.shields.io/badge/AEAD-AES--256--GCM-green.svg)](https://csrc.nist.gov/)

A modular, production-grade Python simulation demonstrating how **Quantum Key Distribution (BB84 Protocol)** enables future-proof, quantum-safe cryptographic key agreement for securing high-value interbank and financial transactions.

---

## Table of Contents
1. [Executive Summary & Motivation](#executive-summary--motivation)
2. [Theoretical Foundations & Cryptographic Reasoning](#theoretical-foundations--cryptographic-reasoning)
   - [Shor's Algorithm & "Harvest Now, Decrypt Later"](#shors-algorithm--harvest-now-decrypt-later)
   - [BB84 Protocol Mechanics](#bb84-protocol-mechanics)
   - [No-Cloning Theorem & State Disturbance](#no-cloning-theorem--state-disturbance)
   - [QBER Threshold Derivation](#qber-threshold-derivation)
   - [The Authentication Caveat (Preventing Classical MITM)](#the-authentication-caveat-preventing-classical-mitm)
3. [Architecture & Project Structure](#architecture--project-structure)
4. [Installation & Setup](#installation--setup)
5. [How to Run (Single Command)](#how-to-run-single-command)
6. [Results & Comparative Security Analysis](#results--comparative-security-analysis)
7. [Running the Automated Test Suite](#running-the-automated-test-suite)

---

## Executive Summary & Motivation

Global financial settlement systems (e.g., SWIFT, Fedwire, CHIPS, TARGET2) protect trillions of dollars in daily transaction volume using public-key cryptography (RSA, ECDSA, ECDH).

### The Threat: "Harvest Now, Decrypt Later" (HNDL)
Adversaries and nation-states are currently intercepting and storing encrypted high-value financial data. When cryptanalytically relevant quantum computers (CRQCs) emerge, **Shor's algorithm** will solve the Discrete Logarithm and Prime Factorization problems in polynomial time ($\mathcal{O}((\log N)^3)$), retroactively breaking all recorded RSA/ECC ciphertexts.

### The Solution: QKD + AES-256-GCM
This project demonstrates an end-to-end quantum-resilient pipeline:
1. **BB84 QKD**: Alice and Bob establish an unconditionally secure symmetric key using single-photon quantum states.
2. **Eavesdropping Detection**: Any intercept attempt by Eve perturbs the quantum state, inducing a measurable **Quantum Bit Error Rate (QBER)** that aborts key generation before any payload is encrypted.
3. **AES-256-GCM AEAD**: Grover's quantum search algorithm only reduces AES-256 to 128 bits of security, leaving AES-256-GCM practically unbreakable for encrypting synthetic financial messages.

---

## Theoretical Foundations & Cryptographic Reasoning

### 1. BB84 Protocol Mechanics (Two Simulation Levels)

The BB84 protocol (Bennett & Brassard, 1984) uses two non-orthogonal conjugate measurement bases:
- **Rectilinear ($+$ / $Z$) Basis**: State $|0\rangle$ (Horizontal, bit `0`) and $|1\rangle$ (Vertical, bit `1`).
- **Diagonal ($\times$ / $X$) Basis**: State $|+\rangle = \frac{|0\rangle + |1\rangle}{\sqrt{2}}$ ($+45^\circ$, bit `0`) and $|-\rangle = \frac{|0\rangle - |1\rangle}{\sqrt{2}}$ ($-45^\circ$, bit `1`).

```
                    BB84 POLARIZATION ENCODING
  Bit    Rectilinear (+) Basis      Diagonal (x) Basis
 ──────────────────────────────────────────────────────────
   0             |0⟩ (↑)              |+⟩ = (|0⟩+|1⟩)/√2 (↗)
   1             |1⟩ (→)              |-⟩ = (|0⟩-|1⟩)/√2 (↘)
```

#### Why Mismatched Bases Randomize Measurement Outcomes
When Bob measures a state prepared in basis $\mathcal{B}_A$ using an incompatible conjugate basis $\mathcal{B}_B \neq \mathcal{B}_A$, the state vector has equal projections onto both eigenstates of Bob's measurement operator. According to the Born rule:
$$P(\text{outcome } 0) = |\langle 0 | + \rangle|^2 = \left|\frac{1}{\sqrt{2}}\right|^2 = \frac{1}{2} = 50\%$$
$$P(\text{outcome } 1) = |\langle 1 | + \rangle|^2 = \left|\frac{1}{\sqrt{2}}\right|^2 = \frac{1}{2} = 50\%$$
Thus, Bob measures a purely random bit when bases differ.

### 2. No-Cloning Theorem & State Disturbance
By the Wootters-Zurek No-Cloning Theorem (1982), Eve cannot create an identical replica of an unknown arbitrary quantum state $|\psi\rangle$. 

When Eve executes an **Intercept-and-Resend Attack**:
1. Eve must measure the photon in a guessed basis.
2. If Eve chooses the wrong basis (50% probability), she projects the state into her basis and re-transmits it.
3. When Bob measures in Alice's original basis, he has a 50% probability of error on that photon.
4. Total expected error injected into the sifted key:
$$\text{QBER}_{\text{expected}} = P(\text{Eve wrong basis}) \times P(\text{Bob error} \mid \text{Eve wrong}) = \frac{1}{2} \times \frac{1}{2} = 25\%$$

### 3. QBER Threshold Derivation ($\sim 11\%$)
Using the Csiszár-Körner bound on secret key generation capacity:
$$\Delta I = I(A; B) - I(A; E)$$
For standard one-way classical post-processing, when $\text{QBER} > 11.0\%$, Eve's mutual information $I(A; E)$ surpasses Bob's mutual information $I(A; B)$, making secure privacy amplification mathematically impossible. Therefore, the protocol **must abort** whenever $\text{QBER} > 11\%$.

### 4. The Authentication Caveat (Preventing Classical MITM)
> **CRITICAL SECURITY NOTE:**
> QKD guarantees confidentiality of key exchange over the quantum channel, but **QKD does NOT authenticate identities**.
> Without an authenticated classical channel, an active adversary can perform a classical Man-in-the-Middle (MITM) attack (talking as Bob to Alice and Alice to Bob).
> 
> **Solution in this framework:**
> The public discussion channel is authenticated using **HMAC-SHA256** (or Post-Quantum Digital Signatures). Because QKD yields far more key bits than the small number consumed by the MAC, QKD acts as a **Quantum Key Expander/Grower**.

---

## Architecture & Project Structure

```
.
├── main.py                     # Single-command CLI & Demo runner
├── requirements.txt            # Python dependencies (Qiskit, PyCryptodome, Faker, etc.)
├── README.md                   # Complete architectural & cryptographic documentation
├── qkd/                        # BB84 Quantum Key Distribution engine
│   ├── __init__.py
│   ├── protocol.py             # Data models (Photon, Basis, QKDResult, Privacy Amplification)
│   ├── bb84_classical.py       # Level 1: Classical probabilistic simulation
│   └── bb84_qiskit.py          # Level 2: Real Qiskit quantum circuits (X, H gates, AerSimulator)
├── auth/                       # Classical channel authentication
│   ├── __init__.py
│   └── channel.py              # HMAC-SHA256 signed messaging & MITM detection
├── crypto/                     # Symmetric encryption layer
│   ├── __init__.py
│   └── aes_gcm.py              # AES-256-GCM AEAD cipher with GMAC integrity tags
├── transactions/               # Synthetic financial transaction engine
│   ├── __init__.py
│   └── generator.py            # Faker-based SWIFT/Fedwire transaction generator
├── eve/                        # Eavesdropper & adversarial interceptor
│   ├── __init__.py
│   └── eavesdropper.py         # Intercept-and-resend attack simulator
├── demo/                       # Terminal dashboard & comparative runner
│   ├── __init__.py
│   ├── dashboard.py            # ANSI-colored cryptographic visualizer
│   └── main.py                 # Scenario orchestrator
└── tests/                      # Comprehensive unit test suite
    ├── test_qkd.py             # Level 1 & Level 2 QKD tests
    └── test_crypto_and_system.py # Crypto, Auth, Transactions, Eve tests
```

---

## Installation & Setup

### Prerequisites
- Python 3.10, 3.11, 3.12, 3.13, or 3.14
- Virtual environment (recommended)

### Installation
```bash
# 1. Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt
```

---

## How to Run (Single Command)

### Run Default End-to-End Demonstration
```bash
python main.py
```

### Run with Real Qiskit Quantum Circuits (Level 2)
```bash
python main.py --level 2
```

### Run All Levels Consecutively (Level 1 + Level 2)
```bash
python main.py --all-levels
```

### Advanced CLI Options
```bash
# Custom raw qubit count (e.g., 1024 qubits) and partial eavesdropping (50%)
python main.py --level 2 --bits 1024 --intercept 0.5
```

---

## Results & Comparative Security Analysis

### Clean Run (Honest Channel) vs Attacked Run (Eve Active)

```
┌── [Executive Summary: Clean vs Attacked Comparison] ────────────────────┐
│ Metric                         │ Clean Run         │ Attacked Run (Eve) │
├────────────────────────────────┼───────────────────┼────────────────────┤
│ Raw Quantum Bits (Photons)     │ 512               │ 512                │
│ Sifted Key Length              │ 255               │ 252                │
│ Sample Error Count             │ 0                 │ 7                  │
│ Quantum Bit Error Rate (QBER)  │ 0.00%             │ 14.00% - 28.00%    │
│ Security Threshold (Max QBER)  │ 11.00%            │ 11.00%             │
│ Shared AES-256 Key Derived     │ Yes (Secure)      │ NO (Aborted)       │
│ Financial Transaction Action   │ SETTLED           │ BLOCKED            │
└────────────────────────────────┴───────────────────┴────────────────────┘
```

### Key Findings & Cryptographic Takeaways:
1. **Clean Channel Reliability**:
   - In the absence of an eavesdropper, photon polarizations remain undisturbed.
   - Sifted bits match with 100% fidelity ($\text{QBER} = 0.00\%$).
   - Privacy amplification condenses the sifted bits into a 256-bit AES key.
   - High-value interbank transfer is encrypted via AES-256-GCM, transmitted, decrypted, and settled with verified GMAC integrity.

2. **Guaranteed Eavesdropping Detection**:
   - When Eve intercepts the channel, quantum state collapse injects an average of $\sim 25\%$ error into matching-basis measurements.
   - Public sample estimation detects this spike immediately ($\text{QBER} \gg 11.00\%$).
   - The key exchange protocol is **aborted**, and zero plaintext financial payloads or ciphertexts are exposed.

---

## Running the Automated Test Suite

To verify all unit tests, cryptographic invariants, and simulation levels:

```bash
python -m unittest discover -s tests -p "test_*.py"
```

Expected output:
```
Ran 10 tests in 0.045s

OK
```
