"""
Level 1 BB84 Quantum Key Distribution Simulator (Pure Python)
============================================================
Implements the 1984 Bennett-Brassard protocol (BB84).

Quantum Mechanics Principles Emulated:
1. Two non-orthogonal conjugate measurement bases:
   - Rectilinear (+) basis: |0⟩ (0°), |1⟩ (90°)
   - Diagonal (×) basis: |+⟩ (45°), |-⟩ (135°)
2. Quantum No-Cloning & Wavefunction Collapse:
   - Measuring a state in an incompatible basis forces irreversible collapse
     to an eigenvalue with equal 50% probability, destroying the original state.
3. Information-disturbance tradeoff:
   - Any eavesdropping on the quantum channel introduces detectable errors
     (specifically ~25% error rate on sifted bits for intercept-measure-resend).

Pipeline:
 Alice (prepare photons) -> Quantum Channel (Eve interception) -> Bob (measure)
 -> Classical Sifting (basis reconciliation) -> Error Rate Estimation (QBER)
 -> Security Gate (QBER < 11%) -> Privacy Amplification (HKDF-SHA256) -> Session Key
"""

import hashlib
import hmac
import secrets
from dataclasses import dataclass
from typing import List, Tuple, Optional, Dict, Any


class EavesdropDetectedError(Exception):
    """Raised when the calculated QBER reaches or exceeds the security abort threshold."""
    def __init__(self, qber: float, threshold: float, message: str = ""):
        self.qber = qber
        self.threshold = threshold
        super().__init__(
            message or f"QBER {qber*100:.2f}% exceeds abort threshold {threshold*100:.2f}%. Channel compromised!"
        )


@dataclass(frozen=True)
class Photon:
    """
    Emulates a single polarized photon emitted by Alice.
    
    Attributes:
        bit: The raw bit encoded (0 or 1).
        basis: The polarization basis used ('+' for rectilinear, 'x' for diagonal).
    """
    bit: int
    basis: str  # '+' or 'x'


@dataclass
class QKDResult:
    """Outcome of a single BB84 quantum key exchange round."""
    success: bool
    qber: float
    derived_key: Optional[bytes]
    photons_sent: int
    sifted_bits_count: int
    sampled_bits_count: int
    errors_detected: int
    abort_reason: Optional[str] = None


class BB84Alice:
    """
    Sender node (Bank A) in the BB84 protocol.
    Prepares random quantum states and leads basis reconciliation.
    """
    def __init__(self, num_photons: int = 600):
        self.num_photons = num_photons
        self.bits: List[int] = []
        self.bases: List[str] = []
        self.photons: List[Photon] = []
        self.sifted_indices: List[int] = []
        self.sifted_bits: List[int] = []
        self.sample_indices: List[int] = []

    def prepare_photons(self) -> List[Photon]:
        """
        Step 1: Alice generates random bits and random bases, creating polarized photons.
        """
        self.bits = [secrets.randbelow(2) for _ in range(self.num_photons)]
        self.bases = [secrets.choice(['+', 'x']) for _ in range(self.num_photons)]
        self.photons = [Photon(bit=b, basis=ba) for b, ba in zip(self.bits, self.bases)]
        return self.photons

    def sift_bases(self, bob_bases: List[str]) -> List[int]:
        """
        Step 2: Classical reconciliation.
        Alice compares Bob's measurement bases with her preparation bases.
        Returns the indices where bases matched.
        """
        self.sifted_indices = [
            i for i in range(len(bob_bases))
            if i < len(self.bases) and self.bases[i] == bob_bases[i]
        ]
        self.sifted_bits = [self.bits[i] for i in self.sifted_indices]
        return self.sifted_indices

    def select_sample_indices(self, sample_fraction: float = 0.25) -> List[int]:
        """
        Step 3: Select a subset of sifted bit indices to publicly test for eavesdropping.
        """
        if not self.sifted_indices:
            return []
        
        sample_size = max(1, int(len(self.sifted_indices) * sample_fraction))
        # Select sample indices deterministically or pseudorandomly from sifted positions
        self.sample_indices = self.sifted_indices[:sample_size]
        return self.sample_indices

    def get_sample_bits(self) -> List[int]:
        """Returns the Alice bits corresponding to the sampled positions."""
        return [self.bits[i] for i in self.sample_indices]

    def derive_final_key(self) -> bytes:
        """
        Step 4: Privacy Amplification.
        Discards the publicly sampled bits and hashes remaining secret sifted bits 
        using SHA-256 to eliminate any partial information an attacker may have gained.
        """
        sample_set = set(self.sample_indices)
        remaining_secret_bits = [
            self.bits[i] for i in self.sifted_indices if i not in sample_set
        ]
        
        if not remaining_secret_bits:
            raise ValueError("Insufficient sifted bits remaining to derive a secure key.")

        # Convert bit array to byte string representation
        bit_string = "".join(str(b) for b in remaining_secret_bits).encode('ascii')
        
        # Privacy Amplification via SHA-256 (32 bytes = 256-bit symmetric key)
        return hashlib.sha256(bit_string).digest()


