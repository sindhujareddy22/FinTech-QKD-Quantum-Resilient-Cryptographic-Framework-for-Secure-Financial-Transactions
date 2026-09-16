"""
Level 2: Real Quantum Circuit Simulation of BB84 using Qiskit.

This module implements BB84 key distribution using genuine quantum circuit primitives:
- State Preparation:
  * Bit 0, Rectilinear (+) -> |0⟩ (Ground state)
  * Bit 1, Rectilinear (+) -> X|0⟩ = |1⟩ (Pauli-X NOT gate)
  * Bit 0, Diagonal (x)    -> H|0⟩ = |+⟩ = (|0⟩ + |1⟩)/√2 (Hadamard gate)
  * Bit 1, Diagonal (x)    -> H(X|0⟩) = |-⟩ = (|0⟩ - |1⟩)/√2
- Measurement:
  * Rectilinear (+) basis -> Direct computational Z-measurement (|0⟩ / |1⟩)
  * Diagonal (x) basis    -> Apply H gate before measurement to rotate X-basis into Z-basis:
    H|+⟩ = |0⟩, H|-⟩ = |1⟩.
- Quantum Interception (Eve):
  * Eve applies H gate (if measuring in X basis), measures qubit, and uses the resulting
    classical bit to prepare a new physical quantum state for Bob (demonstrating the
    quantum no-cloning constraint).
"""

from typing import TYPE_CHECKING, List, Optional, Tuple
import random

from qiskit import QuantumCircuit
from qiskit.providers.basic_provider import BasicProvider

from qkd.protocol import Basis, QKDResult, privacy_amplification

if TYPE_CHECKING:
    from eve.eavesdropper import Eavesdropper


