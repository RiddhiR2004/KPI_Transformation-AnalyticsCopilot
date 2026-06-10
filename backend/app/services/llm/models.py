from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

class LLMCallDetails(BaseModel):
    provider: str
    model: str
    step_name: str
    duration_seconds: float
    success: bool
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    total_tokens: Optional[int] = None
    error_message: Optional[str] = None
    parsing_error: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
