import logging
import logging.handlers
import sys
from pathlib import Path

import structlog

from api.core.context import get_request_id


def add_request_id(logger, method_name, event_dict):
    """Add request ID to every log event."""
    request_id = get_request_id()
    if request_id:
        event_dict["request_id"] = request_id
    return event_dict


def configure_logging():
    """Configure structlog with JSON output, async support, and file persistence."""
    # Create logs directory if it doesn't exist
    logs_dir = Path(__file__).parent.parent / "logs"
    logs_dir.mkdir(exist_ok=True)

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    # Add stdout handler once.
    has_stdout_handler = any(
        isinstance(handler, logging.StreamHandler) and handler.stream is sys.stdout
        for handler in root_logger.handlers
    )
    if not has_stdout_handler:
        stream_handler = logging.StreamHandler(sys.stdout)
        stream_handler.setFormatter(logging.Formatter("%(message)s"))
        root_logger.addHandler(stream_handler)

    # Add rotating file handler once.
    log_file = str(logs_dir / "app.log")
    has_file_handler = any(
        isinstance(handler, logging.handlers.RotatingFileHandler)
        and getattr(handler, "baseFilename", "") == log_file
        for handler in root_logger.handlers
    )
    if not has_file_handler:
        file_handler = logging.handlers.RotatingFileHandler(
            log_file,
            maxBytes=10485760,  # 10MB
            backupCount=5,
        )
        file_handler.setFormatter(logging.Formatter("%(message)s"))
        root_logger.addHandler(file_handler)
    
    # Configure structlog
    structlog.configure(
        processors=[
            add_request_id,  # Add request ID to every log
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer(),
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str = __name__):
    """Get a structlog logger instance."""
    return structlog.get_logger(name)
