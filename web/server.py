"""
Web Server and REST API for FinTech QKD UPI Interactive Payment Dashboard.
"""

from datetime import datetime, timezone
from http.server import HTTPServer, SimpleHTTPRequestHandler
import json
import os
import sys
import uuid
from typing import Any, Dict
from urllib.parse import urlparse

# Ensure root directory is on sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from auth.channel import AuthenticatedChannel
from crypto.aes_gcm import AESGCMCipher, DecryptionError, EncryptedPayload
from eve.eavesdropper import Eavesdropper
from qkd.bb84_classical import ClassicalBB84
from qkd.bb84_qiskit import QiskitBB84
from qkd.protocol import Basis
from transactions.generator import FinancialTransaction, generate_transaction


WEB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")


class QKDServerHandler(SimpleHTTPRequestHandler):
    """
    HTTP Request Handler serving static web assets and UPI QKD payment endpoints.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def _send_json(self, data: Dict[str, Any], status: int = 200):
        response_bytes = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(response_bytes)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(response_bytes)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        url = urlparse(self.path)
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length) if content_length > 0 else b"{}"

        try:
            body = json.loads(post_data.decode("utf-8")) if post_data else {}
        except Exception:
            body = {}

        if url.path == "/api/simulate":
            self.handle_simulate(body)
        elif url.path == "/api/new-transaction":
            self.handle_new_transaction(body)
        elif url.path == "/api/send-upi-payment":
            self.handle_send_upi_payment(body)
        else:
            self._send_json({"error": "Endpoint not found"}, status=404)

    def handle_new_transaction(self, body: dict):
        txn = generate_transaction()
        self._send_json({"success": True, "transaction": txn.to_dict()})

    def handle_send_upi_payment(self, body: dict):
        # Extract user input details
        payer_name = body.get("payer_name", "Spandana Rao")
        payer_upi = body.get("payer_upi", "spandana@okaxis")
        payee_name = body.get("payee_name", "Bob Sharma")
        payee_upi = body.get("payee_upi", "bob@okhdfcbank")
        amount = float(body.get("amount", 2500.0))
        currency = body.get("currency", "₹")
        note = body.get("note", "Interbank Transfer")
        
        level = int(body.get("level", 1))
        num_bits = int(body.get("num_bits", 512))
        eve_enabled = bool(body.get("eve_enabled", False))
        eve_rate = float(body.get("eve_rate", 1.0)) if eve_enabled else 0.0

        # Construct UPI Transaction Object
        txn_id = f"UPI-{uuid.uuid4().hex[:12].upper()}"
        timestamp = datetime.now(timezone.utc).isoformat()
        
        raw_payload_dict = {
            "txn_id": txn_id,
            "payer_name": payer_name,
            "payer_upi": payer_upi,
            "payee_name": payee_name,
            "payee_upi": payee_upi,
            "amount": amount,
            "currency": currency,
            "note": note,
            "timestamp": timestamp,
            "protocol": "UPI-QKD-2.0",
        }
        raw_payload_json = json.dumps(raw_payload_dict, indent=2)

        # Authenticate classical channel
        auth_chan = AuthenticatedChannel()
        auth_msg = auth_chan.send(payer_upi, payee_upi, "UPI_KEY_INIT", {"txn_id": txn_id, "bits": num_bits})
        auth_verified = auth_chan.verify_and_receive(auth_msg)

        eve = Eavesdropper(interception_rate=eve_rate) if eve_enabled else None

        if level == 1:
            sim = ClassicalBB84(num_bits=num_bits)
            qkd_res = sim.run(eavesdropper_fn=eve.intercept_and_resend_classical if eve else None)
        else:
            sim = QiskitBB84(num_bits=num_bits)
            qkd_res = sim.run(eavesdropper=eve)

        settlement_info = {}
        if not qkd_res.is_aborted and qkd_res.final_aes_key:
            cipher = AESGCMCipher(qkd_res.final_aes_key)
            encrypted = cipher.encrypt(raw_payload_json, associated_data=txn_id)
            decrypted_str = cipher.decrypt(encrypted)
            settlement_info = {
                "status": "SUCCESS",
                "message": "Payment transferred successfully via quantum-secured AES-256-GCM.",
                "encrypted_payload": encrypted.to_dict(),
                "decrypted_valid": True,
            }
        else:
            settlement_info = {
                "status": "BLOCKED",
                "message": f"TRANSACTION BLOCKED! Quantum Eavesdropping Detected (QBER: {qkd_res.qber:.2%}). Zero funds or data transmitted.",
                "encrypted_payload": None,
                "decrypted_valid": False,
            }

        response = {
            "success": True,
            "transaction": raw_payload_dict,
            "settlement": settlement_info,
            "qkd": {
                "simulation_level": qkd_res.simulation_level,
                "raw_bit_count": qkd_res.raw_bit_count,
                "sifted_count": len(qkd_res.alice_sifted_key),
                "sample_count": len(qkd_res.sample_indices),
                "sample_errors": qkd_res.sample_errors,
                "qber": qkd_res.qber,
                "abort_threshold": qkd_res.abort_threshold,
                "is_aborted": qkd_res.is_aborted,
                "abort_reason": qkd_res.abort_reason,
                "aes_key_hex": qkd_res.final_aes_key.hex() if qkd_res.final_aes_key else None,
                "hmac_auth_tag": auth_msg.hmac_tag,
            },
            "eve": {
                "enabled": eve_enabled,
                "rate": eve_rate,
            }
        }
        self._send_json(response)

    def handle_simulate(self, body: dict):
        level = int(body.get("level", 1))
        num_bits = int(body.get("num_bits", 256))
        eve_enabled = bool(body.get("eve_enabled", False))
        eve_rate = float(body.get("eve_rate", 1.0)) if eve_enabled else 0.0

        auth_chan = AuthenticatedChannel()
        auth_msg = auth_chan.send("Alice", "Bob", "BB84_INIT", {"bits": num_bits, "level": level})
        auth_verified = auth_chan.verify_and_receive(auth_msg)

        eve = Eavesdropper(interception_rate=eve_rate) if eve_enabled else None

        if level == 1:
            sim = ClassicalBB84(num_bits=num_bits)
            qkd_res = sim.run(eavesdropper_fn=eve.intercept_and_resend_classical if eve else None)
        else:
            sim = QiskitBB84(num_bits=num_bits)
            qkd_res = sim.run(eavesdropper=eve)

        vis_count = min(64, num_bits)
        visual_photons = []
        for i in range(vis_count):
            a_bit = qkd_res.alice_raw_bits[i]
            a_basis = qkd_res.alice_bases[i].value
            b_basis = qkd_res.bob_bases[i].value
            b_bit = qkd_res.bob_measured_bits[i]
            is_sifted = (i in qkd_res.sifted_indices)
            is_sample = (i in qkd_res.sample_indices)
            visual_photons.append({
                "index": i,
                "alice_bit": a_bit,
                "alice_basis": a_basis,
                "bob_basis": b_basis,
                "bob_bit": b_bit,
                "bases_match": a_basis == b_basis,
                "bits_match": a_bit == b_bit,
                "is_sifted": is_sifted,
                "is_sample": is_sample,
            })

        txn = generate_transaction()
        settlement_info = None

        if not qkd_res.is_aborted and qkd_res.final_aes_key:
            cipher = AESGCMCipher(qkd_res.final_aes_key)
            encrypted = cipher.encrypt(txn.to_json(), associated_data=txn.txn_id)
            decrypted_str = cipher.decrypt(encrypted)
            settlement_info = {
                "status": "SETTLED",
                "encrypted_payload": encrypted.to_dict(),
                "decrypted_valid": True,
                "message": "Transaction verified and settled with 100% GMAC integrity tag confirmation.",
            }
        else:
            settlement_info = {
                "status": "BLOCKED",
                "encrypted_payload": None,
                "decrypted_valid": False,
                "message": f"TRANSACTION BLOCKED! Security threshold breached ({qkd_res.qber:.2%} QBER). No financial data transmitted.",
            }

        response_payload = {
            "success": True,
            "simulation_level": qkd_res.simulation_level,
            "num_bits": qkd_res.raw_bit_count,
            "eve_enabled": eve_enabled,
            "eve_rate": eve_rate,
            "sifted_length": len(qkd_res.alice_sifted_key),
            "sample_length": len(qkd_res.sample_indices),
            "sample_errors": qkd_res.sample_errors,
            "qber": qkd_res.qber,
            "abort_threshold": qkd_res.abort_threshold,
            "is_aborted": qkd_res.is_aborted,
            "abort_reason": qkd_res.abort_reason,
            "final_aes_key_hex": qkd_res.final_aes_key.hex() if qkd_res.final_aes_key else None,
            "hmac_auth_tag": auth_msg.hmac_tag,
            "visual_photons": visual_photons,
            "transaction": txn.to_dict(),
            "settlement": settlement_info,
        }

        self._send_json(response_payload)


def run_server(port: int = 8080, host: str = "127.0.0.1"):
    os.makedirs(WEB_DIR, exist_ok=True)
    server_address = (host, port)
    httpd = HTTPServer(server_address, QKDServerHandler)
    print(f"\n🚀 FinTech QKD Web App running at: http://{host}:{port}")
    httpd.serve_forever()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    run_server(port=port)
