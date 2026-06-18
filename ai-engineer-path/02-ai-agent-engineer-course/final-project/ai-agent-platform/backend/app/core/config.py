from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://agent:agent123@localhost:5432/agent_platform"
    REDIS_URL: str = "redis://localhost:6379/0"
    SECRET_KEY: str = "dev-secret-key-change-in-production"

    # AI 模型 API Keys
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""

    # AI 模型 BASE_URL（支持自定义 API 地址）
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    ANTHROPIC_BASE_URL: str = "https://api.anthropic.com"

    # 默认模型配置
    DEFAULT_LLM_PROVIDER: str = "openai"
    DEFAULT_MODEL: str = "gpt-4o-mini"

    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]
    DEBUG: bool = True

    class Config:
        env_file = ".env"


settings = Settings()
