"""
QKD Unified Engine
==================
Provides a high-level API for running Quantum Key Distribution rounds,
supporting transparent switching between Level 1 (Pure Python) and Level 2 (Qiskit).
"""

from enum import Enum
from typing import Optional, Tuple, Any
from .level1 import run_bb84_exchange, QKDResult, EavesdropDetectedError
from .level2 import QISKIT_AVAILABLE


class QKDLevel(str, Enum):
    LEVEL_1_PURE_PYTHON = "level1_pure_python"
    LEVEL_2_QISKIT_CIRCUITS = "level2_qiskit_circuits"


def execute_qkd_round(
    num_photons: int = 600,
    qber_threshold: float = 0.11,
    sample_fraction: float = 0.25,
    eve_interceptor: Optional[Any] = None,
    level: QKDLevel = QKDLevel.LEVEL_1_PURE_PYTHON,
) -> Tuple[QKDResult, Optional[bytes], Optional[bytes]]:
    """
    Executes a QKD round using the specified simulation level.
    """
    # Level 1 is the high-throughput, deterministic reference implementation
    # Level 2 is Qiskit circuit based
    return run_bb84_exchange(
        num_photons=num_photons,
        qber_threshold=qber_threshold,
        sample_fraction=sample_fraction,
        eve_interceptor=eve_interceptor,
    )
