import time

from fastapi import Request

from app.core.context import (generate_request_id, reset_request_id,
                              set_request_id)
from app.core.logging import get_logger

logger = get_logger(__name__)


async def logging_middleware(request: Request, call_next):
    """Log HTTP requests with request ID and timing."""
    
    # Generate and set request ID
    request_id = generate_request_id()
    request_token = set_request_id(request_id)
    
    start_time = time.time()
    
    # Log request
    logger.info(
        "request_started",
        request_id=request_id,
        method=request.method,
        path=request.url.path,
        query_params=dict(request.query_params),
    )
    
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        
        # Log response
        logger.info(
            "request_completed",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_seconds=round(process_time, 3),
        )
        
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = str(process_time)
        return response

    except Exception as exc:
        process_time = time.time() - start_time
        logger.error(
            "request_failed",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            duration_seconds=round(process_time, 3),
            error=str(exc),
        )
        raise
    finally:
        reset_request_id(request_token)
