from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # App
    APP_NAME: str = "System Operator API"
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"

    # Supabase
    SUPABASE_URL: str
    SUPABASE_KEY: str
    SUPABASE_SERVICE_KEY: Optional[str] = None

    # IA APIs
    GEMINI_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    AI_PROVIDER: str = "gemini"

    # Scraper
    SCRAPER_HEADLESS: bool = True
    SCRAPER_TIMEOUT: int = 30000
    UNSPLASH_ACCESS_KEY: Optional[str] = None

    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()