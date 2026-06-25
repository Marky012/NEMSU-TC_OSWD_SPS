from slowapi import Limiter
from slowapi.util import get_remote_address
from app.config import settings

# Uses in-memory storage by default.
# Fine for single-instance deployment; state resets on restart.
# For multi-instance or persistent rate limits, configure Redis storage.
limiter = Limiter(key_func=get_remote_address, default_limits=[settings.API_RATE_LIMIT])
