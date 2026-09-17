"""
Eve Interceptor: Quantum & Classical Adversary Simulator
========================================================
Implements:
1. Intercept-Measure-Resend Quantum Eavesdropping (BB84 attack)
   - Eve intercepts Alice's photons in flight.
   - Eve measures each photon in a random basis (+ or x).
   - Eve creates a brand new photon in the measured state and forwards it to Bob.
   - Theoretical consequence: Injects an expected ~25% error rate on sifted bits,
     which Alice and Bob reliably catch during QBER sampling.
2. Classical Ciphertext Tampering Mode
   - Flips bytes in the AES-256-GCM encrypted payload to trigger authentication tag failure.
"""

import base64
import secrets
from typing import List, Optional
from qkd.level1 import Photon


class Eavesdropper:
    """
    Adversary simulating physical line interception and wiretapping.
    Can be dynamically toggled ON and OFF in real-time during live demonstrations.
    """
    def __init__(self, is_active: bool = False, tamper_ciphertext: bool = False):
        self.is_active = is_active
        self.tamper_ciphertext = tamper_ciphertext
        self.intercepted_count = 0
        self.tampered_count = 0

    def toggle_active(self, active: Optional[bool] = None) -> bool:
        """Toggles or sets the quantum eavesdropping status."""
        if active is None:
            self.is_active = not self.is_active
        else:
            self.is_active = active
        return self.is_active

    def toggle_tamper(self, tamper: Optional[bool] = None) -> bool:
        """Toggles or sets the classical ciphertext tampering status."""
        if tamper is None:
            self.tamper_ciphertext = not self.tamper_ciphertext
        else:
            self.tamper_ciphertext = tamper
        return self.tamper_ciphertext

    def intercept_photons(self, photons: List[Photon]) -> List[Photon]:
        """
        Intercepts photons traversing the quantum channel.
        If Eve is inactive, photons pass undisturbed.
        If active, Eve performs intercept-measure-resend.
        """
        if not self.is_active:
            return photons

        resent_photons: List[Photon] = []
        self.intercepted_count += len(photons)

        for p in photons:
            # Eve randomly guesses a measurement basis
            eve_basis = secrets.choice(['+', 'x'])
            
            if eve_basis == p.basis:
                # Eve happened to choose the right basis: measures true bit
                measured_bit = p.bit
            else:
                # Wrong basis: quantum collapse forces random 50/50 bit
                measured_bit = secrets.randbelow(2)
            
            # Eve resends a new photon in her measured state
            resent_photons.append(Photon(bit=measured_bit, basis=eve_basis))

        return resent_photons

    def tamper_payload_bytes(self, ciphertext_raw: bytes) -> bytes:
        """
        Alters raw ciphertext bytes in transit if tampering is enabled.
        Forces an authentication tag mismatch in AES-256-GCM.
        """
        if not self.tamper_ciphertext or not ciphertext_raw:
            return ciphertext_raw

        self.tampered_count += 1
        byte_arr = bytearray(ciphertext_raw)
        
        # Flip bits in the middle byte
        target_idx = len(byte_arr) // 2
        byte_arr[target_idx] ^= 0xFF
        
        return bytes(byte_arr)

    def tamper_b64_ciphertext(self, ciphertext_b64: str) -> str:
        """
        Decodes base64 ciphertext, flips bytes, and re-encodes to base64.
        """
        if not self.tamper_ciphertext or not ciphertext_b64:
            return ciphertext_b64
        
        raw = base64.b64decode(ciphertext_b64)
        tampered_raw = self.tamper_payload_bytes(raw)
        return base64.b64encode(tampered_raw).decode('utf-8')
