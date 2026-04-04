from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from api.core.config import settings
from api.core.logging import configure_logging, get_logger
from api.middlewares import logging_middleware
from api.services import limiter
from api.services.db import Base, engine
from api.v1.routes.auth import router as v1_auth_router
from api.v1.routes.reports import router as v1_reports_router

# Configure logging
configure_logging()
logger = get_logger(__name__)

# Lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        "application_startup",
        app_name=settings.app_name,
        debug=settings.debug,
    )
    Base.metadata.create_all(bind=engine)
    yield
    logger.info(
        "application_shutdown",
        app_name=settings.app_name,
    )

app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    lifespan=lifespan,
)

# Add middlewares
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.middleware("http")(logging_middleware)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Include routers
app.include_router(v1_reports_router, prefix=settings.api_v1_prefix)
app.include_router(v1_auth_router, prefix=settings.api_v1_prefix)


@app.get("/")
async def root():
    return {"message": "Chemical Report API"}
