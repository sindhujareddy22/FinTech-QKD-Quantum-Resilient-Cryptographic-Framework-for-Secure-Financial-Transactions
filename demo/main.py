"""
End-to-end Demonstration Runner for FinTech QKD.

Executes both Clean (Honest Channel) and Attacked (Eve Active) scenarios,
illustrating the cryptographic contrast, QBER detection, and AES-256-GCM settlement.
"""

import argparse
import sys
import time
from typing import Optional

from auth.channel import AuthenticatedChannel
from crypto.aes_gcm import AESGCMCipher, DecryptionError
from demo.dashboard import (
    Colors,
    print_banner,
    print_qkd_step_summary,
    print_transaction_workflow,
)
from eve.eavesdropper import Eavesdropper
from qkd.bb84_classical import ClassicalBB84
from qkd.bb84_qiskit import QiskitBB84
from qkd.protocol import QKDResult
from transactions.generator import FinancialTransaction, generate_transaction


def run_demonstration(
    level: int = 1,
    num_bits: int = 512,
    eve_rate: float = 1.0,
):
    """
    Run the full contrast demonstration: Clean Run followed by Attacked Run.
    """
    print_banner()
    level_name = "Level 1: Classical Probabilistic Simulation" if level == 1 else "Level 2: Qiskit Quantum Circuit Simulation"
    print(f"{Colors.BOLD}Simulation Engine Selected:{Colors.RESET} {Colors.CYAN}{level_name}{Colors.RESET}")
    print(f"{Colors.BOLD}Raw Qubits Per Exchange:{Colors.RESET} {num_bits} qubits")
    print(f"{Colors.BOLD}Security Threshold:{Colors.RESET} 11.00% QBER\n")

    # =========================================================================
    # SCENARIO 1: CLEAN RUN (HONEST QUANTUM CHANNEL)
    # =========================================================================
    print(f"{Colors.BOLD}{Colors.GREEN}{'═'*80}")
    print(f"  SCENARIO 1: CLEAN RUN (Honest Quantum Channel — No Eavesdropper)")
    print(f"{'═'*80}{Colors.RESET}")

    # Authenticated Classical Channel Setup
    auth_channel = AuthenticatedChannel()
    auth_msg = auth_channel.send("Alice", "Bob", "KEY_EXCHANGE_INIT", {"protocol": "BB84", "bits": num_bits})
    auth_channel.verify_and_receive(auth_msg)

    # QKD Execution
    t0 = time.time()
    if level == 1:
        sim = ClassicalBB84(num_bits=num_bits)
        clean_result = sim.run()
    else:
        sim = QiskitBB84(num_bits=num_bits)
        clean_result = sim.run()
    clean_duration = (time.time() - t0) * 1000

    print_qkd_step_summary(clean_result, "Clean Run")

    # Financial Transaction Processing
    txn_clean = generate_transaction()
    if not clean_result.is_aborted and clean_result.final_aes_key:
        cipher = AESGCMCipher(clean_result.final_aes_key)
        encrypted_payload = cipher.encrypt(txn_clean.to_json(), associated_data=txn_clean.txn_id)
        decrypted_json = cipher.decrypt(encrypted_payload)
        decrypted_txn = FinancialTransaction.from_json(decrypted_json)
        print_transaction_workflow(
            txn=txn_clean,
            encrypted=encrypted_payload,
            decrypted_txn=decrypted_txn,
            is_blocked=False,
        )
    else:
        print_transaction_workflow(
            txn=txn_clean,
            is_blocked=True,
            block_reason=clean_result.abort_reason,
        )

    # =========================================================================
    # SCENARIO 2: ATTACKED RUN (EVE INTERCEPT-AND-RESEND ACTIVE)
    # =========================================================================
    print(f"\n{Colors.BOLD}{Colors.RED}{'═'*80}")
    print(f"  SCENARIO 2: ATTACKED RUN (Active Eavesdropper: Intercept & Resend Attack)")
    print(f"  Eve Interception Rate: {eve_rate:.0%}")
    print(f"{'═'*80}{Colors.RESET}")

    eve = Eavesdropper(interception_rate=eve_rate)
    
    t0 = time.time()
    if level == 1:
        sim = ClassicalBB84(num_bits=num_bits)
        attacked_result = sim.run(eavesdropper_fn=eve.intercept_and_resend_classical)
    else:
        sim = QiskitBB84(num_bits=num_bits)
        attacked_result = sim.run(eavesdropper=eve)
    attacked_duration = (time.time() - t0) * 1000

    print_qkd_step_summary(attacked_result, "Attacked Run")

    txn_attacked = generate_transaction()
    if attacked_result.is_aborted:
        print_transaction_workflow(
            txn=txn_attacked,
            is_blocked=True,
            block_reason=f"QBER of {attacked_result.qber:.2%} exceeds threshold ({attacked_result.abort_threshold:.2%}). {attacked_result.abort_reason}",
        )
    else:
        cipher = AESGCMCipher(attacked_result.final_aes_key)
        encrypted_payload = cipher.encrypt(txn_attacked.to_json(), associated_data=txn_attacked.txn_id)
        decrypted_json = cipher.decrypt(encrypted_payload)
        decrypted_txn = FinancialTransaction.from_json(decrypted_json)
        print_transaction_workflow(
            txn=txn_attacked,
            encrypted=encrypted_payload,
            decrypted_txn=decrypted_txn,
            is_blocked=False,
        )

    # =========================================================================
    # COMPARATIVE SUMMARY DASHBOARD
    # =========================================================================
    print(f"\n{Colors.BOLD}{Colors.CYAN}┌── [Executive Summary: Clean vs Attacked Comparison] ────────────────────┐{Colors.RESET}")
    print(f"│ Metric                         │ Clean Run         │ Attacked Run (Eve) │")
    print(f"├────────────────────────────────┼───────────────────┼────────────────────┤")
    print(f"│ Raw Quantum Bits (Photons)     │ {clean_result.raw_bit_count:<17} │ {attacked_result.raw_bit_count:<18} │")
    print(f"│ Sifted Key Length              │ {len(clean_result.alice_sifted_key):<17} │ {len(attacked_result.alice_sifted_key):<18} │")
    print(f"│ Sample Error Count             │ {clean_result.sample_errors:<17} │ {attacked_result.sample_errors:<18} │")
    print(f"│ Quantum Bit Error Rate (QBER)  │ {clean_result.qber:<16.2%}  │ {attacked_result.qber:<17.2%}  │")
    print(f"│ Security Threshold (Max QBER)  │ {clean_result.abort_threshold:<16.2%}  │ {attacked_result.abort_threshold:<17.2%}  │")
    print(f"│ Shared AES-256 Key Derived     │ {'Yes (Secure)':<17} │ {'NO (Aborted)':<18} │")
    print(f"│ Financial Transaction Action   │ {Colors.GREEN}{'SETTLED':<17}{Colors.RESET} │ {Colors.RED}{'BLOCKED':<18}{Colors.RESET} │")
    print(f"{Colors.BOLD}{Colors.CYAN}└────────────────────────────────┴───────────────────┴────────────────────┘{Colors.RESET}\n")


