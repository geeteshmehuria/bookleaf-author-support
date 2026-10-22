import os
from pydantic_settings import BaseSettings
from typing import List

from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    # Fixed app constants (safe defaults)
    PROJECT_NAME: str = "BookLeaf Author Support & Communication Portal"
    API_V1_STR: str = "/api/v1"
    
    # Required: no defaults, so the app fails fast if .env is missing them
    # Database
    DATABASE_URL: str
    
    # JWT
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    
    # AI (Gemini)
    # Optional: empty key = AI features fall back to manual mode
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = ""
    
    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    
    # Environment
    ENVIRONMENT: str = "development"
    PORT: int = 8000

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    class Config:
        env_file = (str(BACKEND_DIR / ".env"), ".env")
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()
