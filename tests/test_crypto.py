"""
Unit Tests for Cryptographic Layer (AES-256-GCM)
================================================
"""

import os
import pytest
from crypto.aes_gcm import (
    AES256GCMCipher,
    EncryptedPayload,
    TamperDetectedError,
    derive_hkdf_key,
)


def test_aes_gcm_encryption_decryption_roundtrip():
    key = os.urandom(32)
    plaintext = b"ISO20022_INTERBANK_SETTLEMENT_PAYLOAD_TEST_42"
    payload = AES256GCMCipher.encrypt(plaintext, key)
    decrypted = AES256GCMCipher.decrypt(payload, key)
    assert decrypted == plaintext


def test_aes_gcm_wrong_key_fails():
    key1 = os.urandom(32)
    key2 = os.urandom(32)
    plaintext = b"SECRET_SETTLEMENT_DATA"
    payload = AES256GCMCipher.encrypt(plaintext, key1)
    
    with pytest.raises(TamperDetectedError):
        AES256GCMCipher.decrypt(payload, key2)


def test_aes_gcm_invalid_key_length():
    with pytest.raises(ValueError):
        AES256GCMCipher.encrypt(b"data", b"too_short_key")


def test_hkdf_key_derivation():
    ikm = b"quantum_shared_secret_entropy_12345"
    key1 = derive_hkdf_key(ikm)
    key2 = derive_hkdf_key(ikm)
    assert len(key1) == 32
    assert key1 == key2
