from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models.reports_users import UserReport
from app.models.user import User
from app.services import get_db, limiter
from app.v1.dependencies.auth import get_current_user
from app.v1.schemas.reports import GetReportsRequest, GetReportsResponse

logger = get_logger(__name__)

router = APIRouter(prefix="/reports", tags=["reports"])

@router.get("/list_reports", response_model=GetReportsResponse)
@limiter.limit("10/minute")
async def list_reports(
    request: Request,
    list_request: GetReportsRequest = Depends(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GetReportsResponse:
    logger.info(
        "list_reports_started",
        user_name=current_user.username,
        filter_time=list_request.filter_time,
    )

    try:
        query = db.query(UserReport).filter(UserReport.user_id == current_user.id)
        if list_request.filter_time:
            query = query.filter(UserReport.created_at >= list_request.filter_time)

        reports = query.order_by(UserReport.created_at.desc()).all()
        report_ids = [report.id for report in reports]
        report_urls = [report.pdf_url for report in reports]
        
        logger.info(
            "list_reports_completed",
            user_name=current_user.username,
            report_count=len(report_ids),
        )
        
        return GetReportsResponse(ids=report_ids, reports_urls=report_urls)
    
    except Exception as exc:
        logger.error(
            "list_reports_failed",
            user_name=current_user.username,
            error=str(exc),
        )
        raise HTTPException(status_code=500, detail="Failed to list reports")
