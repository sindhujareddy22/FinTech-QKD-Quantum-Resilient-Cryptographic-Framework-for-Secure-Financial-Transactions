"""
HMAC-SHA256 Classical Channel Authentication Module
===================================================

WHY QKD ALONE DOES NOT PREVENT MAN-IN-THE-MIDDLE (MITM) ATTACKS:
---------------------------------------------------------------
A common misconception is that Quantum Key Distribution solves authentication.
It does NOT:
1. QKD guarantees information-theoretic secrecy: if Alice and Bob agree on a key
   with QBER < 11%, quantum physics guarantees no third party has copied or measured
   the photon states without introducing detectable perturbation.
2. HOWEVER, QKD does not authenticate identity. Without classical authentication, an
   active adversary Eve could sit on the link, pose as Bob to Alice, and pose as
   Alice to Bob. Eve would successfully run BB84 with Alice (establishing Key_AE)
   and separately run BB84 with Bob (establishing Key_EB). Eve could then transparently
   decrypt, inspect/tamper, and re-encrypt every interbank settlement!
3. Therefore, all classical messages (basis announcement, sample verification, 
   ciphertext transmission) MUST be authenticated using an unconditionally secure
   or pre-shared key (PSK) message authentication code (HMAC-SHA256 / Wegman-Carter).
"""

import hmac
import hashlib
import json
import time
from dataclasses import dataclass
from typing import Dict, Any, Optional


class AuthenticationError(Exception):
    """Raised when HMAC authentication fails, indicating spoofing or packet tampering."""
    pass


@dataclass
class AuthenticatedPacket:
    """A signed message containing payload, timestamp, sequence number, and HMAC tag."""
    payload: Dict[str, Any]
    timestamp: float
    sequence_number: int
    hmac_signature: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "payload": self.payload,
            "timestamp": self.timestamp,
            "sequence_number": self.sequence_number,
            "hmac_signature": self.hmac_signature,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AuthenticatedPacket":
        return cls(
            payload=data["payload"],
            timestamp=data["timestamp"],
            sequence_number=data["sequence_number"],
            hmac_signature=data["hmac_signature"],
        )


class HMACAuthenticator:
    """
    Signs and verifies classical packets between Bank A and Clearing House.
    """
    def __init__(self, preshared_key: bytes):
        self.preshared_key = preshared_key
        self.last_received_seq = -1

    def _compute_digest(self, payload: Dict[str, Any], timestamp: float, sequence_number: int) -> str:
        canonical_json = json.dumps(payload, sort_keys=True, separators=(',', ':'))
        message_bytes = f"{canonical_json}|{timestamp:.4f}|{sequence_number}".encode('utf-8')
        return hmac.new(self.preshared_key, message_bytes, hashlib.sha256).hexdigest()

    def sign(self, payload: Dict[str, Any], sequence_number: int) -> AuthenticatedPacket:
        """
        Signs a payload with HMAC-SHA256, adding timestamp and sequence number.
        """
        ts = time.time()
        sig = self._compute_digest(payload, ts, sequence_number)
        return AuthenticatedPacket(
            payload=payload,
            timestamp=ts,
            sequence_number=sequence_number,
            hmac_signature=sig,
        )

    def verify(
        self,
        packet: AuthenticatedPacket,
        max_clock_skew: float = 60.0,
        enforce_sequence: bool = False
    ) -> Dict[str, Any]:
        """
        Verifies packet signature, freshness, and sequence order.
        Raises AuthenticationError on failure.
        """
        # 1. Freshness check (replay mitigation)
        now = time.time()
        if abs(now - packet.timestamp) > max_clock_skew:
            raise AuthenticationError(
                f"Packet timestamp rejected (skew {abs(now - packet.timestamp):.1f}s exceeds {max_clock_skew}s)."
            )

        # 2. Sequence order check (optional anti-replay)
        if enforce_sequence and packet.sequence_number <= self.last_received_seq:
            raise AuthenticationError(
                f"Replay attack detected: sequence {packet.sequence_number} <= last seen {self.last_received_seq}."
            )

        # 3. Constant-time HMAC comparison
        expected_sig = self._compute_digest(packet.payload, packet.timestamp, packet.sequence_number)
        if not hmac.compare_digest(expected_sig, packet.hmac_signature):
            raise AuthenticationError(
                "CRITICAL SECURITY ALERT: HMAC-SHA256 authentication tag mismatch! "
                "Packet rejected: potential MITM spoofing or unauthorized alteration."
            )

        self.last_received_seq = packet.sequence_number
        return packet.payload
