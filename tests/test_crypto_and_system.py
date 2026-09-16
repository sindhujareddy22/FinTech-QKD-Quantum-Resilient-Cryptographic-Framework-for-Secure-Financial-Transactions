"""
Unit tests for Crypto, Transactions, Eve, and Auth modules.
"""

import os
import unittest
from auth.channel import AuthenticatedChannel, ChannelAuthenticationError
from crypto.aes_gcm import AESGCMCipher, DecryptionError, EncryptedPayload
from eve.eavesdropper import Eavesdropper
from transactions.generator import FinancialTransaction, generate_transaction, generate_transaction_batch


class TestCryptoAndSystem(unittest.TestCase):

    def test_aes_gcm_encryption_decryption(self):
        key = os.urandom(32)
        cipher = AESGCMCipher(key)
        plaintext = '{"secret": "quantum_financial_transfer", "amount": 5000000}'
        aad = "TXN-HEADER-12345"

        payload = cipher.encrypt(plaintext, associated_data=aad)
        self.assertIsNotNone(payload.nonce_b64)
        self.assertIsNotNone(payload.ciphertext_b64)
        self.assertIsNotNone(payload.tag_b64)

        decrypted = cipher.decrypt(payload)
        self.assertEqual(decrypted, plaintext)

    def test_aes_gcm_tamper_detection(self):
        key = os.urandom(32)
        cipher = AESGCMCipher(key)
        plaintext = "Critical payment data"
        payload = cipher.encrypt(plaintext, associated_data="TXN-1")

        # Tampering with ciphertext
        tampered_dict = payload.to_dict()
        tampered_dict["ciphertext"] = "AAAA" + tampered_dict["ciphertext"][4:]
        tampered_payload = EncryptedPayload.from_dict(tampered_dict)

        with self.assertRaises(DecryptionError):
            cipher.decrypt(tampered_payload)

    def test_transaction_generator(self):
        txn = generate_transaction(min_amount=1000, max_amount=5000, currency="USD")
        self.assertTrue(txn.txn_id.startswith("TXN-"))
        self.assertTrue(txn.from_acct.startswith("ACCT-"))
        self.assertEqual(txn.currency, "USD")
        self.assertGreaterEqual(txn.amount, 1000)
        self.assertLessEqual(txn.amount, 5000)

        # JSON serialization/deserialization
        json_str = txn.to_json()
        restored = FinancialTransaction.from_json(json_str)
        self.assertEqual(txn.txn_id, restored.txn_id)
        self.assertEqual(txn.amount, restored.amount)

    def test_authenticated_channel_mitm_prevention(self):
        chan = AuthenticatedChannel()
        msg = chan.send("Alice", "Bob", "BASIS_EXCHANGE", {"bases": ["+", "x", "+"]})
        
        # Valid message
        payload = chan.verify_and_receive(msg)
        self.assertEqual(payload["bases"], ["+", "x", "+"])

        # Tampered message
        tampered_msg = chan.send("Alice", "Bob", "BASIS_EXCHANGE", {"bases": ["+", "x", "+"]})
        tampered_msg.payload["bases"] = ["x", "x", "x"]
        with self.assertRaises(ChannelAuthenticationError):
            chan.verify_and_receive(tampered_msg)

    def test_eve_interception_rates(self):
        eve_full = Eavesdropper(interception_rate=1.0)
        self.assertEqual(eve_full.interception_rate, 1.0)

        eve_zero = Eavesdropper(interception_rate=0.0)
        self.assertEqual(eve_zero.interception_rate, 0.0)


if __name__ == "__main__":
    unittest.main()
