from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")

    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "productivity_tracker"

    jwt_secret: str = "change-me"
    jwt_expire_minutes: int = 720
    jwt_algorithm: str = "HS256"

    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"

    allowed_origins: str = "http://localhost:3000"

    eod_hour: int = 17
    eod_minute: int = 0
    eod_days: str = "mon-fri"


settings = Settings()
