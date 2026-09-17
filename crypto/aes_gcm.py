"""
AES-256-GCM Authenticated Encryption & Tamper Detection Module
==============================================================
Provides high-performance authenticated symmetric encryption according to NIST SP 800-38D.

Key Properties:
- Confidentiality: 256-bit AES block cipher in Galois Counter Mode.
- Authenticity & Integrity: 128-bit authentication tag guarantees that any modification
  or corruption to ciphertext or associated data is immediately caught and rejected.
- Nonce Uniqueness: 96-bit (12-byte) cryptographically secure pseudorandom nonce per encryption.
"""

import os
import base64
from dataclasses import dataclass
from typing import Optional, Dict, Any
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes
from cryptography.exceptions import InvalidTag


class TamperDetectedError(Exception):
    """Raised when AES-GCM tag verification fails, indicating malicious tampering in transit."""
    pass


@dataclass
class EncryptedPayload:
    """Represents an encrypted transaction payload ready for transmission."""
    nonce_b64: str
    ciphertext_b64: str
    associated_data_b64: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "nonce": self.nonce_b64,
            "ciphertext": self.ciphertext_b64,
            "associated_data": self.associated_data_b64,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "EncryptedPayload":
        return cls(
            nonce_b64=data["nonce"],
            ciphertext_b64=data["ciphertext"],
            associated_data_b64=data.get("associated_data"),
        )


def derive_hkdf_key(ikm: bytes, salt: Optional[bytes] = None, info: bytes = b"fintech-qkd-settlement") -> bytes:
    """
    Derives a 256-bit symmetric key using HKDF-SHA256 (RFC 5869).
    Useful for privacy amplification or combining QKD + PQC secrets.
    """
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt or b"\x00" * 32,
        info=info,
    )
    return hkdf.derive(ikm)


class AES256GCMCipher:
    """
    AES-256-GCM authenticated cipher.
    """
    @staticmethod
    def encrypt(
        plaintext: bytes,
        key: bytes,
        associated_data: Optional[bytes] = None
    ) -> EncryptedPayload:
        """
        Encrypts plaintext bytes with AES-256-GCM using the provided 256-bit key.
        """
        if len(key) != 32:
            raise ValueError(f"AES-256 requires exactly 32-byte key (received {len(key)} bytes).")

        # Generate 12-byte (96-bit) fresh random nonce
        nonce = os.urandom(12)
        aesgcm = AESGCM(key)
        ciphertext = aesgcm.encrypt(nonce, plaintext, associated_data)

        return EncryptedPayload(
            nonce_b64=base64.b64encode(nonce).decode('utf-8'),
            ciphertext_b64=base64.b64encode(ciphertext).decode('utf-8'),
            associated_data_b64=base64.b64encode(associated_data).decode('utf-8') if associated_data else None,
        )

    @staticmethod
    def decrypt(
        payload: EncryptedPayload,
        key: bytes
    ) -> bytes:
        """
        Decrypts an AES-256-GCM payload.
        Raises TamperDetectedError if the authentication tag is invalid.
        """
        if len(key) != 32:
            raise ValueError(f"AES-256 requires exactly 32-byte key (received {len(key)} bytes).")

        nonce = base64.b64decode(payload.nonce_b64)
        ciphertext = base64.b64decode(payload.ciphertext_b64)
        associated_data = base64.b64decode(payload.associated_data_b64) if payload.associated_data_b64 else None

        aesgcm = AESGCM(key)
        try:
            plaintext = aesgcm.decrypt(nonce, ciphertext, associated_data)
            return plaintext
        except InvalidTag as exc:
            raise TamperDetectedError(
                "CRITICAL SECURITY ALERT: AES-256-GCM authentication tag verification failed! "
                "The ciphertext was modified or corrupted in transit."
            ) from exc
