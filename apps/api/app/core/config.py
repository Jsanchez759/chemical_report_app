from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Chemical Report API"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"
    
    # Database
    database_url: str = "sqlite:///./test.db"
    
    # Security
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # LLM
    llm_api_key: str = ""
    llm_model: str = ""
    openai_base_url: str = ""
    
    class Config:
        env_file = ".env"


settings = Settings()
