"""
Unit Tests for PQC Kyber / ML-KEM Hybrid Layer
==============================================
"""

import pytest
from pqc.kyber_hybrid import PQCKyberKEM, HybridKeyCombiner


def test_kyber_kem_keypair_and_encapsulation():
    kp = PQCKyberKEM.generate_keypair()
    assert len(kp.public_key) == 32
    assert len(kp.private_key) == 32
    
    bundle = PQCKyberKEM.encapsulate(kp.public_key)
    assert len(bundle.shared_secret) == 32
    assert len(bundle.ciphertext) == 64
    
    decapped_ss = PQCKyberKEM.decapsulate(bundle.ciphertext, kp.private_key, kp.public_key)
    assert decapped_ss == bundle.shared_secret


def test_hybrid_key_combiner():
    qkd_key = b"\x01" * 32
    pqc_ss = b"\x02" * 32
    
    session_key_1 = HybridKeyCombiner.combine_keys(qkd_key, pqc_ss)
    session_key_2 = HybridKeyCombiner.combine_keys(qkd_key, pqc_ss)
    
    assert len(session_key_1) == 32
    assert session_key_1 == session_key_2
    
    # Different input yields different session key
    session_key_3 = HybridKeyCombiner.combine_keys(qkd_key, b"\x03" * 32)
    assert session_key_1 != session_key_3
