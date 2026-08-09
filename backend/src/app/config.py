from functools import lru_cache
from urllib.parse import urlsplit, urlunsplit

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_POSTGRES_SCHEMES = {"postgres", "postgresql"}


def _with_psycopg_driver(url: str) -> str:
    """Normalize postgres://... to postgresql+psycopg://... so SQLAlchemy can
    resolve a driver. Coolify's default Postgres URL is postgres:// which has none."""
    parts = urlsplit(url)
    if parts.scheme in _POSTGRES_SCHEMES:
        scheme = "postgresql" if parts.scheme == "postgres" else parts.scheme
        return urlunsplit(
            (
                f"{scheme}+psycopg",
                parts.netloc,
                parts.path,
                parts.query,
                parts.fragment,
            )
        )
    return url


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

    @field_validator("database_url", mode="before")
    @classmethod
    def _normalize_database_url(cls, value: object) -> object:
        if isinstance(value, str):
            return _with_psycopg_driver(value)
        return value

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
