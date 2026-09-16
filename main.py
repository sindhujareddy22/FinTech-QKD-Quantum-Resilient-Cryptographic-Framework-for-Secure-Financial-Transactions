#!/usr/bin/env python3
"""
FinTech QKD: Quantum-Resilient Cryptographic Framework for Secure Financial Transactions.

Entrypoint script. Launches the Streamlit Live Dashboard application or the CLI runner.
"""

import os
import subprocess
import sys

def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--cli":
        from demo.main import main as cli_main
        sys.argv.pop(1)
        cli_main()
    else:
        # Launch Streamlit Live Dashboard
        dashboard_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app", "main.py")
        cmd = [sys.executable, "-m", "streamlit", "run", dashboard_path, "--server.port", "8501", "--server.headless", "true"]
        print("\n🚀 Launching FinTech QKD Streamlit Live Stream Dashboard...")
        print("📍 Dashboard URL: http://localhost:8501\n")
        subprocess.run(cmd)

if __name__ == "__main__":
    main()
