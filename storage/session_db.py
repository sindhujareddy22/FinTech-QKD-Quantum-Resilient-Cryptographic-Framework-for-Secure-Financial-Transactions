"""
Storage module for QKD-FinTech session audit logging and database management.
Stores full session histories, cryptographic metrics, and forensic event logs using SQLite.
"""

import os
import json
import sqlite3
import datetime
from typing import List, Dict, Any, Optional

DB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
DB_PATH = os.path.join(DB_DIR, "sessions.db")

class SessionDatabase:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        """Creates tables for sessions and individual session events if not exist."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # 1. Sessions Table (High-Level Summary per Node Run / Session)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    session_id TEXT PRIMARY KEY,
                    start_time TEXT NOT NULL,
                    end_time TEXT,
                    role TEXT NOT NULL,
                    node_name TEXT NOT NULL,
                    host TEXT NOT NULL,
                    port INTEGER NOT NULL,
                    peer_host TEXT NOT NULL,
                    peer_port INTEGER NOT NULL,
                    total_batches_settled INTEGER DEFAULT 0,
                    total_batches_blocked INTEGER DEFAULT 0,
                    total_volume_usd REAL DEFAULT 0.0,
                    threats_detected INTEGER DEFAULT 0,
                    threats_disarmed INTEGER DEFAULT 0,
                    qkd_keys_exchanged INTEGER DEFAULT 0,
                    avg_qber REAL DEFAULT 0.0,
                    status TEXT DEFAULT 'ACTIVE',
                    crypto_suite TEXT DEFAULT 'QKD (BB84) + ML-KEM-768 + AES-256-GCM',
                    notes TEXT
                )
            """)

            # 2. Session Events Table (Granular Event Trace)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS session_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    batch_id TEXT,
                    amount_usd REAL DEFAULT 0.0,
                    qber REAL DEFAULT 0.0,
                    status TEXT,
                    details TEXT,
                    FOREIGN KEY (session_id) REFERENCES sessions (session_id) ON DELETE CASCADE
                )
            """)

            conn.commit()

    def create_or_get_session(
        self,
        role: str,
        host: str,
        port: int,
        peer_host: str,
        peer_port: int,
        session_id: Optional[str] = None
    ) -> str:
        """Registers a new active session or updates an existing one."""
        if not session_id:
            now_str = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
            session_id = f"SESS-{now_str}-{role.upper()[:4]}"

        node_name = "Bank A (Sender)" if role == "bank" else "Clearing House (Receiver)"
        now_iso = datetime.datetime.now().isoformat()

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT session_id FROM sessions WHERE session_id = ?", (session_id,))
            exists = cursor.fetchone()

            if not exists:
                cursor.execute("""
                    INSERT INTO sessions (
                        session_id, start_time, end_time, role, node_name,
                        host, port, peer_host, peer_port, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
                """, (session_id, now_iso, now_iso, role, node_name, host, port, peer_host, peer_port))
                conn.commit()

        return session_id

    def record_event(
        self,
        session_id: str,
        event_type: str,
        batch_id: Optional[str] = None,
        amount_usd: float = 0.0,
        qber: float = 0.0,
        status: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        """Records an event and automatically updates session summary aggregates."""
        now_iso = datetime.datetime.now().isoformat()
        details_str = json.dumps(details) if details else "{}"

        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # Insert event
            cursor.execute("""
                INSERT INTO session_events (
                    session_id, timestamp, event_type, batch_id, amount_usd, qber, status, details
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (session_id, now_iso, event_type, batch_id, amount_usd, qber, status, details_str))

            # Update session aggregates based on event type
            if event_type == "SETTLEMENT_SUCCESS":
                cursor.execute("""
                    UPDATE sessions SET
                        end_time = ?,
                        total_batches_settled = total_batches_settled + 1,
                        total_volume_usd = total_volume_usd + ?,
                        qkd_keys_exchanged = qkd_keys_exchanged + 1,
                        status = 'ACTIVE'
                    WHERE session_id = ?
                """, (now_iso, amount_usd, session_id))

            elif event_type == "SETTLEMENT_BLOCKED":
                cursor.execute("""
                    UPDATE sessions SET
                        end_time = ?,
                        total_batches_blocked = total_batches_blocked + 1,
                        threats_detected = threats_detected + 1,
                        status = 'COMPROMISED'
                    WHERE session_id = ?
                """, (now_iso, session_id))

            elif event_type == "EVE_ATTACK":
                cursor.execute("""
                    UPDATE sessions SET
                        end_time = ?,
                        threats_detected = threats_detected + 1,
                        status = 'COMPROMISED'
                    WHERE session_id = ?
                """, (now_iso, session_id))

            elif event_type == "EVE_DISARM":
                cursor.execute("""
                    UPDATE sessions SET
                        end_time = ?,
                        threats_disarmed = threats_disarmed + 1,
                        status = 'SECURED'
                    WHERE session_id = ?
                """, (now_iso, session_id))

            elif event_type == "KEY_EXCHANGE":
                cursor.execute("""
                    UPDATE sessions SET
                        end_time = ?,
                        qkd_keys_exchanged = qkd_keys_exchanged + 1
                    WHERE session_id = ?
                """, (now_iso, session_id))

            else:
                cursor.execute("UPDATE sessions SET end_time = ? WHERE session_id = ?", (now_iso, session_id))

            conn.commit()

    def get_all_sessions(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Returns summarized overview of all recorded sessions."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT 
                    s.*,
                    (SELECT COUNT(*) FROM session_events e WHERE e.session_id = s.session_id) as event_count
                FROM sessions s
                ORDER BY s.start_time DESC
                LIMIT ?
            """, (limit,))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    def get_session_details(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Returns full session summary along with all historical events."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM sessions WHERE session_id = ?", (session_id,))
            session_row = cursor.fetchone()
            if not session_row:
                return None

            cursor.execute("""
                SELECT * FROM session_events 
                WHERE session_id = ? 
                ORDER BY timestamp DESC
            """, (session_id,))
            event_rows = cursor.fetchall()

            session_data = dict(session_row)
            events = []
            for ev in event_rows:
                ev_dict = dict(ev)
                try:
                    ev_dict["details"] = json.loads(ev_dict["details"]) if ev_dict["details"] else {}
                except Exception:
                    pass
                events.append(ev_dict)

            session_data["events"] = events
            return session_data

    def clear_all(self):
        """Clears all session histories."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM session_events")
            cursor.execute("DELETE FROM sessions")
            conn.commit()


# Global Singleton Instance
session_db = SessionDatabase()
