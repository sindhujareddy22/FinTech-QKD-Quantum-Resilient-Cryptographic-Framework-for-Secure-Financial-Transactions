"""
Integration Tests for the FinTech QKD Settlement Pipeline
=========================================================
Tests:
1. Normal clean settlement round (QKD low QBER, PQC hybrid, AES-GCM, HMAC verification, JSON integrity).
2. Quantum eavesdropper detection (Eve active -> QBER ~25% >= 11% -> round aborted, zero payload leaked).
3. Ciphertext tampering detection (AES-GCM tag verification failure).
4. Classical MITM rejection (Invalid HMAC pre-shared key).
5. Continuous re-keying validation (two consecutive settlements produce strictly unique keys).
"""

import json
import pytest
from config import CONFIG
from qkd.level1 import run_bb84_exchange
from eve.interceptor import Eavesdropper
from crypto.aes_gcm import AES256GCMCipher, EncryptedPayload, TamperDetectedError
from pqc.kyber_hybrid import PQCKyberKEM, HybridKeyCombiner
from auth.hmac_auth import HMACAuthenticator, AuthenticationError
from transactions.generator import generate_synthetic_settlement_batch


def test_clean_settlement_round():
    """Verifies that a clean round successfully exchanges keys and decrypts ISO 20022 batches."""
    batch = generate_synthetic_settlement_batch(min_txns=3, max_txns=5)
    batch_json = json.dumps(batch.to_dict()).encode('utf-8')

    # 1. QKD Exchange
    qkd_res, alice_qkd, bob_qkd = run_bb84_exchange(
        num_photons=CONFIG.PHOTONS_PER_ROUND,
        qber_threshold=CONFIG.QBER_ABORT_THRESHOLD
    )
    assert qkd_res.success is True
    assert qkd_res.qber < CONFIG.QBER_ABORT_THRESHOLD
    assert alice_qkd == bob_qkd
    assert len(alice_qkd) == 32

    # 2. PQC Hybrid Layer
    bob_keypair = PQCKyberKEM.generate_keypair()
    pqc_bundle = PQCKyberKEM.encapsulate(bob_keypair.public_key)
    bob_pqc_ss = PQCKyberKEM.decapsulate(
        pqc_bundle.ciphertext,
        bob_keypair.private_key,
        bob_keypair.public_key
    )
    assert pqc_bundle.shared_secret == bob_pqc_ss

    session_key_alice = HybridKeyCombiner.combine_keys(alice_qkd, pqc_bundle.shared_secret)
    session_key_bob = HybridKeyCombiner.combine_keys(bob_qkd, bob_pqc_ss)
    assert session_key_alice == session_key_bob

    # 3. AES-256-GCM Encryption
    enc_payload = AES256GCMCipher.encrypt(batch_json, session_key_alice)

    # 4. HMAC Authentication
    alice_auth = HMACAuthenticator(CONFIG.HMAC_PRESHARED_SECRET)
    bob_auth = HMACAuthenticator(CONFIG.HMAC_PRESHARED_SECRET)
    packet = alice_auth.sign(enc_payload.to_dict(), sequence_number=1)

    # 5. Receiver Verification and Decryption
    verified_dict = bob_auth.verify(packet)
    decrypted_bytes = AES256GCMCipher.decrypt(
        EncryptedPayload.from_dict(verified_dict),
        session_key_bob
    )
    decrypted_batch = json.loads(decrypted_bytes.decode('utf-8'))

    assert decrypted_batch["batch_id"] == batch.batch_id
    assert decrypted_batch["total_amount"] == round(batch.total_amount, 2)
    assert len(decrypted_batch["transactions"]) == len(batch.transactions)


def test_eavesdropper_detection_blocks_settlement():
    """Verifies that an eavesdropper on the quantum channel is caught before any data is sent."""
    eve = Eavesdropper(is_active=True)
    qkd_res, alice_qkd, bob_qkd = run_bb84_exchange(
        num_photons=CONFIG.PHOTONS_PER_ROUND,
        qber_threshold=CONFIG.QBER_ABORT_THRESHOLD,
        eve_interceptor=eve
    )
    assert qkd_res.success is False
    assert qkd_res.qber >= CONFIG.QBER_ABORT_THRESHOLD
    assert alice_qkd is None
    assert bob_qkd is None
    assert "exceeds safety threshold" in qkd_res.abort_reason


def test_tampered_ciphertext_rejection():
    """Verifies that AES-256-GCM authentication tag catches ciphertext modification."""
    batch = generate_synthetic_settlement_batch(min_txns=2, max_txns=3)
    batch_json = json.dumps(batch.to_dict()).encode('utf-8')
    
    key = b"\x42" * 32
    enc_payload = AES256GCMCipher.encrypt(batch_json, key)

    # Tamper payload
    eve = Eavesdropper(tamper_ciphertext=True)
    tampered_b64 = eve.tamper_b64_ciphertext(enc_payload.ciphertext_b64)
    tampered_payload = EncryptedPayload(
        nonce_b64=enc_payload.nonce_b64,
        ciphertext_b64=tampered_b64,
        associated_data_b64=enc_payload.associated_data_b64
    )

    with pytest.raises(TamperDetectedError):
        AES256GCMCipher.decrypt(tampered_payload, key)


def test_mitm_hmac_spoofing_rejected():
    """Verifies that an unauthorized party with wrong PSK cannot forge packets."""
    payload = {"data": "test_settlement"}
    attacker_auth = HMACAuthenticator(b"WRONG_ATTACKER_KEY_123456789")
    forged_packet = attacker_auth.sign(payload, sequence_number=1)

    receiver_auth = HMACAuthenticator(CONFIG.HMAC_PRESHARED_SECRET)
    with pytest.raises(AuthenticationError):
        receiver_auth.verify(forged_packet)


def test_per_settlement_rekeying_uniqueness():
    """Verifies that consecutive settlements derive strictly distinct session keys."""
    keys = []
    for _ in range(5):
        res, k_alice, k_bob = run_bb84_exchange(
            num_photons=CONFIG.PHOTONS_PER_ROUND,
            qber_threshold=CONFIG.QBER_ABORT_THRESHOLD
        )
        assert res.success is True
        keys.append(k_alice)

    # All 5 keys must be unique
    assert len(set(keys)) == 5
