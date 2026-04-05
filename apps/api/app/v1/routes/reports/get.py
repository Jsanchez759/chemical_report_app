from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models.reports_users import UserReport
from app.models.user import User
from app.services import get_db, limiter
from app.v1.dependencies.auth import get_current_user
from app.v1.schemas.reports import ReportDetailResponse

logger = get_logger(__name__)

router = APIRouter()


@router.get("/{report_id}", response_model=ReportDetailResponse)
@limiter.limit("20/minute")
async def get_report_by_id(
    request: Request,
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportDetailResponse:
    logger.info(
        "get_report_started",
        user_name=current_user.username,
        report_id=report_id,
    )

    try:
        report = (
            db.query(UserReport)
            .filter(
                UserReport.id == report_id,
                UserReport.user_id == current_user.id,
            )
            .first()
        )

        if not report:
            raise HTTPException(status_code=404, detail="Report not found")

        logger.info(
            "get_report_completed",
            user_name=current_user.username,
            report_id=report.id,
        )
        return ReportDetailResponse(
            id=report.id,
            user_id=report.user_id,
            title=report.title,
            prompt=report.prompt,
            chemical_compound=report.chemical_compound,
            content=report.content,
            pdf_url=report.pdf_url,
            tokens_used=report.tokens_used,
            created_at=report.created_at,
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(
            "get_report_failed",
            user_name=current_user.username,
            report_id=report_id,
            error=str(exc),
        )
        raise HTTPException(status_code=500, detail="Failed to get report")