def main():
    parser = argparse.ArgumentParser(
        description="FinTech QKD: Quantum-Resilient Cryptographic Framework for Secure Financial Transactions."
    )
    parser.add_argument(
        "--level",
        type=int,
        choices=[1, 2],
        default=1,
        help="Simulation level: 1 = Classical Logic BB84, 2 = Qiskit Quantum Circuits (default: 1)",
    )
    parser.add_argument(
        "--bits",
        type=int,
        default=512,
        help="Number of raw quantum bits/photons to exchange (default: 512)",
    )
    parser.add_argument(
        "--intercept",
        type=float,
        default=1.0,
        help="Eve interception rate from 0.0 to 1.0 (default: 1.0 for 100%% intercept-and-resend)",
    )
    parser.add_argument(
        "--all-levels",
        action="store_true",
        help="Run both Level 1 (Classical) and Level 2 (Qiskit) consecutively.",
    )

    args = parser.parse_args()

    if args.all_levels:
        print(f"\n{Colors.BOLD}{Colors.HEADER}>>> EXECUTING LEVEL 1: CLASSICAL PROBABILISTIC BB84 <<<{Colors.RESET}")
        run_demonstration(level=1, num_bits=args.bits, eve_rate=args.intercept)
        print(f"\n{Colors.BOLD}{Colors.HEADER}>>> EXECUTING LEVEL 2: QISKIT QUANTUM CIRCUIT SIMULATION <<<{Colors.RESET}")
        run_demonstration(level=2, num_bits=args.bits, eve_rate=args.intercept)
    else:
        run_demonstration(level=args.level, num_bits=args.bits, eve_rate=args.intercept)


if __name__ == "__main__":
    main()
