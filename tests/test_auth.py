"""
Unit Tests for HMAC Authentication & Anti-Replay Layer
======================================================
"""

import time
import pytest
from auth.hmac_auth import HMACAuthenticator, AuthenticationError, AuthenticatedPacket


def test_hmac_valid_signature():
    secret = b"FINTECH_SHARED_TEST_SECRET"
    auth = HMACAuthenticator(secret)
    payload = {"account": "BANK_A", "amount": 1000000}
    
    packet = auth.sign(payload, sequence_number=1)
    verified = auth.verify(packet)
    assert verified == payload


def test_hmac_tampered_payload_rejected():
    secret = b"FINTECH_SHARED_TEST_SECRET"
    auth = HMACAuthenticator(secret)
    packet = auth.sign({"action": "TRANSFER", "amount": 100}, sequence_number=1)
    
    # Tamper with payload content
    packet.payload["amount"] = 999999999
    with pytest.raises(AuthenticationError):
        auth.verify(packet)


def test_hmac_expired_timestamp_rejected():
    secret = b"FINTECH_SHARED_TEST_SECRET"
    auth = HMACAuthenticator(secret)
    packet = auth.sign({"status": "OK"}, sequence_number=1)
    
    # Simulate old timestamp (120 seconds old)
    packet.timestamp = time.time() - 120.0
    with pytest.raises(AuthenticationError):
        auth.verify(packet, max_clock_skew=10.0)


def test_hmac_anti_replay_sequence_enforcement():
    secret = b"FINTECH_SHARED_TEST_SECRET"
    auth = HMACAuthenticator(secret)
    
    p1 = auth.sign({"round": 1}, sequence_number=5)
    auth.verify(p1, enforce_sequence=True)
    
    p2_replayed = auth.sign({"round": 2}, sequence_number=3)  # Sequence lower than 5
    with pytest.raises(AuthenticationError):
        auth.verify(p2_replayed, enforce_sequence=True)