class QiskitBB84:
    """
    Qiskit-based Quantum Circuit Simulator for the BB84 Protocol.
    """

    def __init__(
        self,
        num_bits: int = 512,
        sample_ratio: float = 0.20,
        abort_threshold: float = 0.11,
    ):
        """
        Initialize Qiskit BB84 configuration.
        
        Args:
            num_bits: Number of quantum bits to exchange.
            sample_ratio: Fraction of sifted bits for public QBER estimation.
            abort_threshold: Error threshold for eavesdropping detection (~11%).
        """
        if num_bits < 64:
            raise ValueError("num_bits must be at least 64.")
        if not (0.0 < sample_ratio < 0.5):
            raise ValueError("sample_ratio must be between 0 and 0.5.")

        self.num_bits = num_bits
        self.sample_ratio = sample_ratio
        self.abort_threshold = abort_threshold
        self._backend = BasicProvider().get_backend("basic_simulator")

    def _encode_alice_circuit(self, bit: int, basis: Basis) -> QuantumCircuit:
        """
        Build the quantum circuit for Alice's photon preparation.
        """
        qc = QuantumCircuit(1, 1)
        # Apply X gate if bit is 1
        if bit == 1:
            qc.x(0)
        # Apply Hadamard gate if basis is diagonal
        if basis == Basis.DIAGONAL:
            qc.h(0)
        return qc

    def _apply_bob_measurement(self, qc: QuantumCircuit, basis: Basis) -> QuantumCircuit:
        """
        Apply Bob's measurement basis transformation and measure to classical register.
        """
        # If Bob measures in diagonal basis, rotate with Hadamard gate first
        if basis == Basis.DIAGONAL:
            qc.h(0)
        qc.measure(0, 0)
        return qc

    def _simulate_circuits_batch(self, circuits: List[QuantumCircuit]) -> List[int]:
        """
        Execute a batch of single-qubit quantum circuits on the Qiskit simulator.
        """
        job = self._backend.run(circuits, shots=1)
        result = job.result()
        measured_bits: List[int] = []
        for i in range(len(circuits)):
            counts = result.get_counts(i)
            measured_bit = int(list(counts.keys())[0])
            measured_bits.append(measured_bit)
        return measured_bits

    def run(
        self,
        eavesdropper: Optional["Eavesdropper"] = None,
    ) -> QKDResult:
        """
        Execute BB84 using Qiskit quantum circuits.
        
        Args:
            eavesdropper: Optional Eavesdropper instance simulating quantum interception.
            
        Returns:
            QKDResult with QBER statistics, key status, and derived AES-256 key.
        """
        bases_pool = [Basis.RECTILINEAR, Basis.DIAGONAL]

        # 1. Alice prepares random bits and bases
        alice_bits = [random.randint(0, 1) for _ in range(self.num_bits)]
        alice_bases = [random.choice(bases_pool) for _ in range(self.num_bits)]
        bob_bases = [random.choice(bases_pool) for _ in range(self.num_bits)]

        # 2. Quantum Transmission & Measurement with real Qiskit circuits
        if eavesdropper is not None and getattr(eavesdropper, "interception_rate", 0) > 0:
            # Eve intercepts: simulate Eve's measurement circuit first
            eve_bases: List[Basis] = []
            eve_measured_bits: List[int] = []
            eve_intercepted_indices: List[int] = []

            # Prepare circuits for Eve to measure
            eve_circuits_to_run: List[QuantumCircuit] = []
            for i in range(self.num_bits):
                if random.random() < eavesdropper.interception_rate:
                    eve_intercepted_indices.append(i)
                    e_basis = random.choice(bases_pool)
                    eve_bases.append(e_basis)
                    
                    qc_alice = self._encode_alice_circuit(alice_bits[i], alice_bases[i])
                    if e_basis == Basis.DIAGONAL:
                        qc_alice.h(0)
                    qc_alice.measure(0, 0)
                    eve_circuits_to_run.append(qc_alice)

            if eve_circuits_to_run:
                eve_measured_bits = self._simulate_circuits_batch(eve_circuits_to_run)

            # Eve prepares brand new states to forward to Bob
            intercept_map = {
                idx: (eve_measured_bits[k], eve_bases[k])
                for k, idx in enumerate(eve_intercepted_indices)
            }

            bob_circuits: List[QuantumCircuit] = []
            for i in range(self.num_bits):
                if i in intercept_map:
                    # Eve resent state
                    e_bit, e_basis = intercept_map[i]
                    qc_bob = self._encode_alice_circuit(e_bit, e_basis)
                else:
                    # Undisturbed Alice state
                    qc_bob = self._encode_alice_circuit(alice_bits[i], alice_bases[i])

                self._apply_bob_measurement(qc_bob, bob_bases[i])
                bob_circuits.append(qc_bob)
        else:
            # Clean channel: Alice -> Bob directly
            bob_circuits = []
            for i in range(self.num_bits):
                qc = self._encode_alice_circuit(alice_bits[i], alice_bases[i])
                self._apply_bob_measurement(qc, bob_bases[i])
                bob_circuits.append(qc)

        # Run Bob's measurements on the quantum simulator
        bob_measured_bits = self._simulate_circuits_batch(bob_circuits)

        # 3. Sifting (Basis reconciliation)
        sifted_indices: List[int] = []
        alice_sifted: List[int] = []
        bob_sifted: List[int] = []

        for idx in range(self.num_bits):
            if alice_bases[idx] == bob_bases[idx]:
                sifted_indices.append(idx)
                alice_sifted.append(alice_bits[idx])
                bob_sifted.append(bob_measured_bits[idx])

        # 4. Public Sampling & QBER Calculation
        sifted_len = len(sifted_indices)
        sample_size = max(1, int(sifted_len * self.sample_ratio))
        
        sample_relative_indices = sorted(random.sample(range(sifted_len), sample_size))
        sample_indices = [sifted_indices[i] for i in sample_relative_indices]

        sample_alice_bits = [alice_sifted[i] for i in sample_relative_indices]
        sample_bob_bits = [bob_sifted[i] for i in sample_relative_indices]

        sample_errors = sum(
            1 for a_bit, b_bit in zip(sample_alice_bits, sample_bob_bits) if a_bit != b_bit
        )
        qber = sample_errors / sample_size if sample_size > 0 else 0.0

        # Discard sampled bits
        sample_set = set(sample_relative_indices)
        final_alice_bits = [alice_sifted[i] for i in range(sifted_len) if i not in sample_set]

        # 5. Security & Abort Evaluation
        is_aborted = False
        abort_reason = None
        final_aes_key: Optional[bytes] = None

        if qber > self.abort_threshold:
            is_aborted = True
            abort_reason = (
                f"Qiskit Circuit QBER of {qber:.2%} exceeds threshold of {self.abort_threshold:.2%}. "
                f"Eavesdropping detected via quantum state disturbance."
            )
        elif len(final_alice_bits) < 32:
            is_aborted = True
            abort_reason = f"Insufficient key entropy ({len(final_alice_bits)} remaining bits)."
        else:
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
            simulation_level="Level 2 (Qiskit Circuit Simulation)",
        )
