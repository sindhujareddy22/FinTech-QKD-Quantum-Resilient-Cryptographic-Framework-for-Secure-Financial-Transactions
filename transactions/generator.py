"""
Synthetic financial transaction generator using Faker.

This module models interbank and high-value financial transactions (e.g. SWIFT/Fedwire)
without using any real banking or customer data.
"""

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
import json
import random
from typing import List, Optional
from faker import Faker

fake = Faker()


@dataclass
class FinancialTransaction:
    """
    Synthetic financial transaction payload.
    """
    txn_id: str
    from_acct: str
    to_acct: str
    amount: float
    currency: str
    timestamp: str
    merchant_category: str
    routing_code: str
    description: str

    def to_dict(self) -> dict:
        return asdict(self)

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=2)

    @classmethod
    def from_dict(cls, data: dict) -> "FinancialTransaction":
        return cls(**data)

    @classmethod
    def from_json(cls, json_str: str) -> "FinancialTransaction":
        return cls.from_dict(json.loads(json_str))


MERCHANT_CATEGORIES = [
    "Interbank Liquidity Settlement",
    "Treasury Forex Swap",
    "Commercial Real Estate Escrow",
    "Sovereign Debt Custody Transfer",
    "Institutional Equity Clearing",
    "Central Bank Repo Facility",
    "High-Value Cross-Border Remittance",
]

CURRENCIES = ["USD", "EUR", "GBP", "CHF", "JPY", "SGD"]


def generate_transaction(
    min_amount: float = 50_000.0,
    max_amount: float = 10_000_000.0,
    currency: Optional[str] = None,
) -> FinancialTransaction:
    """
    Generate a single realistic synthetic financial transaction.
    """
    curr = currency or random.choice(CURRENCIES)
    amount = round(random.uniform(min_amount, max_amount), 2)
    
    return FinancialTransaction(
        txn_id=f"TXN-{fake.hexify(text='^^^^^^^^^^^^', upper=True)}",
        from_acct=f"ACCT-{fake.iban()[:16]}",
        to_acct=f"ACCT-{fake.iban()[:16]}",
        amount=amount,
        currency=curr,
        timestamp=datetime.now(timezone.utc).isoformat(),
        merchant_category=random.choice(MERCHANT_CATEGORIES),
        routing_code=f"FEDWIRE/{fake.swift()}",
        description=f"Automated settlement: {fake.catch_phrase()}",
    )


def generate_transaction_batch(count: int = 5) -> List[FinancialTransaction]:
    """
    Generate a batch of synthetic financial transactions.
    """
    return [generate_transaction() for _ in range(count)]
