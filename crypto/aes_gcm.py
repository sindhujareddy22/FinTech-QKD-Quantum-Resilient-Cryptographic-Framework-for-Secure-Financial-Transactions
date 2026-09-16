"""
Cryptographic module for AES-256-GCM authenticated encryption and decryption.

Why AES-256-GCM?
- Post-Quantum Symmetric Security: Grover's algorithm provides a quadratic speedup
  for searching symmetric keys. AES-128 is reduced to 64-bit security (vulnerable),
  whereas AES-256 is reduced to 128-bit quantum security, which remains practically
  unbreakable by any known quantum or classical computer.
- Authenticated Encryption with Associated Data (AEAD):
  Galois/Counter Mode (GCM) provides both confidentiality (via CTR mode) and
  authenticity/integrity (via GMAC tag). Tampering with either the ciphertext
  or the associated header data will immediately fail tag validation.
"""

import base64
from dataclasses import dataclass
import json
import os
from typing import Optional, Tuple

try:
    from Crypto.Cipher import AES
except ImportError:
    from Cryptodome.Cipher import AES


class DecryptionError(Exception):
    """Raised when decryption or authentication tag validation fails."""
    pass


@dataclass
class EncryptedPayload:
    """
    Structured envelope containing AES-256-GCM encrypted payload and metadata.
    """
    nonce_b64: str
    ciphertext_b64: str
    tag_b64: str
    associated_data: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "nonce": self.nonce_b64,
            "ciphertext": self.ciphertext_b64,
            "tag": self.tag_b64,
            "associated_data": self.associated_data,
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=2)

    @classmethod
    def from_dict(cls, data: dict) -> "EncryptedPayload":
        return cls(
            nonce_b64=data["nonce"],
            ciphertext_b64=data["ciphertext"],
            tag_b64=data["tag"],
            associated_data=data.get("associated_data"),
        )


class AESGCMCipher:
    """
    AES-256-GCM cipher wrapper configured with a QKD-derived 256-bit symmetric key.
    """

    def __init__(self, key: bytes):
        """
        Initialize the cipher with a 256-bit (32-byte) key.
        
        Args:
            key: 32 bytes derived from QKD privacy amplification.
        """
        if not isinstance(key, bytes) or len(key) != 32:
            raise ValueError(
                f"AES-256 key must be exactly 32 bytes (256 bits). "
                f"Received {len(key) if isinstance(key, bytes) else type(key)}."
            )
        self._key = key

    def encrypt(self, plaintext: str, associated_data: Optional[str] = None) -> EncryptedPayload:
        """
        Encrypt a plaintext string using AES-256-GCM.
        
        Args:
            plaintext: Data to encrypt (e.g., JSON transaction string).
            associated_data: Optional unencrypted metadata to cryptographically authenticate.
            
        Returns:
            EncryptedPayload with base64-encoded nonce, ciphertext, and tag.
        """
        # Generate a fresh, cryptographically secure 96-bit (12-byte) nonce
        # (Recommended standard nonce size for AES-GCM)
        nonce = os.urandom(12)
        cipher = AES.new(self._key, AES.MODE_GCM, nonce=nonce)

        if associated_data:
            cipher.update(associated_data.encode("utf-8"))

        ciphertext, tag = cipher.encrypt_and_digest(plaintext.encode("utf-8"))

        return EncryptedPayload(
            nonce_b64=base64.b64encode(nonce).decode("ascii"),
            ciphertext_b64=base64.b64encode(ciphertext).decode("ascii"),
            tag_b64=base64.b64encode(tag).decode("ascii"),
            associated_data=associated_data,
        )

    def decrypt(self, payload: EncryptedPayload) -> str:
        """
        Decrypt an EncryptedPayload and verify its authentication tag.
        
        Args:
            payload: The EncryptedPayload containing ciphertext, nonce, and auth tag.
            
        Returns:
            Decrypted plaintext string.
            
        Raises:
            DecryptionError: If the tag is invalid or data has been tampered with.
        """
        try:
            nonce = base64.b64decode(payload.nonce_b64)
            ciphertext = base64.b64decode(payload.ciphertext_b64)
            tag = base64.b64decode(payload.tag_b64)

            cipher = AES.new(self._key, AES.MODE_GCM, nonce=nonce)
            if payload.associated_data:
                cipher.update(payload.associated_data.encode("utf-8"))

            decrypted_bytes = cipher.decrypt_and_verify(ciphertext, tag)
            return decrypted_bytes.decode("utf-8")
        except (ValueError, KeyError) as e:
            raise DecryptionError(
                f"AES-GCM integrity check failed: Data was tampered with or key is invalid. ({e})"
            ) from e
