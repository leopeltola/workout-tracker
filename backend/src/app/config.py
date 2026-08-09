from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Workout Tracker"
    env: str = "development"

    # Database
    database_url: str = "sqlite:///./dev.db"

    # Web origin (used to build OAuth redirects)
    base_url: str = "http://localhost:8000"

    # Sessions
    session_cookie_name: str = "wt_session"
    session_ttl_days: int = 30
    session_secret: str = "change-me"  # noqa: S105 - dev default; override in production

    # Signup gate: comma-separated "provider:identifier" pairs, e.g. "github:leopeltola".
    # Empty means open signups.
    allowed_identities: str = "github:leopeltola"

    # GitHub OAuth
    github_client_id: str = ""
    github_client_secret: str = ""

    # Built frontend (served statically when present)
    static_dir: str = "frontend_dist"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def allowed_identity_set(self) -> set[str]:
        if not self.allowed_identities.strip():
            return set()
        return {item.strip().lower() for item in self.allowed_identities.split(",") if item.strip()}

    @property
    def github_redirect_uri(self) -> str:
        return f"{self.base_url.rstrip('/')}/api/auth/callback"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
