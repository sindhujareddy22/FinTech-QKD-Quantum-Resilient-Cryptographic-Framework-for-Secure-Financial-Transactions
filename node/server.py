"""
FinTech QKD Node Daemon & Server
================================
Runs as either:
- 'bank' (Bank A, Initiator/Sender)
- 'clearing' (Clearing House, Receiver)

Provides:
1. Inter-node REST/WebSocket communication across physical LAN or localhost.
2. Real-time WebSocket connection to the local browser UI console.
3. Continuous per-settlement BB84 QKD + PQC Kyber + AES-256-GCM pipeline execution.
"""

import asyncio
import json
import time
import uuid
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import httpx
import uvicorn

from config import CONFIG, QKDConfig
from qkd.level1 import BB84Alice, BB84Bob, Photon, calculate_qber, QKDResult
from eve.interceptor import Eavesdropper
from crypto.aes_gcm import AES256GCMCipher, EncryptedPayload, TamperDetectedError
from pqc.kyber_hybrid import PQCKyberKEM, HybridKeyCombiner, PQCKeyPair
from auth.hmac_auth import HMACAuthenticator, AuthenticationError
from transactions.generator import generate_synthetic_settlement_batch, SettlementBatch


class NodeState:
    """Encapsulates in-memory operational state for a banking node."""
    def __init__(self, role: str, host: str, port: int, peer_host: str, peer_port: int):
        self.role = role  # 'bank' or 'clearing'
        self.host = host
        self.port = port
        self.peer_host = peer_host
        self.peer_port = peer_port
        self.peer_url = f"http://{peer_host}:{peer_port}"
        
        # Security & Channel state
        self.channel_secure = True
        self.latest_qber = 0.0
        self.qber_threshold = CONFIG.QBER_ABORT_THRESHOLD
        self.alert_message: Optional[str] = None
        self.peer_connected = False
        
        # Interceptor (Eve)
        self.eve = Eavesdropper(is_active=False, tamper_ciphertext=False)
        
        # Cryptographic & Authentication handlers
        self.authenticator = HMACAuthenticator(CONFIG.HMAC_PRESHARED_SECRET)
        self.seq_num = 0
        
        # Temporary ephemeral round states for Bob (Clearing House)
        self.current_bob: Optional[BB84Bob] = None
        self.current_pqc_keypair: Optional[PQCKeyPair] = None
        self.current_session_key: Optional[bytes] = None
        
        # Settlement history & metrics
        self.settlement_logs: List[Dict[str, Any]] = []
        self.total_settlements = 0
        self.settled_count = 0
        self.blocked_count = 0
        
        # Auto-streaming
        self.auto_stream_active = False
        self.auto_stream_task: Optional[asyncio.Task] = None
        
        # Connected UI WebSockets
        self.ui_websockets: List[WebSocket] = []

    def get_status_dict(self) -> Dict[str, Any]:
        """Snapshot of node status for UI dashboard."""
        return {
            "role": self.role,
            "node_name": "BANK A (SENDER)" if self.role == "bank" else "CLEARING HOUSE (RECEIVER)",
            "host": self.host,
            "port": self.port,
            "peer_host": self.peer_host,
            "peer_port": self.peer_port,
            "peer_connected": self.peer_connected,
            "channel_secure": self.channel_secure,
            "latest_qber": round(self.latest_qber * 100, 2),
            "qber_threshold": round(self.qber_threshold * 100, 2),
            "alert_message": self.alert_message,
            "eve_active": self.eve.is_active,
            "tamper_active": self.eve.tamper_ciphertext,
            "auto_stream": self.auto_stream_active,
            "total_settlements": self.total_settlements,
            "settled_count": self.settled_count,
            "blocked_count": self.blocked_count,
            "settlement_logs": self.settlement_logs[:100],  # Latest 100 logs
        }

    async def broadcast_ui_update(self):
        """Pushes real-time status update to all connected browser UI instances."""
        if not self.ui_websockets:
            return
        status = self.get_status_dict()
        disconnected = []
        for ws in self.ui_websockets:
            try:
                await ws.send_json({"type": "STATUS_UPDATE", "data": status})
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            if ws in self.ui_websockets:
                self.ui_websockets.remove(ws)


