"""
Core protocol definitions, data structures, and cryptographic primitives for QKD.
"""

from dataclasses import dataclass, field
from enum import Enum
import hashlib
from typing import List, Optional, Tuple


class Basis(Enum):
    """
    Measurement bases used in the BB84 Quantum Key Distribution protocol.
    - RECTILINEAR (+): Standard computational basis {|0⟩, |1⟩}
    - DIAGONAL (x): Hadamard basis {|+⟩, |-⟩}
    """
    RECTILINEAR = "+"  # Also known as Z-basis (horizontal/vertical polarization)
    DIAGONAL = "x"     # Also known as X-basis (45°/135° diagonal polarization)

    def __str__(self) -> str:
        return self.value


@dataclass
class Photon:
    """
    Representation of a single polarized photon or qubit in transit.
    
    Attributes:
        bit: The binary value (0 or 1) encoded in the photon.
        basis: The basis in which the photon was prepared.
    """
    bit: int
    basis: Basis


@dataclass
class QKDResult:
    """
    Result of an execution of the BB84 QKD protocol between Alice and Bob.
    """
    raw_bit_count: int
    alice_raw_bits: List[int]
    alice_bases: List[Basis]
    bob_bases: List[Basis]
    bob_measured_bits: List[int]
    
    sifted_indices: List[int]
    alice_sifted_key: List[int]
    bob_sifted_key: List[int]
    
    sample_indices: List[int]
    sample_alice_bits: List[int]
    sample_bob_bits: List[int]
    sample_errors: int
    
    qber: float
    abort_threshold: float
    is_aborted: bool
    abort_reason: Optional[str] = None
    
    final_sifted_bits: List[int] = field(default_factory=list)
    final_aes_key: Optional[bytes] = None  # 256-bit AES key after privacy amplification
    simulation_level: str = "Level 1 (Classical Logic)"


def privacy_amplification(remaining_bits: List[int]) -> bytes:
    """
    Perform Privacy Amplification and Key Derivation.
    
    Why this is needed:
    Even with QBER below the abort threshold, Eve might possess partial information
    about the sifted key (up to the Shannon mutual information limit).
    Privacy amplification compresses the sifted key into a shorter, uniformly
    distributed 256-bit cryptographic key using a universal hash function (SHA-256).
    This reduces Eve's potential information to an exponentially negligible fraction.
    
    Args:
        remaining_bits: Sifted bits that were NOT revealed during QBER estimation.
        
    Returns:
        32-byte (256-bit) shared secret key suitable for AES-256.
    """
    bit_string = "".join(str(b) for b in remaining_bits)
    # Use SHA-256 to hash the bit string into a 256-bit symmetric key
    return hashlib.sha256(bit_string.encode("utf-8")).digest()
