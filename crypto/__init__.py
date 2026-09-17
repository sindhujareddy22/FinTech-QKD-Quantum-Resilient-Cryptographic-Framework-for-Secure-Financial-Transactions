"""
Crypto Package: Authenticated AES-256-GCM Ciphers
=================================================
Provides military/banking-grade authenticated encryption with tamper detection.
"""

from .aes_gcm import (
    AES256GCMCipher,
    EncryptedPayload,
    TamperDetectedError,
    derive_hkdf_key,
)

__all__ = [
    "AES256GCMCipher",
    "EncryptedPayload",
    "TamperDetectedError",
    "derive_hkdf_key",
]
