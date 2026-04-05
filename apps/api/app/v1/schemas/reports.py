from pydantic import BaseModel, Field, PastDate
from datetime import datetime

class GetReportsRequest(BaseModel):
    filter_time: PastDate | None = Field(
        default=None,
        description="Optional filter for reports created after this time (ISO format)",
    )


class GetReportsResponse(BaseModel):
    ids: list[int]
    reports_urls: list[str]


class ChemicalReportRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    prompt: str = Field(..., min_length=1)
    chemical_compound: str = Field(..., min_length=1)
    
    class Config:
        json_schema_extra = {
            "example": {
                "title": "Chemical Analysis Report",
                "prompt": "Analysis of chemical compound X",
                "chemical_compound": "C6H12O6"
            }
        }


class ChemicalReportResponse(BaseModel):
    id: int
    title: str
    pdf_url: str
    created_at: datetime
    
    class Config:
        from_attributes = True
        
        
class DeleteReportsRequest(BaseModel):
    filter_time: PastDate | None = Field(
        default=None,
        description="Optional filter for reports created after this time (ISO format)",
    )
    ids: list[int] | None = Field(
        default=None,
        description="Optional list of report IDs to delete. If provided, only these reports will be deleted.",
    )


class DeleteReportsResponse(BaseModel):
    ids: list[int]


class ReportDetailResponse(BaseModel):
    id: int
    user_id: int
    title: str
    prompt: str
    chemical_compound: str
    content: str
    pdf_url: str
    tokens_used: int
    created_at: datetime


class ReportChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="User message for report chat")


class ReportChatResponse(BaseModel):
    report_id: int
    answer: str
    memory_messages_used: int
    created_at: datetime


class ReportChatMessageItem(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime


class ReportChatHistoryResponse(BaseModel):
    report_id: int
    messages: list[ReportChatMessageItem]
