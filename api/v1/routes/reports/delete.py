from pathlib import Path
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from api.core.logging import get_logger
from api.models.reports_users import UserReport
from api.models.user import User
from api.services import get_db, limiter
from api.v1.dependencies.auth import get_current_user
from api.v1.schemas.reports import DeleteReportsRequest, DeleteReportsResponse
from src.utils.pdf_generator import PDF_OUTPUT_DIR

logger = get_logger(__name__)

router = APIRouter(prefix="/reports", tags=["reports"])


def _delete_local_pdf(pdf_url: str) -> None:
    parsed_url = urlparse(pdf_url)
    file_name = Path(parsed_url.path).name
    if not file_name:
        return

    pdf_path = (PDF_OUTPUT_DIR / file_name).resolve()
    output_dir = PDF_OUTPUT_DIR.resolve()

    # Avoid deleting anything outside the configured PDF output directory.
    if output_dir not in pdf_path.parents:
        return

    if pdf_path.exists():
        pdf_path.unlink()


@router.delete("/delete_reports", response_model=DeleteReportsResponse)
@limiter.limit("5/minute")
async def delete_reports(
    request: Request,
    delete_request: DeleteReportsRequest = Depends(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DeleteReportsResponse:
    logger.info(
        "delete_reports_started",
        user_name=current_user.username,
        filter_time=delete_request.filter_time,
        ids=delete_request.ids,
    )

    try:
        query = db.query(UserReport).filter(UserReport.user_id == current_user.id)
        if delete_request.filter_time:
            query = query.filter(UserReport.created_at >= delete_request.filter_time)
        if delete_request.ids:
            query = query.filter(UserReport.id.in_(delete_request.ids))

        reports_to_delete = query.all()
        deleted_ids = [report.id for report in reports_to_delete]

        for report in reports_to_delete:
            try:
                _delete_local_pdf(report.pdf_url)
            except Exception as file_exc:
                logger.warning(
                    "delete_report_pdf_failed",
                    report_id=report.id,
                    pdf_url=report.pdf_url,
                    error=str(file_exc),
                )
            db.delete(report)

        db.commit()

        logger.info(
            "delete_reports_completed",
            user_name=current_user.username,
            deleted_count=len(deleted_ids),
        )
        return DeleteReportsResponse(ids=deleted_ids)

    except Exception as exc:
        db.rollback()
        logger.error(
            "delete_reports_failed",
            user_name=current_user.username,
            error=str(exc),
        )
        raise HTTPException(status_code=500, detail="Failed to delete reports")
