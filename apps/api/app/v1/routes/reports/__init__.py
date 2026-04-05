from fastapi import APIRouter

from app.v1.routes.reports.create import router as create_router
from app.v1.routes.reports.delete import router as delete_router
from app.v1.routes.reports.get import router as get_router
from app.v1.routes.reports.list import router as list_router

router = APIRouter(prefix="/reports", tags=["reports"])
router.include_router(create_router)
router.include_router(list_router)
router.include_router(delete_router)
router.include_router(get_router)

__all__ = ["router"]
