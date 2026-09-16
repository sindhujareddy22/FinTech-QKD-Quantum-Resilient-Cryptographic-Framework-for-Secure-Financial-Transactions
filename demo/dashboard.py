"""
Terminal dashboard and visual output formatter for the FinTech QKD Demonstration.
"""

from typing import List, Optional
import json

from crypto.aes_gcm import EncryptedPayload
from qkd.protocol import QKDResult
from transactions.generator import FinancialTransaction


class Colors:
    HEADER = "\033[95m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    RESET = "\033[0m"


def print_banner():
    banner = f"""
{Colors.CYAN}{Colors.BOLD}╔════════════════════════════════════════════════════════════════════════════════╗
║             FINTECH QKD: QUANTUM-RESILIENT CRYPTOGRAPHIC FRAMEWORK             ║
║                  FOR HIGH-VALUE SECURE FINANCIAL TRANSACTIONS                  ║
╚════════════════════════════════════════════════════════════════════════════════╝{Colors.RESET}
{Colors.DIM}Simulating BB84 Quantum Key Distribution & AES-256-GCM Financial Settlement
Mitigating 'Harvest Now, Decrypt Later' & Post-Quantum Cryptanalysis{Colors.RESET}
"""
    print(banner)


def format_bitstream(bits: List[int], max_len: int = 48) -> str:
    """Format bit list for compact display."""
    s = "".join(str(b) for b in bits[:max_len])
    if len(bits) > max_len:
        s += f"... ({len(bits)} total)"
    return s


def format_bases(bases: list, max_len: int = 48) -> str:
    """Format basis list for compact display."""
    s = "".join(str(b) for b in bases[:max_len])
    if len(bases) > max_len:
        s += f"... ({len(bases)} total)"
    return s


def print_qkd_step_summary(result: QKDResult, title: str):
    print(f"\n{Colors.BOLD}{Colors.BLUE}┌── [QKD Key Exchange Protocol] ──────────────────────────────────────────┐{Colors.RESET}")
    print(f"│ {Colors.BOLD}Simulation Mode:{Colors.RESET} {result.simulation_level}")
    print(f"│ {Colors.BOLD}Raw Qubits Sent (Alice):{Colors.RESET} {result.raw_bit_count} qubits")
    print(f"│ Alice Raw Bits:    {Colors.DIM}{format_bitstream(result.alice_raw_bits)}{Colors.RESET}")
    print(f"│ Alice Bases:       {Colors.DIM}{format_bases(result.alice_bases)}{Colors.RESET}")
    print(f"│ Bob Bases:         {Colors.DIM}{format_bases(result.bob_bases)}{Colors.RESET}")
    print(f"│ Bob Measured Bits: {Colors.DIM}{format_bitstream(result.bob_measured_bits)}{Colors.RESET}")
    print(f"├─────────────────────────────────────────────────────────────────────────┤")
    print(f"│ {Colors.BOLD}Sifted Key Length:{Colors.RESET} {len(result.alice_sifted_key)} bits (~50% basis match)")
    print(f"│ Alice Sifted Key:  {format_bitstream(result.alice_sifted_key, 32)}")
    print(f"│ Bob Sifted Key:    {format_bitstream(result.bob_sifted_key, 32)}")
    print(f"├─────────────────────────────────────────────────────────────────────────┤")
    print(f"│ {Colors.BOLD}Public Sampling:{Colors.RESET}   {len(result.sample_indices)} bits compared for QBER estimation")
    print(f"│ Sample Bit Errors: {result.sample_errors} / {len(result.sample_indices)} mismatches")
    
    qber_color = Colors.GREEN if result.qber <= result.abort_threshold else Colors.RED
    print(f"│ {Colors.BOLD}Calculated QBER:{Colors.RESET}   {qber_color}{Colors.BOLD}{result.qber:.2%}{Colors.RESET} (Security Threshold: {result.abort_threshold:.2%})")
    
    if result.is_aborted:
        print(f"│ {Colors.BOLD}Protocol Status:{Colors.RESET}   {Colors.RED}{Colors.BOLD}✖ KEY REJECTED / ABORTED{Colors.RESET}")
        print(f"│ {Colors.RED}Reason: {result.abort_reason}{Colors.RESET}")
    else:
        print(f"│ {Colors.BOLD}Protocol Status:{Colors.RESET}   {Colors.GREEN}{Colors.BOLD}✔ KEY ACCEPTED{Colors.RESET}")
        print(f"│ {Colors.BOLD}Remaining Bits:{Colors.RESET}    {len(result.final_sifted_bits)} bits (sacrificed sample discarded)")
        if result.final_aes_key:
            print(f"│ {Colors.BOLD}AES-256 Key (PA):{Colors.RESET}  {Colors.CYAN}{result.final_aes_key.hex()[:32]}... [256-bit]{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}└─────────────────────────────────────────────────────────────────────────┘{Colors.RESET}")


def print_transaction_workflow(
    txn: FinancialTransaction,
    encrypted: Optional[EncryptedPayload] = None,
    decrypted_txn: Optional[FinancialTransaction] = None,
    is_blocked: bool = False,
    block_reason: Optional[str] = None,
):
    print(f"\n{Colors.BOLD}{Colors.YELLOW}┌── [Financial Transaction Processing] ─────────────────────────────────┐{Colors.RESET}")
    print(f"│ {Colors.BOLD}Transaction ID:{Colors.RESET}     {txn.txn_id}")
    print(f"│ {Colors.BOLD}Transfer:{Colors.RESET}           {txn.from_acct} ➔ {txn.to_acct}")
    print(f"│ {Colors.BOLD}Amount / Currency:{Colors.RESET}  {txn.currency} {txn.amount:,.2f}")
    print(f"│ {Colors.BOLD}Category:{Colors.RESET}           {txn.merchant_category}")
    print(f"│ {Colors.BOLD}Routing:{Colors.RESET}            {txn.routing_code}")
    print(f"├─────────────────────────────────────────────────────────────────────────┤")
    
    if is_blocked:
        print(f"│ {Colors.RED}{Colors.BOLD}SECURITY ACTION: TRANSACTION BLOCKED — EAVESDROPPING DETECTED{Colors.RESET}")
        print(f"│ {Colors.RED}Details: {block_reason}{Colors.RESET}")
        print(f"│ {Colors.RED}Zero plaintext or encrypted payload was transmitted across the network.{Colors.RESET}")
        print(f"│ {Colors.BOLD}Settlement Status:{Colors.RESET} {Colors.RED}{Colors.BOLD}[TRANSACTION ABORTED & RE-ROUTED]{Colors.RESET}")
    else:
        print(f"│ {Colors.BOLD}Encryption:{Colors.RESET}         AES-256-GCM (Authenticated AEAD with Nonce & GMAC Tag)")
        if encrypted:
            print(f"│ Nonce (96-bit):   {Colors.DIM}{encrypted.nonce_b64}{Colors.RESET}")
            print(f"│ Ciphertext:       {Colors.DIM}{encrypted.ciphertext_b64[:40]}...{Colors.RESET}")
            print(f"│ GMAC Tag:         {Colors.DIM}{encrypted.tag_b64}{Colors.RESET}")
        print(f"├─────────────────────────────────────────────────────────────────────────┤")
        print(f"│ {Colors.BOLD}Decryption Status:{Colors.RESET}  {Colors.GREEN}✔ 100% Integrity & Authenticity Verified{Colors.RESET}")
        if decrypted_txn:
            print(f"│ Verified Amount:  {decrypted_txn.currency} {decrypted_txn.amount:,.2f}")
            print(f"│ Recipient Acct:   {decrypted_txn.to_acct}")
        print(f"│ {Colors.BOLD}Settlement Status:{Colors.RESET} {Colors.GREEN}{Colors.BOLD}★ TRANSACTION SETTLED ★{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.YELLOW}└─────────────────────────────────────────────────────────────────────────┘{Colors.RESET}")
