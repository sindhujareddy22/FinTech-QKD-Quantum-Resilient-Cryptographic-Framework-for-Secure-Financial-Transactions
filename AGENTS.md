# AGENTS.md

## Project
FinTech QKD: a simulated Quantum Key Distribution (BB84) framework that generates cryptographic keys, detects eavesdropping via induced QBER, and uses the resulting key to AES-encrypt simulated financial transactions between two parties (Sender / Receiver).

This project continues directly from the repository baseline (BB84 dual-engine + Qiskit, AES-256-GCM AEAD, HMAC-SHA256 authenticated classical channel, and interactive web dashboard).

## Stack
- **Backend**: Python, transitioning from Python standard library `http.server` (`web/server.py`) to **FastAPI** for robust REST routes and CORS support.
- **Quantum Engine (BB84)**:
  - Level 1: Classical-logic simulation (`qkd/bb84_classical.py`).
  - Level 2: Real quantum circuit simulation using **Qiskit** with Pauli-X gates, Hadamard gates, and measurement operators (`qkd/bb84_qiskit.py`).
  - Protocol models and SHA-256 Privacy Amplification (`qkd/protocol.py`).
  - Eavesdropper intercept-and-resend attack model (`eve/eavesdropper.py`).
- **Cryptography & Security**:
  - Symmetric Encryption: **AES-256-GCM** via `pycryptodome` with GMAC authentication tags and Authenticated Associated Data (AAD) (`crypto/aes_gcm.py`).
  - Classical Channel Authentication: **HMAC-SHA256** signed messaging preventing classical Man-in-the-Middle (MITM) attacks (`auth/channel.py`).
- **Synthetic Financial Engine**: Faker-based SWIFT / Fedwire transaction generator (`transactions/generator.py`).
- **Frontend**: Responsive, modern dark cyber-quantum UI built in vanilla JavaScript, HTML5, and CSS3 (`web/static/`).
- **Database**: SQLite for local persistence (session tracking and transaction history), Postgres for cloud deployment.
- **Testing**: `unittest` / `pytest` test suites (`tests/test_qkd.py`, `tests/test_crypto_and_system.py`).

## Status of Existing Code
- **Phase 2 (BB84 Engine)**: **COMPLETE & TESTED**. Both Level 1 (Classical) and Level 2 (Qiskit) simulation with Eve interception and QBER calculation are fully operational. *Stable: Do not modify without explicit instruction.*
- **Phase 3 (AES Layer)**: **COMPLETE & TESTED**. AES-256-GCM authenticated encryption/decryption with GMAC tags and tamper rejection is fully operational. *Stable: Do not modify without explicit instruction.*

## Remaining Roadmap (Remapped 8 Phases)

Work through these in order. Do not start phase n+1 until phase n is built, tested, and committed.

1. **`phase-1-scaffold`**:
   - Migrate `web/server.py` to **FastAPI** (with Uvicorn).
   - Add `GET /health` endpoint returning `{"status": "ok", "service": "fintech-qkd-api"}`.
   - Mount `web/static/` to serve existing UI.
   - Add `tests/test_health.py` and verify passing test.
2. **`phase-2-bb84-engine`**:
   - *Status: Already Complete in `qkd/` and `eve/`*. Tested in `tests/test_qkd.py`.
3. **`phase-3-aes-layer`**:
   - *Status: Already Complete in `crypto/aes_gcm.py`*. Tested in `tests/test_crypto_and_system.py`.
4. **`phase-4-backend-api`**:
   - Add SQLite database persistence (`sessions` and `transactions` tables).
   - Implement REST endpoints:
     - `POST /session/start` — run BB84 (Level 1 or 2), store session, return QBER, telemetry, and status.
     - `POST /transaction/send` — check session QBER; abort if compromised, or derive AES key, encrypt payload, and persist.
     - `GET /transaction/{id}` — retrieve and decrypt transaction payload.
     - `GET /transactions` — list all transaction history records with settlement status and QBER.
   - Maintain backwards-compatibility for existing `/api/simulate` and `/api/new-transaction`.
5. **`phase-5-frontend-ui`**:
   - Expand the existing `web/static/` dashboard into 3 distinct navigable views while preserving the photon-beam animation and controls:
     1. **New Transaction** (Simulation & Transfer Form).
     2. **Transaction History** (Live SQLite ledger table with status badges and QBER).
     3. **Transaction Detail** (Ciphertext inspection, IV, GMAC tag, and interactive tamper-test button).
6. **`phase-6-integration-tests`**:
   - Implement HTTP-level end-to-end integration tests (`tests/test_api.py`) covering:
     - Normal flow (secure QKD $\rightarrow$ transfer $\rightarrow$ decrypt).
     - Eavesdropper flow (Eve active $\rightarrow$ QBER $> 11\%$ $\rightarrow$ transfer blocked).
     - Invalid session flow (expired/non-existent session).
     - Tamper rejection test.
7. **`phase-7-deployment`**:
   - Multi-stage `Dockerfile` and `docker-compose.yml`.
   - Deployment configuration for Render / Railway (backend) and Vercel / Netlify (frontend).
   - Environment-based DB URL (SQLite local / Postgres prod) and CORS origins.
   - Live deployment verification.
8. **`phase-8-docs-update`**:
   - Update `README.md` and documentation to reflect FastAPI routes, Qiskit capabilities, and live deployment URLs.

## Commit Conventions
Commit message for each phase = its name exactly (e.g. `git commit -am "phase-1-scaffold"`).
