"""
Unit tests for QKD modules (Classical Level 1 and Qiskit Level 2).
"""

import unittest
from eve.eavesdropper import Eavesdropper
from qkd.bb84_classical import ClassicalBB84
from qkd.bb84_qiskit import QiskitBB84
from qkd.protocol import Basis, Photon, privacy_amplification


class TestQKD(unittest.TestCase):

    def test_classical_bb84_clean_run(self):
        sim = ClassicalBB84(num_bits=256, sample_ratio=0.20, abort_threshold=0.11)
        res = sim.run()
        self.assertFalse(res.is_aborted)
        self.assertEqual(res.qber, 0.0)
        self.assertIsNotNone(res.final_aes_key)
        self.assertEqual(len(res.final_aes_key), 32)
        self.assertGreater(len(res.alice_sifted_key), 80)

    def test_classical_bb84_attacked_run(self):
        sim = ClassicalBB84(num_bits=512, sample_ratio=0.25, abort_threshold=0.11)
        eve = Eavesdropper(interception_rate=1.0)
        res = sim.run(eavesdropper_fn=eve.intercept_and_resend_classical)
        self.assertTrue(res.is_aborted)
        self.assertGreater(res.qber, 0.11)
        self.assertIsNone(res.final_aes_key)
        self.assertIn("exceeds maximum security threshold", res.abort_reason)

    def test_qiskit_bb84_clean_run(self):
        sim = QiskitBB84(num_bits=256, sample_ratio=0.20, abort_threshold=0.11)
        res = sim.run()
        self.assertFalse(res.is_aborted)
        self.assertEqual(res.qber, 0.0)
        self.assertIsNotNone(res.final_aes_key)
        self.assertEqual(len(res.final_aes_key), 32)

    def test_qiskit_bb84_attacked_run(self):
        sim = QiskitBB84(num_bits=512, sample_ratio=0.25, abort_threshold=0.11)
        eve = Eavesdropper(interception_rate=1.0)
        res = sim.run(eavesdropper=eve)
        self.assertTrue(res.is_aborted)
        self.assertGreater(res.qber, 0.11)
        self.assertIsNone(res.final_aes_key)

    def test_privacy_amplification(self):
        bits1 = [1, 0, 1, 1, 0, 0, 1, 0]
        bits2 = [1, 0, 1, 1, 0, 0, 1, 1]
        key1 = privacy_amplification(bits1)
        key2 = privacy_amplification(bits2)
        self.assertEqual(len(key1), 32)
        self.assertEqual(len(key2), 32)
        self.assertNotEqual(key1, key2)


if __name__ == "__main__":
    unittest.main()
