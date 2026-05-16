from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "productivity_tracker"

    jwt_secret: str = "change-me"
    jwt_expire_minutes: int = 720
    jwt_algorithm: str = "HS256"

    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_embed_model: str = "text-embedding-3-small"

    eod_hour: int = 17
    eod_minute: int = 0
    eod_days: str = "mon-fri"


settings = Settings()
