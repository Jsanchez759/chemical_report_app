from openai import AsyncOpenAI

from api.core.config import settings
from api.core.logging import get_logger

logger = get_logger(__name__)

class LLMService:
    def __init__(self):
        self.client = AsyncOpenAI(
            api_key=settings.llm_api_key,
            base_url=settings.openai_base_url,
        )
        self.model = settings.llm_model
    
    async def call_llm(self, prompt: str, system_prompt: str = None, temperature: float = 0.7) -> str:
                
        logger.info(
            "llm_request_started",
            model=self.model,
            prompt_length=len(prompt),
        )
        
        try:
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
                
            messages.append({"role": "user", "content": prompt})
            
            
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
            )
            
            llm_response = response.choices[0].message.content
            
            logger.info(
                "llm_request_completed",
                model=self.model,
                tokens_used=response.usage.total_tokens,
                response_length=len(llm_response),
            )
            
            return llm_response
        
        except Exception as exc:
            logger.error(
                "llm_request_failed",
                model=self.model,
                error=str(exc),
            )
            raise


llm_service = LLMService()
