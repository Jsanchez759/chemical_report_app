from pydantic import BaseModel, Field


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
