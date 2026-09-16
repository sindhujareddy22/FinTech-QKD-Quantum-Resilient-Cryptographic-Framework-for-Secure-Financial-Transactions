"""
Level 1: Classical-Logic Simulation of the BB84 Quantum Key Distribution Protocol.

This module models the fundamental physical principles of BB84 using classical
probability and state-space mechanics:
1. Preparation of single photons in one of two conjugate bases:
   - Rectilinear (+) {|0⟩, |1⟩} -> Horizontal (0) / Vertical (1)
   - Diagonal (x) {|+⟩, |-⟩} -> +45° (0) / -45° (1)
2. Conjugate Coding & Heisenberg Uncertainty Principle:
   Measuring a quantum state in an incompatible conjugate basis irreversibly
   destroys the original state and yields a completely random measurement outcome
   (50% probability of |0⟩ or |1⟩).
3. No-Cloning Theorem:
   An eavesdropper (Eve) cannot clone unknown quantum states without measurement.
   Any measurement by Eve in an incorrect basis introduces state collapse, which
   injects detectable errors (~25% QBER for full interception) into the sifted key.
"""

import random
from typing import Callable, List, Optional, Tuple

from qkd.protocol import Basis, Photon, QKDResult, privacy_amplification


class ClassicalBB84:
    """
    Classical probabilistic simulator for the BB84 protocol.
    """

    def __init__(
        self,
        num_bits: int = 512,
        sample_ratio: float = 0.20,
        abort_threshold: float = 0.11,
    ):
        """
        Initialize BB84 configuration.
        
        Args:
            num_bits: Number of raw quantum bits (photons) Alice sends.
            sample_ratio: Fraction of sifted bits sacrificed to calculate QBER.
            abort_threshold: Maximum allowable Quantum Bit Error Rate (QBER)
                             before aborting the protocol (theoretical BB84 limit ~11%).
        """
        if num_bits < 64:
            raise ValueError("num_bits must be at least 64 to ensure sufficient sifted key length.")
        if not (0.0 < sample_ratio < 0.5):
            raise ValueError("sample_ratio must be between 0 and 0.5.")
            
        self.num_bits = num_bits
        self.sample_ratio = sample_ratio
        self.abort_threshold = abort_threshold

    def _generate_alice_states(self) -> Tuple[List[int], List[Basis], List[Photon]]:
        """
        Step 1: Alice generates random bits and random polarization bases.
        Returns:
            alice_bits: Raw binary bits.
            alice_bases: Corresponding measurement bases (+ or x).
            photons: Transmitted quantum states.
        """
        bases_pool = [Basis.RECTILINEAR, Basis.DIAGONAL]
        alice_bits = [random.randint(0, 1) for _ in range(self.num_bits)]
        alice_bases = [random.choice(bases_pool) for _ in range(self.num_bits)]
        photons = [Photon(bit=b, basis=bas) for b, bas in zip(alice_bits, alice_bases)]
        return alice_bits, alice_bases, photons

    def _simulate_bob_measurement(self, photon: Photon, bob_basis: Basis) -> int:
        """
        Step 3: Bob measures an incoming photon using his chosen basis.
        
        Quantum Mechanics Rule:
        - If Bob's basis matches the photon's current basis:
          The photon is in an eigenstate of the measurement operator, so Bob
          deterministically measures the exact bit encoded.
        - If Bob's basis differs:
          The photon is in an equal superposition of Bob's basis eigenstates
          (|+⟩ = (|0⟩ + |1⟩)/√2). Measurement causes wavefunction collapse,
          yielding 0 or 1 each with 50% probability.
        """
        if bob_basis == photon.basis:
            return photon.bit
        else:
            return random.randint(0, 1)

    def run(
        self,
        eavesdropper_fn: Optional[Callable[[List[Photon]], List[Photon]]] = None,
    ) -> QKDResult:
        """
        Execute the complete BB84 protocol workflow.
        
        Args:
            eavesdropper_fn: Optional intercept-and-resend channel interceptor (Eve).
            
        Returns:
            QKDResult containing detailed statistics, QBER, and derived AES key (if secure).
        """
        # 1. Alice prepares photons
        alice_bits, alice_bases, photons = self._generate_alice_states()

        # 2. Quantum Transmission (with potential Eve interception)
        if eavesdropper_fn is not None:
            transmitted_photons = eavesdropper_fn(photons)
        else:
            transmitted_photons = photons

        # 3. Bob chooses random measurement bases and measures incoming photons
        bases_pool = [Basis.RECTILINEAR, Basis.DIAGONAL]
        bob_bases = [random.choice(bases_pool) for _ in range(self.num_bits)]
        bob_measured_bits = [
            self._simulate_bob_measurement(photon, basis)
            for photon, basis in zip(transmitted_photons, bob_bases)
        ]

        # 4. Sifting (Basis Reconciliation over classical channel)
        # Alice and Bob announce their chosen bases (NOT the bit values!).
        # They keep only the bits where their bases matched (~50% of raw bits).
        sifted_indices: List[int] = []
        alice_sifted: List[int] = []
        bob_sifted: List[int] = []

        for idx in range(self.num_bits):
            if alice_bases[idx] == bob_bases[idx]:
                sifted_indices.append(idx)
                alice_sifted.append(alice_bits[idx])
                bob_sifted.append(bob_measured_bits[idx])

        # 5. QBER (Quantum Bit Error Rate) Estimation via Public Sampling
        # Alice and Bob randomly select a subset of the sifted key to compare publicly.
        sifted_len = len(sifted_indices)
        sample_size = max(1, int(sifted_len * self.sample_ratio))
        
        # Sample random indices from the sifted set
        sample_relative_indices = sorted(random.sample(range(sifted_len), sample_size))
        sample_indices = [sifted_indices[i] for i in sample_relative_indices]

        sample_alice_bits = [alice_sifted[i] for i in sample_relative_indices]
        sample_bob_bits = [bob_sifted[i] for i in sample_relative_indices]

        # Count mismatches in the public sample
        sample_errors = sum(
            1 for a_bit, b_bit in zip(sample_alice_bits, sample_bob_bits) if a_bit != b_bit
        )
        qber = sample_errors / sample_size if sample_size > 0 else 0.0

        # Discard the revealed sample bits from the final key to preserve security
        sample_set = set(sample_relative_indices)
        final_alice_bits = [alice_sifted[i] for i in range(sifted_len) if i not in sample_set]
        final_bob_bits = [bob_sifted[i] for i in range(sifted_len) if i not in sample_set]

        # 6. Eavesdropping Detection & Abort Check
        is_aborted = False
        abort_reason = None
        final_aes_key: Optional[bytes] = None

        if qber > self.abort_threshold:
            is_aborted = True
            abort_reason = (
                f"QBER of {qber:.2%} exceeds maximum security threshold of "
                f"{self.abort_threshold:.2%}. Eavesdropping detected on quantum channel."
            )
        elif len(final_alice_bits) < 32:
            is_aborted = True
            abort_reason = (
                f"Insufficient remaining sifted bits ({len(final_alice_bits)} bits) "
                f"after public sampling to derive a high-entropy key."
            )
        else:
            # 7. Privacy Amplification: Hash the reconciled sifted bits into a 256-bit AES key
            final_aes_key = privacy_amplification(final_alice_bits)

        return QKDResult(
            raw_bit_count=self.num_bits,
            alice_raw_bits=alice_bits,
            alice_bases=alice_bases,
            bob_bases=bob_bases,
            bob_measured_bits=bob_measured_bits,
            sifted_indices=sifted_indices,
            alice_sifted_key=alice_sifted,
            bob_sifted_key=bob_sifted,
            sample_indices=sample_indices,
            sample_alice_bits=sample_alice_bits,
            sample_bob_bits=sample_bob_bits,
            sample_errors=sample_errors,
            qber=qber,
            abort_threshold=self.abort_threshold,
            is_aborted=is_aborted,
            abort_reason=abort_reason,
            final_sifted_bits=final_alice_bits,
            final_aes_key=final_aes_key,
            simulation_level="Level 1 (Classical Logic)",
        )
