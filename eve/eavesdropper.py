"""
Eavesdropper simulator implementing the quantum Intercept-and-Resend attack.

Theoretical Basis:
According to the Wootters-Zurek No-Cloning Theorem (1982), an arbitrary unknown
quantum state cannot be duplicated identically. Therefore, an eavesdropper (Eve)
cannot passively copy Alice's photons.

In an Intercept-and-Resend attack:
1. Eve intercepts Alice's photon.
2. Because Eve cannot know Alice's basis in advance, Eve guesses a basis uniformly at random (50% chance of + or x).
3. If Eve guesses correctly (50% probability):
   - Eve measures the true bit value.
   - Eve resends a photon in Alice's basis with the true bit.
   - Bob suffers 0% error when measuring in Alice's basis.
4. If Eve guesses incorrectly (50% probability):
   - Eve measures in the wrong basis, collapsing the state into an orthogonal basis.
   - Eve gets a random bit (50% 0 / 50% 1).
   - Eve resends in her wrong basis.
   - When Bob subsequently measures in Alice's basis, he measures in a basis conjugate to Eve's resent photon,
     yielding a 50% chance of reading an incorrect bit!
5. Overall Expected QBER:
   P(Error | Alice & Bob basis match) = P(Eve wrong basis) * P(Bob error | Eve wrong basis)
                                      = (1/2) * (1/2) = 1/4 = 25% (for 100% interception rate).
   For arbitrary interception rate p:
   Expected QBER = p * 0.25.
"""

from dataclasses import dataclass, field
import random
from typing import List, Tuple

from qkd.protocol import Basis, Photon


@dataclass
class EveStats:
    """
    Statistics collected by Eve during an eavesdropping attack.
    """
    total_photons: int = 0
    intercepted_count: int = 0
    interception_rate: float = 1.0
    eve_bases: List[Basis] = field(default_factory=list)
    eve_measured_bits: List[int] = field(default_factory=list)


class Eavesdropper:
    """
    Simulates an active eavesdropper (Eve) performing an intercept-and-resend attack.
    """

    def __init__(self, interception_rate: float = 1.0, name: str = "Eve"):
        """
        Initialize the eavesdropper.
        
        Args:
            interception_rate: Probability (0.0 to 1.0) of intercepting each photon.
                               1.0 = full interception (expected QBER ~25%).
                               0.5 = partial interception (expected QBER ~12.5%).
                               0.0 = passive / off.
            name: Identifier for logs and reporting.
        """
        if not (0.0 <= interception_rate <= 1.0):
            raise ValueError("interception_rate must be between 0.0 and 1.0.")
        self.interception_rate = interception_rate
        self.name = name
        self.last_stats = EveStats()

    def intercept_and_resend_classical(self, photons: List[Photon]) -> List[Photon]:
        """
        Intercept and resend photons in Level 1 (Classical Logic) simulation.
        
        Args:
            photons: Stream of photons emitted by Alice.
            
        Returns:
            Stream of photons reaching Bob after Eve's interception and measurement.
        """
        self.last_stats = EveStats(
            total_photons=len(photons),
            interception_rate=self.interception_rate,
        )
        
        if self.interception_rate == 0.0:
            return list(photons)

        bases_pool = [Basis.RECTILINEAR, Basis.DIAGONAL]
        output_photons: List[Photon] = []

        for photon in photons:
            # Decide whether to intercept based on interception_rate
            if random.random() < self.interception_rate:
                self.last_stats.intercepted_count += 1
                
                # Eve chooses a random measurement basis
                eve_basis = random.choice(bases_pool)
                self.last_stats.eve_bases.append(eve_basis)

                # Eve measures the photon
                if eve_basis == photon.basis:
                    # Bases match: deterministic measurement of Alice's bit
                    measured_bit = photon.bit
                else:
                    # Incompatible basis: wavefunction collapses randomly
                    measured_bit = random.randint(0, 1)

                self.last_stats.eve_measured_bits.append(measured_bit)

                # Eve prepares a brand new photon in HER basis with HER measured bit
                # (She cannot clone the original photon due to the No-Cloning Theorem)
                resent_photon = Photon(bit=measured_bit, basis=eve_basis)
                output_photons.append(resent_photon)
            else:
                # Photon passes undisturbed
                output_photons.append(photon)

        return output_photons
