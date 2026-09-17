"""
FinTech QKD: Central Configuration
==================================
Houses all network, cryptographic, and QKD protocol parameters.
Allows one-line parameter tweaks for deployment across physical LANs.
"""

from dataclasses import dataclass
import os

@dataclass(frozen=True)
class QKDConfig:
    # Photon pulses per settlement round (a few hundred ensures statistical stability)
    PHOTONS_PER_ROUND: int = 600
    
    # QBER threshold for aborting key exchange (typically ~11% theoretical limit for BB84)
    QBER_ABORT_THRESHOLD: float = 0.11
    
    # Fraction of sifted bits used for public error estimation
    SAMPLE_FRACTION: float = 0.25
    
    # Pre-shared symmetric key for classical channel HMAC-SHA256 authentication (MITM defense)
    HMAC_PRESHARED_SECRET: bytes = b"FINTECH_QKD_PRESHARED_AUTHENTICATION_KEY_2026_SECURE"
    
    # Default network settings
    BANK_DEFAULT_HOST: str = "127.0.0.1"
    BANK_DEFAULT_PORT: int = 8000
    
    CLEARING_DEFAULT_HOST: str = "0.0.0.0"
    CLEARING_DEFAULT_PORT: int = 8001
    
    # Post-Quantum Cryptography (ML-KEM / Kyber) hybrid toggle
    ENABLE_PQC_HYBRID: bool = True
    
    # Settlement auto-stream interval in seconds
    AUTO_STREAM_INTERVAL: float = 3.5

# Global default config instance
CONFIG = QKDConfig()
