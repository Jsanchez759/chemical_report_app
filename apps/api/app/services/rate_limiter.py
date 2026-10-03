from fastapi import Request
from slowapi import Limiter
from app.core.security import decode_token


def _rate_limit_key(request: Request) -> str:
    authorization = request.headers.get("authorization", "")
    if authorization.lower().startswith("bearer "):
        payload = decode_token(authorization[7:].strip())
        if payload and payload.get("type") == "access" and payload.get("user_id"):
            return "user:" + str(payload["user_id"])

    # Do not trust client-provided forwarding headers for unauthenticated requests.
    if request.client and request.client.host:
        return "ip:" + request.client.host
    return "ip:unknown"


limiter = Limiter(
    key_func=_rate_limit_key,
    default_limits=["100/minute", "1000/day"],
)
