from datetime import datetime

from pydantic import BaseModel


class ChemicalReportResponse(BaseModel):
    id: int
    title: str
    content: str
    created_at: datetime
    
    class Config:
        from_attributes = True
