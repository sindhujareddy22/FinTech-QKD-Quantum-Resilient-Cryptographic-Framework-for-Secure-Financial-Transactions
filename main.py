"""
FinTech QKD: Quantum-Resilient Security for Interbank Settlement
==============================================================
Main executable entry point for launching Bank A or Clearing House nodes.

Usage:
  Clearing House (Start First):
    python main.py --role clearing --port 8001 --peer-port 8000

  Bank A (Start Second):
    python main.py --role bank --port 8000 --peer-port 8001

  Physical Two-Device Setup:
    Device B (Clearing): python main.py --role clearing --host 0.0.0.0 --port 8001
    Device A (Bank):     python main.py --role bank --port 8000 --peer-host <DEVICE_B_IP> --peer-port 8001
"""

import argparse
import sys
from config import CONFIG
from node.server import start_node_server


def main():
    parser = argparse.ArgumentParser(
        description="FinTech QKD: Quantum-Resilient Interbank Settlement Node",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--role",
        choices=["bank", "clearing"],
        required=True,
        help="Operational role of this node ('bank' = Bank A / Sender, 'clearing' = Clearing House / Receiver)",
    )
    parser.add_argument(
        "--host",
        default="0.0.0.0",
        help="Host interface to bind this node to (default: 0.0.0.0)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=None,
        help="Port number for this node (default: 8000 for Bank, 8001 for Clearing)",
    )
    parser.add_argument(
        "--peer-host",
        default="127.0.0.1",
        help="IP address of the peer banking node (default: 127.0.0.1)",
    )
    parser.add_argument(
        "--peer-port",
        type=int,
        default=None,
        help="Port number of the peer node (default: 8001 for Bank's peer, 8000 for Clearing's peer)",
    )

    args = parser.parse_args()

    # Assign smart defaults based on role
    if args.role == "bank":
        port = args.port if args.port is not None else CONFIG.BANK_DEFAULT_PORT
        peer_port = args.peer_port if args.peer_port is not None else CONFIG.CLEARING_DEFAULT_PORT
    else:
        port = args.port if args.port is not None else CONFIG.CLEARING_DEFAULT_PORT
        peer_port = args.peer_port if args.peer_port is not None else CONFIG.BANK_DEFAULT_PORT

    print("\n" + "="*65)
    print(f"  FinTech QKD: Quantum-Resilient Interbank Settlement Link")
    print(f"  Role:       {args.role.upper()} ({'Sender' if args.role == 'bank' else 'Receiver'})")
    print(f"  Local Node: http://{args.host}:{port}")
    print(f"  Peer Node:  http://{args.peer_host}:{peer_port}")
    print(f"  QBER Gate:  Abort threshold >= {CONFIG.QBER_ABORT_THRESHOLD*100:.1f}%")
    print(f"  Re-Keying:  Enforced PER-SETTLEMENT with BB84 + PQC Hybrid")
    print("="*65 + "\n")

    try:
        start_node_server(
            role=args.role,
            host=args.host,
            port=port,
            peer_host=args.peer_host,
            peer_port=peer_port,
        )
    except KeyboardInterrupt:
        print("\n[!] Node shutting down gracefully.")
        sys.exit(0)


if __name__ == "__main__":
    main()
