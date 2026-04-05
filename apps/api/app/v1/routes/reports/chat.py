from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models.report_chat import ReportChatMessage
from app.models.reports_users import UserReport
from app.models.user import User
from app.services import get_db, limiter, llm_service
from app.v1.dependencies.auth import get_current_user
from app.v1.schemas.reports import (ReportChatHistoryResponse,
                                    ReportChatMessageItem, ReportChatRequest,
                                    ReportChatResponse)

logger = get_logger(__name__)

router = APIRouter()

MAX_MEMORY_MESSAGES = 10


def _build_chat_prompt(*, report: UserReport, history: list[ReportChatMessage], user_message: str) -> str:
    history_lines = []
    for msg in history:
        history_lines.append(f"{msg.role.upper()}: {msg.content}")

    history_text = "\n".join(history_lines) if history_lines else "No previous messages."

    return (
        f"REPORT TITLE:\n{report.title}\n\n"
        f"CHEMICAL COMPOUND:\n{report.chemical_compound}\n\n"
        f"REPORT CONTENT:\n{report.content}\n\n"
        f"LAST {MAX_MEMORY_MESSAGES} CHAT MESSAGES:\n{history_text}\n\n"
        f"NEW USER MESSAGE:\n{user_message}"
    )


@router.post("/{report_id}/chat", response_model=ReportChatResponse)
@limiter.limit("30/minute")
async def chat_with_report(
    request: Request,
    report_id: int,
    chat_request: ReportChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportChatResponse:
    logger.info(
        "report_chat_started",
        user_id=current_user.id,
        report_id=report_id,
        message_length=len(chat_request.message),
    )

    try:
        report = (
            db.query(UserReport)
            .filter(UserReport.id == report_id, UserReport.user_id == current_user.id)
            .first()
        )
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")

        memory_messages = (
            db.query(ReportChatMessage)
            .filter(
                ReportChatMessage.report_id == report_id,
                ReportChatMessage.user_id == current_user.id,
            )
            .order_by(ReportChatMessage.created_at.desc())
            .limit(MAX_MEMORY_MESSAGES)
            .all()
        )
        memory_messages = list(reversed(memory_messages))

        prompt = _build_chat_prompt(
            report=report,
            history=memory_messages,
            user_message=chat_request.message,
        )
        system_prompt = (
            "You are a chemistry report assistant. "
            "Answer using the provided report context and conversation memory. "
            "If the answer is not supported by the report, say it clearly."
        )

        assistant_answer = await llm_service.call_llm(prompt=prompt, system_prompt=system_prompt)

        user_msg = ReportChatMessage(
            report_id=report_id,
            user_id=current_user.id,
            role="user",
            content=chat_request.message,
        )
        assistant_msg = ReportChatMessage(
            report_id=report_id,
            user_id=current_user.id,
            role="assistant",
            content=assistant_answer,
        )
        db.add(user_msg)
        db.add(assistant_msg)
        db.commit()
        db.refresh(assistant_msg)

        logger.info(
            "report_chat_completed",
            user_id=current_user.id,
            report_id=report_id,
            memory_messages_used=len(memory_messages),
            answer_length=len(assistant_answer),
        )

        return ReportChatResponse(
            report_id=report_id,
            answer=assistant_answer,
            memory_messages_used=len(memory_messages),
            created_at=assistant_msg.created_at,
        )

    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        logger.error(
            "report_chat_failed",
            user_id=current_user.id,
            report_id=report_id,
            error=str(exc),
        )
        raise HTTPException(status_code=500, detail="Failed to chat with report")


@router.get("/{report_id}/chat/history", response_model=ReportChatHistoryResponse)
@limiter.limit("30/minute")
async def get_report_chat_history(
    request: Request,
    report_id: int,
    limit: int = Query(default=30, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportChatHistoryResponse:
    logger.info(
        "report_chat_history_started",
        user_id=current_user.id,
        report_id=report_id,
        limit=limit,
    )

    try:
        report = (
            db.query(UserReport)
            .filter(UserReport.id == report_id, UserReport.user_id == current_user.id)
            .first()
        )
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")

        rows = (
            db.query(ReportChatMessage)
            .filter(
                ReportChatMessage.report_id == report_id,
                ReportChatMessage.user_id == current_user.id,
            )
            .order_by(ReportChatMessage.created_at.desc())
            .limit(limit)
            .all()
        )
        rows = list(reversed(rows))

        messages = [
            ReportChatMessageItem(
                id=row.id,
                role=row.role,
                content=row.content,
                created_at=row.created_at,
            )
            for row in rows
        ]

        logger.info(
            "report_chat_history_completed",
            user_id=current_user.id,
            report_id=report_id,
            returned=len(messages),
        )
        return ReportChatHistoryResponse(report_id=report_id, messages=messages)

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(
            "report_chat_history_failed",
            user_id=current_user.id,
            report_id=report_id,
            error=str(exc),
        )
        raise HTTPException(status_code=500, detail="Failed to get chat history")
