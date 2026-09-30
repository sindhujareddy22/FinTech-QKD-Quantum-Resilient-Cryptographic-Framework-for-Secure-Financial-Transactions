"""
Synthetic & Manual ISO 20022 Financial Settlement Batch Generator (INR / Rupees)
=================================================================================
Generates realistic, standardized interbank settlement transactions adhering to
the ISO 20022 `pacs.008.001.09` (Financial Interbank Credit Transfer / RTGS / NEFT) structure.
Supports both manual bank operator entry and realistic Indian banking synthetic batches in INR (₹).
"""

import uuid
import datetime
import secrets
from dataclasses import dataclass, asdict
from typing import List, Dict, Any, Optional
from faker import Faker

fake = Faker('en_IN')

INDIAN_BANKS = [
    {"name": "State Bank of India", "bic": "SBININBBXXX", "ifsc_prefix": "SBIN"},
    {"name": "HDFC Bank Ltd", "bic": "HDFCINBBXXX", "ifsc_prefix": "HDFC"},
    {"name": "ICICI Bank Ltd", "bic": "ICICINBBXXX", "ifsc_prefix": "ICIC"},
    {"name": "Punjab National Bank", "bic": "PUNBINBBXXX", "ifsc_prefix": "PUNB"},
    {"name": "Bank of Baroda", "bic": "BARBINBBXXX", "ifsc_prefix": "BARB"},
    {"name": "Axis Bank Ltd", "bic": "UTIBINBBXXX", "ifsc_prefix": "UTIB"},
    {"name": "Reserve Bank of India (Clearing House)", "bic": "RBISINBBXXX", "ifsc_prefix": "RBIS"},
]


@dataclass
class SettlementTransaction:
    """Individual interbank payment order within a settlement batch."""
    instruction_id: str
    end_to_end_id: str
    debtor_name: str
    debtor_agent_bic: str
    debtor_iban: str  # Account / IBAN / Virtual Account
    creditor_name: str
    creditor_agent_bic: str
    creditor_iban: str
    instructed_amount: float
    currency: str
    remittance_reference: str
    timestamp: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class SettlementBatch:
    """ISO 20022 pacs.008 Interbank Settlement Batch Header & Payload."""
    batch_id: str
    message_definition: str
    created_at: str
    settlement_method: str
    instructing_agent_bic: str
    instructed_agent_bic: str
    transaction_count: int
    total_amount: float
    currency: str
    transactions: List[SettlementTransaction]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "batch_id": self.batch_id,
            "message_definition": self.message_definition,
            "created_at": self.created_at,
            "settlement_method": self.settlement_method,
            "instructing_agent_bic": self.instructing_agent_bic,
            "instructed_agent_bic": self.instructed_agent_bic,
            "transaction_count": self.transaction_count,
            "total_amount": round(self.total_amount, 2),
            "currency": self.currency,
            "transactions": [t.to_dict() for t in self.transactions],
        }


def generate_synthetic_settlement_batch(
    min_txns: int = 3,
    max_txns: int = 8,
    currency: str = "INR"
) -> SettlementBatch:
    """
    Generates a synthetic ISO 20022 interbank batch with random Indian enterprise transactions in INR (₹).
    """
    count = secrets.randbelow(max_txns - min_txns + 1) + min_txns
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    batch_id = f"SETTLE-{datetime.datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"

    transactions: List[SettlementTransaction] = []
    total_amount = 0.0

    indian_companies = [
        "Tata Consultancy Services Ltd", "Reliance Industries Treasury", "Infosys Technologies Ltd",
        "Larsen & Toubro FinTech Corp", "Hindustan Unilever Treasury", "Wipro Digital Payments",
        "Bharti Airtel Commercial A/C", "Adani Global Port Logistics", "Mahindra & Mahindra Treasury",
        "Bharat Petroleum Corporate", "State Treasury Liquidity Pool", "National Payment Switch Corp"
    ]

    for _ in range(count):
        # Realistic amounts in INR: ₹1,50,000 to ₹85,00,000
        amount = round(secrets.randbelow(8500000) + 150000 + secrets.randbelow(100) / 100.0, 2)
        total_amount += amount
        
        debtor_corp = secrets.choice(indian_companies)
        creditor_corp = secrets.choice([c for c in indian_companies if c != debtor_corp])
        
        d_bank = secrets.choice(INDIAN_BANKS[:4])
        c_bank = secrets.choice(INDIAN_BANKS[4:])

        tx = SettlementTransaction(
            instruction_id=f"INS-{uuid.uuid4().hex[:10].upper()}",
            end_to_end_id=f"UTR-{datetime.datetime.now().strftime('%Y%m%d')}-{secrets.randbelow(900000)+100000}",
            debtor_name=debtor_corp,
            debtor_agent_bic=d_bank["bic"],
            debtor_iban=f"{d_bank['ifsc_prefix']}000{secrets.randbelow(9000000)+1000000}",
            creditor_name=creditor_corp,
            creditor_agent_bic=c_bank["bic"],
            creditor_iban=f"{c_bank['ifsc_prefix']}000{secrets.randbelow(9000000)+1000000}",
            instructed_amount=amount,
            currency=currency,
            remittance_reference=f"RTGS/INF/{secrets.randbelow(9000000)+1000000}/INTERBANK-SETTLE",
            timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        )
        transactions.append(tx)

    return SettlementBatch(
        batch_id=batch_id,
        message_definition="pacs.008.001.09",
        created_at=now_iso,
        settlement_method="RTGS",
        instructing_agent_bic="BANKAINBBXXX",
        instructed_agent_bic="CLRGINBBXXX",
        transaction_count=len(transactions),
        total_amount=total_amount,
        currency=currency,
        transactions=transactions,
    )