def create_node_app(role: str, host: str, port: int, peer_host: str, peer_port: int) -> FastAPI:
    """Factory creating configured FastAPI app for a node."""
    app = FastAPI(title=f"FinTech QKD Node ({role.upper()})")
    state = NodeState(role, host, port, peer_host, peer_port)
    app.state.node = state

    # Mount UI static files
    import os
    static_dir = os.path.join(os.path.dirname(__file__), "..", "ui", "static")
    if os.path.exists(static_dir):
        app.mount("/static", StaticFiles(directory=static_dir), name="static")

    @app.get("/")
    async def serve_index():
        index_file = os.path.join(static_dir, "index.html")
        return FileResponse(index_file)

    @app.get("/api/status")
    async def get_status():
        return state.get_status_dict()

    @app.websocket("/ws")
    async def websocket_endpoint(websocket: WebSocket):
        await websocket.accept()
        state.ui_websockets.append(websocket)
        # Send immediate initial state
        await websocket.send_json({"type": "STATUS_UPDATE", "data": state.get_status_dict()})
        try:
            while True:
                data = await websocket.receive_json()
                action = data.get("action")
                if action == "SETTLE":
                    asyncio.create_task(run_settlement_round(state))
                elif action == "TOGGLE_EVE":
                    new_val = data.get("value")
                    state.eve.toggle_active(new_val)
                    await state.broadcast_ui_update()
                elif action == "TOGGLE_TAMPER":
                    new_val = data.get("value")
                    state.eve.toggle_tamper(new_val)
                    await state.broadcast_ui_update()
                elif action == "TOGGLE_AUTO_STREAM":
                    state.auto_stream_active = not state.auto_stream_active
                    if state.auto_stream_active:
                        state.auto_stream_task = asyncio.create_task(auto_stream_worker(state))
                    else:
                        if state.auto_stream_task:
                            state.auto_stream_task.cancel()
                    await state.broadcast_ui_update()
        except WebSocketDisconnect:
            if websocket in state.ui_websockets:
                state.ui_websockets.remove(websocket)

    # ---------------- OPERATOR REST ENDPOINTS (TERMINAL & UI) ----------------

    @app.post("/api/settle")
    async def api_settle():
        """Triggers a settlement round on Bank A node."""
        if state.role != "bank":
            raise HTTPException(status_code=400, detail="Only Bank node can initiate settlements.")
        asyncio.create_task(run_settlement_round(state))
        return {"status": "SETTLEMENT_INITIATED"}

    @app.post("/api/eve/toggle")
    async def api_toggle_eve(payload: Dict[str, Any] = None):
        """Sets or toggles Eve quantum wiretap state."""
        val = payload.get("value") if payload else None
        is_active = state.eve.toggle_active(val)
        await state.broadcast_ui_update()
        return {"eve_active": is_active}

    @app.post("/api/eve/tamper")
    async def api_toggle_tamper(payload: Dict[str, Any] = None):
        """Sets or toggles AES-GCM ciphertext tampering state."""
        val = payload.get("value") if payload else None
        is_tamper = state.eve.toggle_tamper(val)
        await state.broadcast_ui_update()
        return {"tamper_active": is_tamper}

    # ---------------- INTER-NODE PROTOCOL ENDPOINTS ----------------

    @app.get("/api/health")
    async def health_check():
        return {"status": "ok", "role": state.role, "time": time.time()}

    @app.post("/api/qkd/receive-photons")
    async def receive_photons(payload: Dict[str, Any]):
        """Clearing House endpoint: Bob receives Alice's photons."""
        photons_data = payload.get("photons", [])
        photons = [Photon(bit=p["bit"], basis=p["basis"]) for p in photons_data]
        
        bob = BB84Bob(num_photons=len(photons))
        bob.choose_bases(len(photons))
        bob.measure_photons(photons)
        state.current_bob = bob
        
        # Return Bob's measurement bases for classical sifting
        return {"bases": bob.bases}

    @app.post("/api/qkd/sample-verify")
    async def sample_verify(payload: Dict[str, Any]):
        """Clearing House endpoint: Verifies sample bits to compute QBER."""
        if not state.current_bob:
            raise HTTPException(status_code=400, detail="No active BB84 session.")
        
        sifted_indices = payload.get("sifted_indices", [])
        sample_indices = payload.get("sample_indices", [])
        alice_samples = payload.get("alice_samples", [])

        state.current_bob.set_sifted_indices(sifted_indices)
        state.current_bob.set_sample_indices(sample_indices)
        bob_samples = state.current_bob.get_sample_bits()

        qber, errors = calculate_qber(alice_samples, bob_samples)
        state.latest_qber = qber
        state.channel_secure = (qber < state.qber_threshold)

        if not state.channel_secure:
            state.alert_message = f"Eavesdropper detected — settlement blocked (QBER: {qber*100:.1f}%)"
            # Clear ephemeral states on abort
            state.current_bob = None
            state.current_session_key = None
            await state.broadcast_ui_update()
            return {"success": False, "qber": qber, "errors": errors, "abort": True}

        state.alert_message = None
        # Derive Bob's QKD key
        bob_qkd_key = state.current_bob.derive_final_key()
        
        # Prepare PQC Kyber Keypair
        kp = PQCKyberKEM.generate_keypair()
        state.current_pqc_keypair = kp
        state.current_session_key = bob_qkd_key  # Temporarily store QKD key
        await state.broadcast_ui_update()

        return {
            "success": True,
            "qber": qber,
            "errors": errors,
            "pqc_public_key": kp.public_key.hex(),
        }

    @app.post("/api/pqc/kem-exchange")
    async def pqc_kem_exchange(payload: Dict[str, Any]):
        """Clearing House endpoint: Receives encapsulated PQC ciphertext and derives hybrid session key."""
        if not state.current_pqc_keypair or not state.current_session_key:
            raise HTTPException(status_code=400, detail="Missing PQC session context.")

        ct_hex = payload.get("pqc_ciphertext", "")
        pqc_ct = bytes.fromhex(ct_hex)
        pqc_ss = PQCKyberKEM.decapsulate(
            pqc_ct,
            state.current_pqc_keypair.private_key,
            state.current_pqc_keypair.public_key
        )

        # Derive final hybrid key
        final_session_key = HybridKeyCombiner.combine_keys(
            qkd_key=state.current_session_key,
            pqc_shared_secret=pqc_ss
        )
        state.current_session_key = final_session_key
        return {"status": "KEY_DERIVED"}

    @app.post("/api/settlement/process-batch")
    async def process_batch(packet_dict: Dict[str, Any]):
        """Clearing House endpoint: Verifies HMAC, decrypts batch with session key, and settles."""
        state.total_settlements += 1
        
        try:
            # 1. HMAC Verification
            packet = state.authenticator.sign.__annotations__  # type checking helper
            from auth.hmac_auth import AuthenticatedPacket
            auth_packet = AuthenticatedPacket.from_dict(packet_dict)
            verified_payload = state.authenticator.verify(auth_packet)

            # 2. Decrypt with Session Key
            if not state.current_session_key:
                raise TamperDetectedError("No active cryptographic session key available.")

            enc_payload = EncryptedPayload.from_dict(verified_payload)
            decrypted_bytes = AES256GCMCipher.decrypt(enc_payload, state.current_session_key)
            batch_data = json.loads(decrypted_bytes.decode('utf-8'))

            state.settled_count += 1
            state.channel_secure = True
            state.alert_message = None

            log_entry = {
                "id": str(uuid.uuid4())[:8],
                "time": time.strftime("%H:%M:%S"),
                "batch_id": batch_data.get("batch_id"),
                "amount": f"${batch_data.get('total_amount', 0):,.2f}",
                "currency": batch_data.get("currency", "USD"),
                "tx_count": batch_data.get("transaction_count", 0),
                "status": "SETTLED",
                "qber": f"{state.latest_qber * 100:.1f}%",
                "reason": "Cryptographically Verified (QKD + PQC + AES-GCM)",
                "batch_detail": batch_data,
            }
            state.settlement_logs.insert(0, log_entry)
            await state.broadcast_ui_update()
            return {"status": "SETTLED", "batch_id": batch_data.get("batch_id")}

        except (TamperDetectedError, AuthenticationError, Exception) as exc:
            state.blocked_count += 1
            state.channel_secure = False
            state.alert_message = f"Security Breach Detected — Settlement Blocked: {str(exc)}"
            
            log_entry = {
                "id": str(uuid.uuid4())[:8],
                "time": time.strftime("%H:%M:%S"),
                "batch_id": "REJECTED-TAMPERED",
                "amount": "$0.00",
                "currency": "USD",
                "tx_count": 0,
                "status": "BLOCKED",
                "qber": f"{state.latest_qber * 100:.1f}%",
                "reason": str(exc),
                "batch_detail": None,
            }
            state.settlement_logs.insert(0, log_entry)
            await state.broadcast_ui_update()
            raise HTTPException(status_code=400, detail=str(exc))

    return app


