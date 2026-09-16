"""
FinTech QKD: Quantum-Resilient Cryptographic Framework for Secure Financial Transactions.
FastAPI Backend Server providing REST endpoints and serving the QuPay Mobile UPI application.
"""

from datetime import datetime, timezone
import json
import os
import sys
from typing import Any, Dict, List, Optional
import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from auth.channel import AuthenticatedChannel
from crypto.aes_gcm import AESGCMCipher
from eve.eavesdropper import Eavesdropper
from qkd.bb84_classical import ClassicalBB84
from qkd.bb84_qiskit import QiskitBB84
from transactions.generator import generate_transaction


app = FastAPI(
    title="FinTech QKD: Quantum-Resilient UPI Payment Framework",
    description="Backend API simulating continuous BB84 re-keying and AES-256-GCM financial settlements.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global In-Memory State
STATE = {
    "user_balance": 125000.00,
    "eve_enabled": False,
    "eve_rate": 1.0,
    "sim_level": 1,  # 1: Classical, 2: Qiskit
    "transactions": [],
    "total_settled_amount": 0.0,
    "total_blocked_amount": 0.0,
}

CONTACTS = [
    {"name": "Bob Sharma", "upi": "bob@okhdfcbank", "avatar": "👨‍💻", "phone": "+91 98765 43210", "bank": "HDFC Bank"},
    {"name": "Alice Merchant", "upi": "alice@okicici", "avatar": "👩‍💼", "phone": "+91 98123 45678", "bank": "ICICI Bank"},
    {"name": "Carol Crypto", "upi": "carol@oksbi", "avatar": "👩‍💻", "phone": "+91 97001 12233", "bank": "State Bank of India"},
    {"name": "Quantum Cloud", "upi": "server@quantum", "avatar": "☁️", "phone": "+91 90000 88888", "bank": "Reserve Quantum Bank"},
    {"name": "Starbucks Coffee", "upi": "starbucks@okaxis", "avatar": "☕", "phone": "+91 91234 56789", "bank": "Axis Bank"},
    {"name": "Zomato Orders", "upi": "zomato@okpaytm", "avatar": "🍕", "phone": "+91 99887 76655", "bank": "Paytm Payments Bank"},
]


class PaymentRequest(BaseModel):
    payer_name: str = "Spandana Rao"
    payer_upi: str = "spandana@okquantum"
    payee_name: str
    payee_upi: str
    amount: float
    currency: str = "₹"
    note: Optional[str] = "UPI Transfer"
    sim_level: Optional[int] = None


class EveToggleRequest(BaseModel):
    enabled: bool
    rate: Optional[float] = 1.0


@app.get("/api/contacts")
def get_contacts():
    return {"contacts": CONTACTS}


@app.get("/api/security/status")
def get_security_status():
    latest_qber = STATE["transactions"][0]["qber"] if STATE["transactions"] else 0.0
    return {
        "user_balance": STATE["user_balance"],
        "eve_enabled": STATE["eve_enabled"],
        "eve_rate": STATE["eve_rate"],
        "sim_level": STATE["sim_level"],
        "latest_qber": latest_qber,
        "total_settled_count": sum(1 for t in STATE["transactions"] if t["status"] == "SETTLED"),
        "total_blocked_count": sum(1 for t in STATE["transactions"] if t["status"] == "BLOCKED"),
        "total_settled_amount": STATE["total_settled_amount"],
    }


@app.post("/api/eve/toggle")
def toggle_eve(req: EveToggleRequest):
    STATE["eve_enabled"] = req.enabled
    STATE["eve_rate"] = req.rate if req.enabled else 0.0
    return {
        "success": True,
        "eve_enabled": STATE["eve_enabled"],
        "eve_rate": STATE["eve_rate"],
        "message": f"Eve eavesdropper set to {'ACTIVE (' + str(int(STATE['eve_rate']*100)) + '%)' if req.enabled else 'INACTIVE (Honest Channel)'}"
    }


@app.get("/api/transactions")
def get_transactions():
    return {"transactions": STATE["transactions"]}


@app.post("/api/payment/create")
def create_payment(req: PaymentRequest):
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid transfer amount.")
    if req.amount > STATE["user_balance"]:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance.")

    sim_level = req.sim_level if req.sim_level is not None else STATE["sim_level"]
    num_bits = 512
    txn_id = f"UPI-{uuid.uuid4().hex[:12].upper()}"
    timestamp = datetime.now(timezone.utc).strftime("%I:%M %p • %d %b %Y")

    # 1. Classical Channel Authentication (HMAC-SHA256)
    auth_chan = AuthenticatedChannel()
    auth_msg = auth_chan.send(req.payer_upi, req.payee_upi, "PAYMENT_KEY_REQUEST", {"txn_id": txn_id, "amount": req.amount})
    auth_chan.verify_and_receive(auth_msg)

    # 2. Run Fresh Continuous BB84 Round
    eve = Eavesdropper(interception_rate=STATE["eve_rate"]) if STATE["eve_enabled"] else None

    if sim_level == 1:
        sim = ClassicalBB84(num_bits=num_bits)
        qkd_res = sim.run(eavesdropper_fn=eve.intercept_and_resend_classical if eve else None)
    else:
        sim = QiskitBB84(num_bits=num_bits)
        qkd_res = sim.run(eavesdropper=eve)

    # 3. Payload Construction & AES-256-GCM AEAD Encryption
    raw_payload_dict = {
        "txn_id": txn_id,
        "payer_name": req.payer_name,
        "payer_upi": req.payer_upi,
        "payee_name": req.payee_name,
        "payee_upi": req.payee_upi,
        "amount": req.amount,
        "currency": req.currency,
        "note": req.note,
        "timestamp": timestamp,
        "app": "QuPay Quantum-Resilient UPI",
    }
    raw_payload_json = json.dumps(raw_payload_dict)

    is_settled = False
    encrypted_payload = None
    status = "BLOCKED"
    abort_msg = None

    if not qkd_res.is_aborted and qkd_res.final_aes_key:
        cipher = AESGCMCipher(qkd_res.final_aes_key)
        encrypted = cipher.encrypt(raw_payload_json, associated_data=txn_id)
        encrypted_payload = encrypted.to_dict()
        is_settled = True
        status = "SETTLED"
        STATE["user_balance"] -= req.amount
        STATE["total_settled_amount"] += req.amount
    else:
        status = "BLOCKED"
        abort_msg = f"Security Breach Detected: Quantum Bit Error Rate ({qkd_res.qber:.2%}) exceeded 11.00% safety threshold. Protocol aborted immediately."
        STATE["total_blocked_amount"] += req.amount

    # Record in history (newest first)
    record = {
        "txn_id": txn_id,
        "payee_name": req.payee_name,
        "payee_upi": req.payee_upi,
        "payer_name": req.payer_name,
        "payer_upi": req.payer_upi,
        "amount": req.amount,
        "currency": req.currency,
        "note": req.note,
        "timestamp": timestamp,
        "status": status,
        "qber": qkd_res.qber,
        "qber_str": f"{qkd_res.qber:.2%}",
        "raw_bits": qkd_res.raw_bit_count,
        "sifted_bits": len(qkd_res.alice_sifted_key),
        "gmac_tag": encrypted_payload["tag"] if encrypted_payload else "[SUPPRESSED]",
        "nonce": encrypted_payload["nonce"] if encrypted_payload else None,
        "ciphertext": encrypted_payload["ciphertext"] if encrypted_payload else None,
        "aes_key_preview": qkd_res.final_aes_key.hex()[:16] + "..." if qkd_res.final_aes_key else None,
        "hmac_auth_tag": auth_msg.hmac_tag[:16] + "...",
        "engine": "Qiskit 2.x" if sim_level == 2 else "Classical BB84",
        "abort_reason": abort_msg,
    }
    STATE["transactions"].insert(0, record)

    return {
        "success": True,
        "status": status,
        "is_settled": is_settled,
        "transaction": record,
        "user_balance": STATE["user_balance"],
        "qkd": {
            "qber": qkd_res.qber,
            "qber_str": f"{qkd_res.qber:.2%}",
            "raw_bits": qkd_res.raw_bit_count,
            "sifted_bits": len(qkd_res.alice_sifted_key),
            "sample_errors": qkd_res.sample_errors,
            "is_aborted": qkd_res.is_aborted,
            "engine": record["engine"],
        },
        "eve_detected": qkd_res.is_aborted,
    }


# Static Assets Serving
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")


def run():
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8080)


if __name__ == "__main__":
    run()