def create_manual_settlement_batch(
    debtor_bank: str,
    debtor_name: str,
    debtor_acc: str,
    creditor_bank: str,
    creditor_name: str,
    creditor_acc: str,
    amount: float,
    purpose: str = "Interbank RTGS Settlement",
    batch_ref: Optional[str] = None,
    currency: str = "INR",
    additional_txns: Optional[List[Dict[str, Any]]] = None
) -> SettlementBatch:
    """
    Constructs an authentic ISO 20022 Interbank Settlement Batch from manual operator input.
    """
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    today_str = datetime.datetime.now().strftime('%Y%m%d')
    batch_id = batch_ref.strip() if batch_ref and batch_ref.strip() else f"SETTLE-{today_str}-{uuid.uuid4().hex[:8].upper()}"

    transactions: List[SettlementTransaction] = []
    
    # Primary line transaction
    primary_tx = SettlementTransaction(
        instruction_id=f"INS-{uuid.uuid4().hex[:10].upper()}",
        end_to_end_id=f"UTR-{today_str}-{secrets.randbelow(900000)+100000}",
        debtor_name=debtor_name.strip() or "Bank A Treasury Client",
        debtor_agent_bic=debtor_bank.strip() or "SBININBBXXX",
        debtor_iban=debtor_acc.strip() or f"SBIN000{secrets.randbelow(9000000)+1000000}",
        creditor_name=creditor_name.strip() or "Clearing House Settlement A/C",
        creditor_agent_bic=creditor_bank.strip() or "RBISINBBXXX",
        creditor_iban=creditor_acc.strip() or f"RBIS000{secrets.randbelow(9000000)+1000000}",
        instructed_amount=round(float(amount), 2),
        currency=currency,
        remittance_reference=f"RTGS/{purpose.strip()[:24].upper()}/{secrets.randbelow(900000)+100000}",
        timestamp=now_iso,
    )
    transactions.append(primary_tx)
    total_amount = float(amount)

    # Optional additional aggregated transactions
    if additional_txns:
        for idx, sub_tx in enumerate(additional_txns, start=2):
            sub_amt = float(sub_tx.get("amount", 0))
            if sub_amt <= 0:
                continue
            total_amount += sub_amt
            transactions.append(SettlementTransaction(
                instruction_id=f"INS-{uuid.uuid4().hex[:10].upper()}",
                end_to_end_id=f"UTR-{today_str}-{secrets.randbelow(900000)+100000}",
                debtor_name=sub_tx.get("debtor_name", f"{debtor_name} Sub-Order {idx}"),
                debtor_agent_bic=debtor_bank.strip(),
                debtor_iban=sub_tx.get("debtor_acc", f"ACC-{secrets.randbelow(9000000)+1000000}"),
                creditor_name=sub_tx.get("creditor_name", f"{creditor_name} Sub-Order {idx}"),
                creditor_agent_bic=creditor_bank.strip(),
                creditor_iban=sub_tx.get("creditor_acc", f"ACC-{secrets.randbelow(9000000)+1000000}"),
                instructed_amount=round(sub_amt, 2),
                currency=currency,
                remittance_reference=f"RTGS/SUB-{idx}/{secrets.randbelow(900000)+100000}",
                timestamp=now_iso,
            ))

    return SettlementBatch(
        batch_id=batch_id,
        message_definition="pacs.008.001.09",
        created_at=now_iso,
        settlement_method="RTGS",
        instructing_agent_bic="BANKAINBBXXX",
        instructed_agent_bic="CLRGINBBXXX",
        transaction_count=len(transactions),
        total_amount=round(total_amount, 2),
        currency=currency,
        transactions=transactions,
    )
