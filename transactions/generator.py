"""
Synthetic ISO 20022 Financial Settlement Batch Generator
========================================================
Generates realistic, standardized interbank settlement transactions adhering to
the ISO 20022 `pacs.008.001.09` (Financial Interbank Credit Transfer) structure.
Uses the `faker` library to generate plausible enterprise entities, IBANs, and amounts.
"""

import uuid
import datetime
import secrets
from dataclasses import dataclass, asdict
from typing import List, Dict, Any
from faker import Faker

fake = Faker()


@dataclass
class SettlementTransaction:
    """Individual interbank payment order within a settlement batch."""
    instruction_id: str
    end_to_end_id: str
    debtor_name: str
    debtor_agent_bic: str
    debtor_iban: str
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
    min_txns: int = 4,
    max_txns: int = 10,
    currency: str = "USD"
) -> SettlementBatch:
    """
    Generates a synthetic ISO 20022 interbank batch with random enterprise transactions.
    """
    count = secrets.randbelow(max_txns - min_txns + 1) + min_txns
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    batch_id = f"SETTLE-{datetime.datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"

    transactions: List[SettlementTransaction] = []
    total_amount = 0.0

    for _ in range(count):
        amount = round(secrets.randbelow(950000) + 50000 + secrets.randbelow(100) / 100.0, 2)
        total_amount += amount
        
        tx = SettlementTransaction(
            instruction_id=f"INS-{uuid.uuid4().hex[:10].upper()}",
            end_to_end_id=f"E2E-{uuid.uuid4().hex[:12].upper()}",
            debtor_name=fake.company(),
            debtor_agent_bic="BANKAUS33XXX",
            debtor_iban=fake.iban(),
            creditor_name=fake.company(),
            creditor_agent_bic="CLRGUS33XXX",
            creditor_iban=fake.iban(),
            instructed_amount=amount,
            currency=currency,
            remittance_reference=f"INV-{fake.numerify(text='#####')}-INTERBANK-NET",
            timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        )
        transactions.append(tx)

    return SettlementBatch(
        batch_id=batch_id,
        message_definition="pacs.008.001.09",
        created_at=now_iso,
        settlement_method="CLRG",
        instructing_agent_bic="BANKAUS33XXX",
        instructed_agent_bic="CLRGUS33XXX",
        transaction_count=len(transactions),
        total_amount=total_amount,
        currency=currency,
        transactions=transactions,
    )
