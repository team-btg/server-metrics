import uuid
import time

def generate_uuid() -> uuid.UUID:
    """Generates a new UUID v4."""
    return uuid.uuid4()

def now_ms() -> float:
    """Returns the current time in milliseconds since epoch."""
    return time.time() * 1000