from fastapi import Request
from slowapi import Limiter


def _get_client_ip(request: Request) -> str:
    forwarded_for = (request.headers.get("x-forwarded-for") or "").strip()
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()

    real_ip = (request.headers.get("x-real-ip") or "").strip()
    if real_ip:
        return real_ip

    cf_ip = (request.headers.get("cf-connecting-ip") or "").strip()
    if cf_ip:
        return cf_ip

    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"


limiter = Limiter(
    key_func=_get_client_ip,
    default_limits=["100/minute", "1000/day"],
)
