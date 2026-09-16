"""
Auth package providing authenticated classical communications to prevent MITM attacks in QKD.
"""

from auth.channel import (
    AuthenticatedChannel,
    AuthenticatedMessage,
    ChannelAuthenticationError,
)

__all__ = [
    "AuthenticatedChannel",
    "AuthenticatedMessage",
    "ChannelAuthenticationError",
]
