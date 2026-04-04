from pydantic import BaseModel, Field
from datetime import datetime


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