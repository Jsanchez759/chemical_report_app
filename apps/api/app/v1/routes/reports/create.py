from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models.reports_users import UserReport
from app.models.user import User
from app.services import get_db, limiter
from app.v1.dependencies.auth import get_current_user
from app.v1.schemas.reports import ChemicalReportRequest, ChemicalReportResponse
from src.generate_report import generate_one_chemical_report
from src.utils.pdf_generator import generate_pdf_and_get_url

logger = get_logger(__name__) 

router = APIRouter()


@router.post("/generate_report", response_model=ChemicalReportResponse)
@limiter.limit("10/minute")
async def generate_report(
    request: Request,
    report_request: ChemicalReportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChemicalReportResponse:
    logger.info(
        "generate_report_started",
        title=report_request.title,
        prompt=report_request.prompt
    )
    
    try:
        report_content = await generate_one_chemical_report(
            prompt=report_request.prompt,
            chemical=report_request.chemical_compound,
        )

        new_report = UserReport(
            user_id=current_user.id,
            title=report_request.title,
            prompt=report_request.prompt,
            chemical_compound=report_request.chemical_compound,
            content=report_content,
            pdf_url="",
            tokens_used=len(report_content.split()),
        )
        db.add(new_report)
        db.commit()
        db.refresh(new_report)

        pdf_url = generate_pdf_and_get_url(
            report_id=new_report.id,
            title=new_report.title,
            content=new_report.content,
            base_url=str(request.base_url),
            chemical_compound=new_report.chemical_compound,
            prompt=new_report.prompt,
            tokens_used=new_report.tokens_used,
        )
        new_report.pdf_url = pdf_url
        db.commit()
        db.refresh(new_report)
        
        logger.info(
            "generate_report_completed",
            title=report_request.title,
            report_length=len(report_content),
            report_id=new_report.id,
            user_id=current_user.id,
            pdf_url=new_report.pdf_url,
        )
        
        return ChemicalReportResponse(
            id=new_report.id,
            title=new_report.title,
            pdf_url=new_report.pdf_url,
            created_at=new_report.created_at,
        )
    
    except Exception as exc:
        db.rollback()
        logger.error(
            "generate_report_failed",
            title=report_request.title,
            error=str(exc),
        )
        raise HTTPException(status_code=500, detail="Failed to generate report")
