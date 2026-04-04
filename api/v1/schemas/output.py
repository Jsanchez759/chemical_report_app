from datetime import datetime

from pydantic import BaseModel


class ChemicalReportResponse(BaseModel):
    id: int
    title: str
    pdf_url: str
    created_at: datetime
    
    class Config:
        from_attributes = True
