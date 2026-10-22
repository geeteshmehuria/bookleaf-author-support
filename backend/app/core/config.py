import os
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
EXAMPLE_JWT_SECRET = "supersecretjwtkey_replace_in_production_min32chars"

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

    @field_validator("JWT_SECRET")
    @classmethod
    def jwt_secret_long_enough(cls, v: str) -> str:
        # A short secret can be brute-forced, and then anyone can forge an admin token.
        if len(v) < 32:
            raise ValueError("JWT_SECRET must be at least 32 characters")
        return v

    @model_validator(mode="after")
    def no_example_secret_in_production(self):
        # The .env.example value is public on GitHub; with it anyone could sign an admin token.
        if self.ENVIRONMENT == "production" and self.JWT_SECRET == EXAMPLE_JWT_SECRET:
            raise ValueError("JWT_SECRET is still the example value. Set a real secret in production")
        return self

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    model_config = SettingsConfigDict(
        env_file=(str(BACKEND_DIR / ".env"), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

settings = Settings()
