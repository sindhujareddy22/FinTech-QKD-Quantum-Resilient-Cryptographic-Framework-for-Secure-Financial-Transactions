"""
Auth Package: Classical Channel Message Authentication
======================================================
Provides cryptographic integrity and origin authentication for public channel messages.
"""

from .hmac_auth import (
    AuthenticatedPacket,
    HMACAuthenticator,
    AuthenticationError,
)

__all__ = [
    "AuthenticatedPacket",
    "HMACAuthenticator",
    "AuthenticationError",
]
