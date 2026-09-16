"""
Authenticated Classical Channel Module for Quantum Key Distribution.

===============================================================================
CRITICAL CRYPTOGRAPHIC REASONING: WHY QKD REQUIRES AUTHENTICATION
===============================================================================
A common misconception is that QKD provides complete, standalone security.
In reality:
1. QKD provides information-theoretic confidentiality of key generation over the
   quantum channel (guaranteed by the laws of quantum mechanics and the No-Cloning Theorem).
2. HOWEVER, QKD CANNOT authenticate the identities of Alice and Bob.
3. If the classical discussion channel (used for basis announcement, sifting, and QBER estimation)
   is unauthenticated, an active attacker Eve can perform a standard Man-in-the-Middle (MITM) attack:
   - Eve pretends to be Bob when talking to Alice, establishing key K_AE.
   - Eve pretends to be Alice when talking to Bob, establishing key K_EB.
   - Neither Alice nor Bob detects Eve, and Eve can transparently decrypt, modify, and re-encrypt
     all subsequent financial transactions.

Solution in Practice:
- Alice and Bob use a small pre-shared authentication key (or Post-Quantum Digital Signature)
  with an Information-Theoretic Message Authentication Code (e.g., Carter-Wegman MAC or HMAC-SHA256).
- Because the QKD protocol generates vastly more secret key bits than the few bits consumed
  for authenticating the basis announcements, QKD acts as a "Quantum Key Expander / Grower".
===============================================================================
"""

from dataclasses import dataclass
import hashlib
import hmac
import json
import os
from typing import Any, Dict, Optional, Tuple


class ChannelAuthenticationError(Exception):
    """Raised when an unauthenticated or tampered classical message is received."""
    pass


@dataclass
class AuthenticatedMessage:
    """
    Message transmitted over the classical channel with an HMAC-SHA256 authentication tag.
    """
    sender: str
    recipient: str
    message_type: str
    payload: Dict[str, Any]
    hmac_tag: str

    def to_json(self) -> str:
        return json.dumps({
            "sender": self.sender,
            "recipient": self.recipient,
            "message_type": self.message_type,
            "payload": self.payload,
            "hmac_tag": self.hmac_tag,
        })


class AuthenticatedChannel:
    """
    Simulated classical channel protected by a Pre-Shared Key (PSK) and HMAC-SHA256.
    """

    def __init__(self, psk: Optional[bytes] = None):
        """
        Initialize the authenticated channel.
        
        Args:
            psk: 32-byte pre-shared secret key shared between Alice and Bob.
                 If not provided, a secure random key is generated.
        """
        self.psk = psk or os.urandom(32)

    def _compute_hmac(self, data_str: str) -> str:
        """
        Compute HMAC-SHA256 authentication tag for serialized message content.
        """
        mac = hmac.new(self.psk, data_str.encode("utf-8"), hashlib.sha256)
        return mac.hexdigest()

    def send(
        self,
        sender: str,
        recipient: str,
        message_type: str,
        payload: Dict[str, Any],
    ) -> AuthenticatedMessage:
        """
        Package and sign a message payload.
        """
        canonical_content = json.dumps({
            "sender": sender,
            "recipient": recipient,
            "message_type": message_type,
            "payload": payload,
        }, sort_keys=True)

        hmac_tag = self._compute_hmac(canonical_content)
        return AuthenticatedMessage(
            sender=sender,
            recipient=recipient,
            message_type=message_type,
            payload=payload,
            hmac_tag=hmac_tag,
        )

    def verify_and_receive(self, message: AuthenticatedMessage) -> Dict[str, Any]:
        """
        Verify the HMAC tag on a received message to prevent classical MITM attacks.
        
        Raises:
            ChannelAuthenticationError: If the HMAC signature does not match.
        """
        canonical_content = json.dumps({
            "sender": message.sender,
            "recipient": message.recipient,
            "message_type": message.message_type,
            "payload": message.payload,
        }, sort_keys=True)

        expected_tag = self._compute_hmac(canonical_content)
        
        # Constant-time comparison to prevent timing attacks
        if not hmac.compare_digest(message.hmac_tag, expected_tag):
            raise ChannelAuthenticationError(
                f"Classical Channel MITM Detected! Invalid HMAC from '{message.sender}'. "
                f"Message type '{message.message_type}' has been tampered with."
            )

        return message.payload