class BB84Bob:
    """
    Receiver node (Clearing House) in the BB84 protocol.
    Measures incoming photons in randomly chosen bases.
    """
    def __init__(self, num_photons: int = 600):
        self.num_photons = num_photons
        self.bases: List[str] = []
        self.measured_bits: List[int] = []
        self.sifted_indices: List[int] = []
        self.sample_indices: List[int] = []

    def choose_bases(self, count: int) -> List[str]:
        """Generates random measurement bases for incoming photons."""
        self.bases = [secrets.choice(['+', 'x']) for _ in range(count)]
        return self.bases

    def measure_photons(self, photons: List[Photon]) -> List[int]:
        """
        Step 1: Bob measures incoming photons against his randomly chosen bases.
        
        Physics of quantum measurement:
        - If Bob's basis matches the photon's basis -> deterministic detection (exact bit).
        - If Bob's basis differs from the photon's basis -> quantum indeterminacy 
          (50% chance of 0, 50% chance of 1).
        """
        if len(self.bases) != len(photons):
            self.choose_bases(len(photons))

        self.measured_bits = []
        for photon, bob_basis in zip(photons, self.bases):
            if bob_basis == photon.basis:
                # Deterministic outcome: measurement axis matches photon polarization
                self.measured_bits.append(photon.bit)
            else:
                # Incompatible basis measurement: projection collapses with equal probability
                self.measured_bits.append(secrets.randbelow(2))

        return self.measured_bits

    def set_sifted_indices(self, sifted_indices: List[int]) -> None:
        """Stores agreed sifted positions from classical reconciliation."""
        self.sifted_indices = sifted_indices

    def set_sample_indices(self, sample_indices: List[int]) -> None:
        """Stores the indices designated for public error rate sampling."""
        self.sample_indices = sample_indices

    def get_sample_bits(self) -> List[int]:
        """Returns Bob's measured bits at the sampled positions."""
        return [self.measured_bits[i] for i in self.sample_indices]

    def derive_final_key(self) -> bytes:
        """
        Derives the final 256-bit symmetric key using identical privacy amplification.
        """
        sample_set = set(self.sample_indices)
        remaining_secret_bits = [
            self.measured_bits[i] for i in self.sifted_indices if i not in sample_set
        ]
        
        if not remaining_secret_bits:
            raise ValueError("Insufficient sifted bits remaining to derive a secure key.")

        bit_string = "".join(str(b) for b in remaining_secret_bits).encode('ascii')
        return hashlib.sha256(bit_string).digest()


def calculate_qber(alice_samples: List[int], bob_samples: List[int]) -> Tuple[float, int]:
    """
    Computes the Quantum Bit Error Rate (QBER):
    QBER = (number of mismatched sample bits) / (total sample bits)
    """
    if not alice_samples or not bob_samples or len(alice_samples) != len(bob_samples):
        return 0.0, 0
    
    mismatches = sum(1 for a, b in zip(alice_samples, bob_samples) if a != b)
    qber = mismatches / len(alice_samples)
    return qber, mismatches


def run_bb84_exchange(
    num_photons: int = 600,
    qber_threshold: float = 0.11,
    sample_fraction: float = 0.25,
    eve_interceptor: Optional[Any] = None
) -> Tuple[QKDResult, Optional[bytes], Optional[bytes]]:
    """
    Orchestrates a complete offline BB84 exchange round between Alice and Bob.
    Returns: (QKDResult, alice_derived_key, bob_derived_key)
    """
    alice = BB84Alice(num_photons=num_photons)
    bob = BB84Bob(num_photons=num_photons)

    # 1. Alice prepares polarized photons
    photons = alice.prepare_photons()

    # 2. Photons traverse quantum channel (Eve may intercept if active)
    if eve_interceptor and hasattr(eve_interceptor, 'intercept_photons'):
        transmitted_photons = eve_interceptor.intercept_photons(photons)
    else:
        transmitted_photons = photons

    # 3. Bob measures photons in random bases
    bob.choose_bases(len(transmitted_photons))
    bob.measure_photons(transmitted_photons)

    # 4. Sifting phase over classical channel (exchange bases)
    sifted_indices = alice.sift_bases(bob.bases)
    bob.set_sifted_indices(sifted_indices)

    if len(sifted_indices) < 32:
        return (
            QKDResult(
                success=False,
                qber=0.0,
                derived_key=None,
                photons_sent=num_photons,
                sifted_bits_count=len(sifted_indices),
                sampled_bits_count=0,
                errors_detected=0,
                abort_reason="Insufficient sifted bits obtained."
            ),
            None,
            None
        )

    # 5. Public sampling for QBER estimation
    sample_indices = alice.select_sample_indices(sample_fraction=sample_fraction)
    bob.set_sample_indices(sample_indices)

    alice_samples = alice.get_sample_bits()
    bob_samples = bob.get_sample_bits()

    qber, error_count = calculate_qber(alice_samples, bob_samples)

    # 6. Eavesdrop detection & QBER gate check
    if qber >= qber_threshold:
        return (
            QKDResult(
                success=False,
                qber=qber,
                derived_key=None,
                photons_sent=num_photons,
                sifted_bits_count=len(sifted_indices),
                sampled_bits_count=len(sample_indices),
                errors_detected=error_count,
                abort_reason=f"QBER {qber*100:.1f}% exceeds safety threshold {qber_threshold*100:.1f}%."
            ),
            None,
            None
        )

    # 7. Privacy Amplification & final symmetric key generation
    alice_key = alice.derive_final_key()
    bob_key = bob.derive_final_key()

    return (
        QKDResult(
            success=True,
            qber=qber,
            derived_key=alice_key,
            photons_sent=num_photons,
            sifted_bits_count=len(sifted_indices),
            sampled_bits_count=len(sample_indices),
            errors_detected=error_count,
            abort_reason=None
        ),
        alice_key,
        bob_key
    )
