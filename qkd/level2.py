"""
Level 2 BB84 QKD Engine (Qiskit Circuit Backend)
================================================
Implements BB84 with single-qubit quantum circuits using Qiskit:
- Alice prepares states:
  - Bit 0, basis '+' -> |0⟩
  - Bit 1, basis '+' -> X|0⟩ = |1⟩
  - Bit 0, basis 'x' -> H|0⟩ = |+⟩
  - Bit 1, basis 'x' -> H(X|0⟩) = |-⟩
- Quantum Channel: Eve can apply intercept-measure-resend on the circuits.
- Bob measures:
  - Basis '+': standard computational Z-basis measurement.
  - Basis 'x': applies Hadamard gate H before Z-basis measurement (X-basis measurement).
"""

import secrets
from typing import List, Tuple, Optional, Any
from .level1 import Photon, QKDResult, calculate_qber

try:
    from qiskit import QuantumCircuit
    from qiskit_aer import AerSimulator
    QISKIT_AVAILABLE = True
except ImportError:
    try:
        from qiskit import QuantumCircuit
        from qiskit.primitives import Sampler
        QISKIT_AVAILABLE = True
    except ImportError:
        QISKIT_AVAILABLE = False


def create_alice_qubit_circuit(bit: int, basis: str) -> Any:
    """Creates a 1-qubit Qiskit quantum circuit encoding Alice's bit in the chosen basis."""
    if not QISKIT_AVAILABLE:
        raise RuntimeError("Qiskit is not installed in the environment.")
    
    qc = QuantumCircuit(1, 1)
    if bit == 1:
        qc.x(0)
    if basis == 'x':
        qc.h(0)
    return qc


def measure_qubit_circuit(circuit: Any, basis: str) -> int:
    """Measures a Qiskit quantum circuit in either rectilinear (+) or diagonal (x) basis."""
    if not QISKIT_AVAILABLE:
        raise RuntimeError("Qiskit is not installed in the environment.")

    qc = circuit.copy()
    if basis == 'x':
        qc.h(0)  # Rotate diagonal basis into computational basis
    qc.measure(0, 0)

    try:
        sim = AerSimulator()
        result = sim.run(qc, shots=1, memory=True).result()
        measured = int(result.get_memory()[0])
    except Exception:
        # Fallback simulation if Aer native binary is unavailable
        from qiskit.quantum_info import Statevector
        state = Statevector.from_instruction(qc.remove_final_measurements(inplace=False))
        measured = secrets.randbelow(2) if basis != '+' else int(abs(state.data[1])**2 > 0.5)

    return measured
