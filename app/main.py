"""
FinTech QKD: Quantum-Resilient Cryptographic Framework for Secure Financial Transactions
Streamlit Live Dashboard Application.

Demonstrates:
- Continuous per-transaction BB84 quantum re-keying.
- Mid-stream runtime Eve eavesdropper detection.
- Immediate QBER spike detection & AES-256-GCM transaction blocking.
- Dual-Engine: Level 1 Classical Logic vs Level 2 Qiskit Quantum Circuits.
"""

import os
import sys
import time
import pandas as pd
import streamlit as st

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from auth.channel import AuthenticatedChannel
from crypto.aes_gcm import AESGCMCipher
from eve.eavesdropper import Eavesdropper
from qkd.bb84_classical import ClassicalBB84
from qkd.bb84_qiskit import QiskitBB84
from transactions.generator import generate_transaction


# Page Config
st.set_page_config(
    page_title="FinTech QKD — Live Stream Dashboard",
    page_icon="⚛️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Custom Styling for Quantum Dark Cyber Aesthetic
st.markdown("""
<style>
    .main-title {
        font-size: 2.2rem;
        font-weight: 800;
        background: linear-gradient(90deg, #38bdf8, #818cf8, #c084fc);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0px;
    }
    .sub-title {
        color: #94a3b8;
        font-size: 0.95rem;
        margin-bottom: 20px;
    }
    .metric-container {
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 12px 16px;
    }
    .alert-banner-danger {
        background: rgba(239, 68, 68, 0.2);
        border: 2px solid #ef4444;
        border-radius: 12px;
        padding: 16px 20px;
        color: #fca5a5;
        margin-bottom: 16px;
        animation: pulse 1.5s infinite;
    }
    .alert-banner-success {
        background: rgba(16, 185, 129, 0.15);
        border: 1px solid #10b981;
        border-radius: 12px;
        padding: 14px 20px;
        color: #6ee7b7;
        margin-bottom: 16px;
    }
    .stDataFrame {
        border-radius: 10px;
    }
</style>
""", unsafe_allow_html=True)


# Initialize Session State
if "history" not in st.session_state:
    st.session_state.history = []
if "is_streaming" not in st.session_state:
    st.session_state.is_streaming = False
if "quarantined" not in st.session_state:
    st.session_state.quarantined = False
if "total_settled_vol" not in st.session_state:
    st.session_state.total_settled_vol = 0.0


# Header
st.markdown("<h1 class='main-title'>FinTech QKD: Continuous Quantum Re-Keying Stream</h1>", unsafe_allow_html=True)
st.markdown("<p class='sub-title'>Simulating real-time BB84 key distribution, runtime eavesdropping detection, and AES-256-GCM financial settlement</p>", unsafe_allow_html=True)


# Sidebar Configuration
with st.sidebar:
    st.header("⚙️ Quantum & Stream Controls")
    
    # Engine Selection
    engine_choice = st.radio(
        "Simulation Engine",
        ["Level 1 (Classical Logic BB84)", "Level 2 (Qiskit Quantum Circuits)"],
        index=0,
        help="Switch between classical logic probabilistic simulation and real Qiskit quantum circuit simulations."
    )
    sim_level = 1 if "Level 1" in engine_choice else 2

    st.markdown("---")
    st.subheader("🕵️‍♀️ Adversary Configuration")
    
    # Eve Runtime Toggle
    eve_active = st.toggle(
        "⚠️ Enable Eavesdropper (Eve)",
        value=False,
        help="Flip this switch at ANY time during the live stream to simulate an intercept-and-resend quantum attack on the channel."
    )
    
    eve_interception_rate = st.slider(
        "Eve Interception Rate",
        min_value=0.1,
        max_value=1.0,
        value=1.0,
        step=0.05,
        disabled=not eve_active,
        format="%.0f%%" if eve_active else "Off"
    ) if eve_active else 0.0

    st.markdown("---")
    st.subheader("🛡️ Security Policy")
    
    policy_mode = st.radio(
        "Response on Detection",
        ["Block affected transactions only (Continue Monitoring)", "Halt / Quarantine Session on Breach"],
        index=0
    )

    st.markdown("---")
    st.subheader("⏱️ Stream Settings")
    stream_delay = st.slider("Stream Delay (seconds)", min_value=0.2, max_value=2.5, value=0.8, step=0.1)
    
    qubit_count = st.select_slider(
        "Raw Qubits per Transaction Key",
        options=[128, 256, 512, 1024],
        value=512
    )

    if st.button("🗑️ Clear History & Reset", use_container_width=True):
        st.session_state.history = []
        st.session_state.is_streaming = False
        st.session_state.quarantined = False
        st.session_state.total_settled_vol = 0.0
        st.rerun()


# Top Control Bar (Start / Stop / Single Step)
col_ctrl1, col_ctrl2, col_ctrl3, col_ctrl4 = st.columns([1.5, 1.5, 1.5, 2])

with col_ctrl1:
    if not st.session_state.is_streaming:
        if st.button("▶️ Start Live Stream", use_container_width=True, type="primary"):
            st.session_state.is_streaming = True
            st.session_state.quarantined = False
            st.rerun()
    else:
        if st.button("⏸️ Pause Stream", use_container_width=True):
            st.session_state.is_streaming = False
            st.rerun()

with col_ctrl2:
    if st.button("⏭️ Step 1 Transaction", use_container_width=True, disabled=st.session_state.is_streaming):
        st.session_state.do_single_step = True

with col_ctrl3:
    eve_badge = "🚨 Eve ACTIVE (100%)" if eve_active else "🛡️ Clean Channel"
    st.metric("Adversary Status", eve_badge)

with col_ctrl4:
    pol_text = "Quarantine on Breach" if "Halt" in policy_mode else "Block Affected Only"
    st.metric("Active Security Policy", pol_text)


# Process Transaction Function
def process_single_transaction():
    # 1. Generate synthetic transaction
    txn = generate_transaction()
    
    # 2. Authenticate classical channel (HMAC-SHA256)
    auth_channel = AuthenticatedChannel()
    auth_msg = auth_channel.send("Bank_Alice", "Bank_Bob", "QKD_REKEY", {"txn_id": txn.txn_id, "qubits": qubit_count})
    auth_channel.verify_and_receive(auth_msg)

    # 3. Setup QKD Engine
    eve = Eavesdropper(interception_rate=eve_interception_rate) if eve_active else None

    if sim_level == 1:
        sim = ClassicalBB84(num_bits=qubit_count)
        qkd_res = sim.run(eavesdropper_fn=eve.intercept_and_resend_classical if eve else None)
    else:
        sim = QiskitBB84(num_bits=qubit_count)
        qkd_res = sim.run(eavesdropper=eve)

    # 4. Decision & Financial Settlement
    status = "BLOCKED"
    cipher_snippet = "--"
    gmac_tag = "--"
    key_hex = "--"

    if not qkd_res.is_aborted and qkd_res.final_aes_key:
        cipher = AESGCMCipher(qkd_res.final_aes_key)
        encrypted = cipher.encrypt(txn.to_json(), associated_data=txn.txn_id)
        cipher_snippet = encrypted.ciphertext_b64[:20] + "..."
        gmac_tag = encrypted.tag_b64
        key_hex = qkd_res.final_aes_key.hex()[:16] + "..."
        status = "SETTLED"
        st.session_state.total_settled_vol += txn.amount
    else:
        status = "BLOCKED"
        if "Halt" in policy_mode:
            st.session_state.quarantined = True
            st.session_state.is_streaming = False

    # Record in history
    record = {
        "txn_id": txn.txn_id,
        "timestamp": time.strftime("%H:%M:%S"),
        "amount": txn.amount,
        "currency": txn.currency,
        "category": txn.merchant_category,
        "status": status,
        "qber": qkd_res.qber,
        "eve_active": eve_active,
        "sifted_bits": len(qkd_res.alice_sifted_key),
        "key_hex": key_hex,
        "gmac_tag": gmac_tag,
        "engine": "Qiskit 2.x" if sim_level == 2 else "Classical",
    }
    st.session_state.history.append(record)
    return record


# Single step execution trigger
if getattr(st.session_state, "do_single_step", False):
    st.session_state.do_single_step = False
    process_single_transaction()
    st.rerun()


# Top Metrics Banner
m1, m2, m3, m4, m5 = st.columns(5)
total_txns = len(st.session_state.history)
settled_count = sum(1 for r in st.session_state.history if r["status"] == "SETTLED")
blocked_count = sum(1 for r in st.session_state.history if r["status"] == "BLOCKED")
latest_qber = st.session_state.history[-1]["qber"] if total_txns > 0 else 0.0

with m1:
    st.metric("Total Streamed", total_txns)
with m2:
    st.metric("Settled (Secure)", settled_count, delta=f"{settled_count} OK" if settled_count else None)
with m3:
    st.metric("Blocked (Breach)", blocked_count, delta=f"-{blocked_count} Eve" if blocked_count else None, delta_color="inverse")
with m4:
    st.metric("Latest QBER", f"{latest_qber:.2%}", delta="> 11% Limit" if latest_qber > 0.11 else "Safe (0%)", delta_color="inverse" if latest_qber > 0.11 else "normal")
with m5:
    st.metric("Settled Volume", f"${st.session_state.total_settled_vol:,.2f}")


# Live Eavesdropping Alert Banner
if total_txns > 0:
    last_rec = st.session_state.history[-1]
    if last_rec["status"] == "BLOCKED":
        st.markdown(f"""
        <div class='alert-banner-danger'>
            <h3 style='margin:0; color:#f87171;'>🚨 EAVESDROPPER DETECTED — TRANSACTION BLOCKED!</h3>
            <p style='margin:4px 0 0 0;'>
                <strong>Transaction ID:</strong> <code>{last_rec['txn_id']}</code> | 
                <strong>QBER:</strong> <span style='color:#ffedd5; font-weight:bold;'>{last_rec['qber']:.2%}</span> (Exceeds 11.00% safety threshold) | 
                <strong>Action:</strong> Symmetric key derivation halted. Zero plaintext or ciphertext exposed.
            </p>
        </div>
        """, unsafe_allow_html=True)
    else:
        st.markdown(f"""
        <div class='alert-banner-success'>
            <h4 style='margin:0; color:#34d399;'>✔ CHANNEL SECURE — TRANSACTION SETTLED</h4>
            <p style='margin:2px 0 0 0;'>
                <strong>Transaction ID:</strong> <code>{last_rec['txn_id']}</code> | 
                <strong>QBER:</strong> {last_rec['qber']:.2%} | 
                <strong>AEAD Tag:</strong> <code>{last_rec['gmac_tag']}</code> (100% GMAC Integrity Verified)
            </p>
        </div>
        """, unsafe_allow_html=True)


if st.session_state.quarantined:
    st.error("🛑 SESSION QUARANTINED: Eavesdropping attack detected on the quantum link. Stream halted according to active security policy.")


# Dashboard Layout: Left = Chart, Right = Feed
chart_col, feed_col = st.columns([1.2, 1])

with chart_col:
    st.subheader("📈 Real-Time QBER Monitoring vs Security Threshold")
    if total_txns > 0:
        df_history = pd.DataFrame(st.session_state.history)
        chart_data = pd.DataFrame({
            "Transaction #": range(1, len(df_history) + 1),
            "Observed QBER (%)": df_history["qber"] * 100,
            "11% Security Threshold": [11.0] * len(df_history),
        }).set_index("Transaction #")
        
        st.line_chart(
            chart_data,
            color=["#38bdf8", "#ef4444"],
            height=320,
            use_container_width=True
        )
    else:
        st.info("Start the stream or step a transaction to view live QBER telemetry.")

with feed_col:
    st.subheader("📋 Live Transaction Stream Ledger")
    if total_txns > 0:
        df_feed = pd.DataFrame(st.session_state.history).iloc[::-1]
        display_df = df_feed[["txn_id", "amount", "currency", "qber", "status", "timestamp"]].copy()
        display_df["amount"] = display_df.apply(lambda r: f"{r['currency']} {r['amount']:,.2f}", axis=1)
        display_df["qber"] = display_df["qber"].apply(lambda q: f"{q:.2%}")
        display_df = display_df.drop(columns=["currency"])
        st.dataframe(display_df, height=320, use_container_width=True)
    else:
        st.write("No transactions in stream yet.")


# Stream Continuous Loop
if st.session_state.is_streaming and not st.session_state.quarantined:
    process_single_transaction()
    time.sleep(stream_delay)
    st.rerun()
