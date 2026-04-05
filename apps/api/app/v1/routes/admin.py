from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models.reports_users import UserReport
from app.models.user import User
from app.services import get_db, limiter
from app.v1.dependencies.auth import get_current_admin
from app.v1.schemas.admin import (AdminReportsResponse, AdminReportSummary,
                                  AdminUserReportsResponse,
                                  AdminUserReportSummary, AdminUsersResponse,
                                  AdminUserSummary)

logger = get_logger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=AdminUsersResponse)
@limiter.limit("20/minute")
async def list_users_for_admin(
    request: Request,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> AdminUsersResponse:
    logger.info(
        "admin_list_users_started",
        admin_id=current_admin.id,
        limit=limit,
        offset=offset,
    )
    try:
        total = db.query(User).count()
        rows = (
            db.query(
                User.id,
                User.username,
                User.email,
                User.role,
                User.created_at,
                func.count(UserReport.id).label("reports_count"),
            )
            .outerjoin(UserReport, UserReport.user_id == User.id)
            .group_by(User.id)
            .order_by(User.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

        users = [
            AdminUserSummary(
                id=row.id,
                username=row.username,
                email=row.email,
                role=row.role,
                created_at=row.created_at,
                reports_count=row.reports_count,
            )
            for row in rows
        ]

        logger.info(
            "admin_list_users_completed",
            admin_id=current_admin.id,
            returned=len(users),
            total=total,
        )
        return AdminUsersResponse(total=total, limit=limit, offset=offset, users=users)
    except Exception as exc:
        logger.error("admin_list_users_failed", admin_id=current_admin.id, error=str(exc))
        raise HTTPException(status_code=500, detail="Failed to list users")


@router.get("/users/{user_id}/reports", response_model=AdminUserReportsResponse)
@limiter.limit("30/minute")
async def list_reports_by_user_for_admin(
    request: Request,
    user_id: int,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> AdminUserReportsResponse:
    logger.info(
        "admin_list_user_reports_started",
        admin_id=current_admin.id,
        user_id=user_id,
        limit=limit,
        offset=offset,
    )
    try:
        target_user = db.query(User).filter(User.id == user_id).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")

        total = db.query(UserReport).filter(UserReport.user_id == user_id).count()
        rows = (
            db.query(UserReport)
            .filter(UserReport.user_id == user_id)
            .order_by(UserReport.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        reports = [
            AdminUserReportSummary(
                id=row.id,
                title=row.title,
                pdf_url=row.pdf_url,
                created_at=row.created_at,
            )
            for row in rows
        ]

        logger.info(
            "admin_list_user_reports_completed",
            admin_id=current_admin.id,
            user_id=user_id,
            returned=len(reports),
            total=total,
        )
        return AdminUserReportsResponse(
            user_id=user_id,
            total=total,
            limit=limit,
            offset=offset,
            reports=reports,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(
            "admin_list_user_reports_failed",
            admin_id=current_admin.id,
            user_id=user_id,
            error=str(exc),
        )
        raise HTTPException(status_code=500, detail="Failed to list reports for user")


@router.get("/reports", response_model=AdminReportsResponse)
@limiter.limit("30/minute")
async def list_all_reports_for_admin(
    request: Request,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> AdminReportsResponse:
    logger.info(
        "admin_list_reports_started",
        admin_id=current_admin.id,
        limit=limit,
        offset=offset,
    )
    try:
        total = db.query(UserReport).count()
        rows = (
            db.query(UserReport, User.username)
            .join(User, User.id == UserReport.user_id)
            .order_by(UserReport.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

        reports = [
            AdminReportSummary(
                id=report.id,
                user_id=report.user_id,
                username=username,
                title=report.title,
                pdf_url=report.pdf_url,
                created_at=report.created_at,
                tokens_used=report.tokens_used,
            )
            for report, username in rows
        ]

        logger.info(
            "admin_list_reports_completed",
            admin_id=current_admin.id,
            returned=len(reports),
            total=total,
        )
        return AdminReportsResponse(total=total, limit=limit, offset=offset, reports=reports)
    except Exception as exc:
        logger.error("admin_list_reports_failed", admin_id=current_admin.id, error=str(exc))
        raise HTTPException(status_code=500, detail="Failed to list reports")
