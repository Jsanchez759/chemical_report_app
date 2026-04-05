from datetime import datetime

from pydantic import BaseModel


class AdminUserSummary(BaseModel):
    id: int
    username: str
    email: str
    role: str
    created_at: datetime
    reports_count: int


class AdminUsersResponse(BaseModel):
    total: int
    limit: int
    offset: int
    users: list[AdminUserSummary]


class AdminUserReportSummary(BaseModel):
    id: int
    title: str
    pdf_url: str
    created_at: datetime


class AdminUserReportsResponse(BaseModel):
    user_id: int
    total: int
    limit: int
    offset: int
    reports: list[AdminUserReportSummary]


class AdminReportSummary(BaseModel):
    id: int
    user_id: int
    username: str
    title: str
    pdf_url: str
    created_at: datetime
    tokens_used: int


class AdminReportsResponse(BaseModel):
    total: int
    limit: int
    offset: int
    reports: list[AdminReportSummary]
