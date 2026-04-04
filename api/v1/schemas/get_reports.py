from pydantic import BaseModel, Field, PastDate

class GetReportsRequest(BaseModel):
    filter_time: PastDate | None = Field(
        default=None,
        description="Optional filter for reports created after this time (ISO format)",
    )


class GetReportsResponse(BaseModel):
    ids: list[int]
    reports_urls: list[str]
