import contextvars
import uuid
from typing import Optional

# Context variable for storing request ID
request_id_context: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "request_id", default=None
)


def generate_request_id() -> str:
    """Generate a unique request ID."""
    return str(uuid.uuid4())


def set_request_id(request_id: str) -> contextvars.Token:
    """Set the request ID in context."""
    return request_id_context.set(request_id)


def get_request_id() -> Optional[str]:
    """Get the current request ID from context."""
    return request_id_context.get()


def reset_request_id(token: contextvars.Token) -> None:
    """Reset request ID context to previous value."""
    request_id_context.reset(token)
