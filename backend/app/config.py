import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )
    
    ENVIRONMENT: str = "development"
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/oswd_sps"
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    ALLOWED_ORIGINS_STR: str = "*"

    @property
    def ALLOWED_ORIGINS(self) -> list[str]:
        if self.ALLOWED_ORIGINS_STR == "*":
            return ["*"]
        return [o.strip() for o in self.ALLOWED_ORIGINS_STR.split(",") if o.strip()]
    
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "oswd@nemsu.edu.ph"
    SMTP_FROM_NAME: str = "NEMSU OSWD Office"
    
    ADMIN_INITIAL_EMAIL: str = "admin@nemsu.edu.ph"
    ADMIN_INITIAL_PASSWORD: str
    
    UPLOAD_DIR: str = "uploads"
    BACKUP_DIR: str = "backups"

    LOGIN_RATE_LIMIT: str = "5/minute"
    API_RATE_LIMIT: str = "100/minute"
    
    CSRF_ENABLED: bool = True
    CSRF_SECRET_KEY: str = ""
    
    FRONTEND_URL: str = "http://localhost:5173"

    EMAIL_MAX_RETRIES: int = 3
    EMAIL_RETRY_DELAY_SECONDS: int = 2

# Instantiate settings singleton
settings = Settings()

# Ensure Upload and Backup directories exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.BACKUP_DIR, exist_ok=True)
