"""
Unit Tests for QKD BB84 Engine & Photon Simulation
==================================================
"""

import pytest
from qkd.level1 import (
    BB84Alice,
    BB84Bob,
    Photon,
    calculate_qber,
    run_bb84_exchange,
    EavesdropDetectedError,
)
from eve.interceptor import Eavesdropper


def test_bb84_alice_photon_preparation():
    alice = BB84Alice(num_photons=100)
    photons = alice.prepare_photons()
    assert len(photons) == 100
    assert len(alice.bits) == 100
    assert len(alice.bases) == 100
    assert all(p.bit in (0, 1) for p in photons)
    assert all(p.basis in ('+', 'x') for p in photons)


def test_bb84_bob_measurement():
    bob = BB84Bob(num_photons=100)
    # Prepare deterministic photons in rectilinear basis
    photons = [Photon(bit=1, basis='+') for _ in range(50)]
    bob.bases = ['+'] * 50
    measured = bob.measure_photons(photons)
    assert measured == [1] * 50


def test_bb84_sifting_fraction():
    alice = BB84Alice(num_photons=1000)
    bob = BB84Bob(num_photons=1000)
    
    photons = alice.prepare_photons()
    bob.choose_bases(1000)
    bob.measure_photons(photons)
    
    sifted = alice.sift_bases(bob.bases)
    # Sifted basis matching should be close to 50% (between 40% and 60%)
    fraction = len(sifted) / 1000.0
    assert 0.40 <= fraction <= 0.60


def test_qber_calculation():
    alice_sample = [0, 1, 1, 0, 1, 0, 0, 1, 1, 0]
    bob_sample   = [0, 1, 0, 0, 1, 1, 0, 1, 1, 0]  # 2 errors (index 2 and 5)
    qber, errors = calculate_qber(alice_sample, bob_sample)
    assert errors == 2
    assert qber == 0.20


def test_eve_error_injection_rate():
    """Eve intercept-measure-resend injects ~25% error rate on sifted bits."""
    total_samples = 0
    total_errors = 0
    eve = Eavesdropper(is_active=True)

    for _ in range(10):
        res, _, _ = run_bb84_exchange(num_photons=1000, qber_threshold=0.50, eve_interceptor=eve)
        total_samples += res.sampled_bits_count
        total_errors += res.errors_detected

    overall_qber = total_errors / total_samples
    # Theoretical expectation is 25% (tolerance: 20% to 30% over 10 rounds)
    assert 0.20 <= overall_qber <= 0.30