async def run_settlement_round(state: NodeState):
    """
    Bank A logic: Executes one full settlement round with per-settlement re-keying.
    """
    if state.role != "bank":
        return

    state.total_settlements += 1
    state.seq_num += 1

    async with httpx.AsyncClient(timeout=8.0) as client:
        try:
            # 0. Check peer health
            try:
                h_res = await client.get(f"{state.peer_url}/api/health")
                state.peer_connected = (h_res.status_code == 200)
            except Exception:
                state.peer_connected = False
                state.blocked_count += 1
                state.channel_secure = False
                state.alert_message = f"Peer node unreachable at {state.peer_url}"
                log_entry = {
                    "id": str(uuid.uuid4())[:8],
                    "time": time.strftime("%H:%M:%S"),
                    "batch_id": "UNREACHABLE",
                    "amount": "$0.00",
                    "currency": "USD",
                    "tx_count": 0,
                    "status": "BLOCKED",
                    "qber": "N/A",
                    "reason": f"Connection refused by peer {state.peer_url}",
                    "batch_detail": None,
                }
                state.settlement_logs.insert(0, log_entry)
                await state.broadcast_ui_update()
                return

            # 1. Prepare Alice's Photons & Apply Eve Interception
            alice = BB84Alice(num_photons=CONFIG.PHOTONS_PER_ROUND)
            raw_photons = alice.prepare_photons()
            transmitted_photons = state.eve.intercept_photons(raw_photons)

            # Send photons to Bob over quantum channel
            photons_payload = [{"bit": p.bit, "basis": p.basis} for p in transmitted_photons]
            recv_res = await client.post(f"{state.peer_url}/api/qkd/receive-photons", json={"photons": photons_payload})
            bob_bases = recv_res.json()["bases"]

            # 2. Classical Sifting & Public Sampling
            sifted_indices = alice.sift_bases(bob_bases)
            sample_indices = alice.select_sample_indices(CONFIG.SAMPLE_FRACTION)
            alice_samples = alice.get_sample_bits()

            # 3. QBER Estimation & Eavesdrop Security Gate
            verify_payload = {
                "sifted_indices": sifted_indices,
                "sample_indices": sample_indices,
                "alice_samples": alice_samples,
            }
            verify_res = await client.post(f"{state.peer_url}/api/qkd/sample-verify", json=verify_payload)
            v_data = verify_res.json()

            qber = v_data.get("qber", 0.0)
            state.latest_qber = qber

            if not v_data.get("success", False) or qber >= state.qber_threshold:
                # EAVESDROPPER DETECTED: ABORT IMMEDIATELY
                state.channel_secure = False
                state.blocked_count += 1
                state.alert_message = "Eavesdropper detected — settlement blocked"
                
                log_entry = {
                    "id": str(uuid.uuid4())[:8],
                    "time": time.strftime("%H:%M:%S"),
                    "batch_id": f"BLOCKED-QBER-{int(qber*100)}PCT",
                    "amount": "$0.00",
                    "currency": "USD",
                    "tx_count": 0,
                    "status": "BLOCKED",
                    "qber": f"{qber * 100:.1f}%",
                    "reason": f"QBER {qber*100:.1f}% exceeded safety threshold ({state.qber_threshold*100:.1f}%). Transmission halted.",
                    "batch_detail": None,
                }
                state.settlement_logs.insert(0, log_entry)
                await state.broadcast_ui_update()
                return

            # 4. Channel is SECURE -> Derive Keys & Execute Settlement
            state.channel_secure = True
            state.alert_message = None
            alice_qkd_key = alice.derive_final_key()

            # PQC Kyber KEM Encapsulation
            bob_pub_key_hex = v_data["pqc_public_key"]
            bob_pub_key = bytes.fromhex(bob_pub_key_hex)
            pqc_bundle = PQCKyberKEM.encapsulate(bob_pub_key)

            # Send encapsulated ciphertext to Bob
            await client.post(
                f"{state.peer_url}/api/pqc/kem-exchange",
                json={"pqc_ciphertext": pqc_bundle.ciphertext.hex()}
            )

            # Combine QKD + PQC keys via HKDF
            session_key = HybridKeyCombiner.combine_keys(
                qkd_key=alice_qkd_key,
                pqc_shared_secret=pqc_bundle.shared_secret
            )

            # 5. Generate ISO 20022 Batch & Encrypt with AES-256-GCM
            batch = generate_synthetic_settlement_batch()
            batch_bytes = json.dumps(batch.to_dict()).encode('utf-8')
            enc_payload = AES256GCMCipher.encrypt(batch_bytes, session_key)

            # Apply ciphertext tampering if attacker tamper toggle is ON
            if state.eve.tamper_ciphertext:
                tampered_ct = state.eve.tamper_b64_ciphertext(enc_payload.ciphertext_b64)
                enc_dict = {
                    "nonce": enc_payload.nonce_b64,
                    "ciphertext": tampered_ct,
                    "associated_data": enc_payload.associated_data_b64,
                }
            else:
                enc_dict = enc_payload.to_dict()

            # 6. HMAC-SHA256 Sign and Transmit
            signed_packet = state.authenticator.sign(enc_dict, sequence_number=state.seq_num)
            tx_res = await client.post(
                f"{state.peer_url}/api/settlement/process-batch",
                json=signed_packet.to_dict()
            )

            if tx_res.status_code == 200:
                state.settled_count += 1
                log_entry = {
                    "id": str(uuid.uuid4())[:8],
                    "time": time.strftime("%H:%M:%S"),
                    "batch_id": batch.batch_id,
                    "amount": f"${batch.total_amount:,.2f}",
                    "currency": batch.currency,
                    "tx_count": batch.transaction_count,
                    "status": "SETTLED",
                    "qber": f"{qber * 100:.1f}%",
                    "reason": "Quantum-Resilient Settlement Confirmed",
                    "batch_detail": batch.to_dict(),
                }
                state.settlement_logs.insert(0, log_entry)
            else:
                state.blocked_count += 1
                state.channel_secure = False
                state.alert_message = f"Settlement rejected by receiver: {tx_res.text}"
                log_entry = {
                    "id": str(uuid.uuid4())[:8],
                    "time": time.strftime("%H:%M:%S"),
                    "batch_id": batch.batch_id,
                    "amount": f"${batch.total_amount:,.2f}",
                    "currency": batch.currency,
                    "tx_count": batch.transaction_count,
                    "status": "BLOCKED",
                    "qber": f"{qber * 100:.1f}%",
                    "reason": f"Receiver rejected payload: {tx_res.text}",
                    "batch_detail": batch.to_dict(),
                }
                state.settlement_logs.insert(0, log_entry)

            await state.broadcast_ui_update()

        except Exception as exc:
            state.blocked_count += 1
            state.channel_secure = False
            state.alert_message = f"Settlement exception: {str(exc)}"
            log_entry = {
                "id": str(uuid.uuid4())[:8],
                "time": time.strftime("%H:%M:%S"),
                "batch_id": "ERROR",
                "amount": "$0.00",
                "currency": "USD",
                "tx_count": 0,
                "status": "BLOCKED",
                "qber": f"{state.latest_qber * 100:.1f}%",
                "reason": str(exc),
                "batch_detail": None,
            }
            state.settlement_logs.insert(0, log_entry)
            await state.broadcast_ui_update()


async def auto_stream_worker(state: NodeState):
    """Background worker for slow auto-settlement streaming."""
    while state.auto_stream_active:
        await run_settlement_round(state)
        await asyncio.sleep(CONFIG.AUTO_STREAM_INTERVAL)


def start_node_server(role: str, host: str, port: int, peer_host: str, peer_port: int):
    """Entry point for running node server via Uvicorn."""
    app = create_node_app(role, host, port, peer_host, peer_port)
    uvicorn.run(app, host=host, port=port, log_level="warning")
