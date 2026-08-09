from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .models import User, UserSession


def _sign(value: str, secret: str) -> str:
    digest = hmac.new(secret.encode(), value.encode(), hashlib.sha256).hexdigest()
    return f"{value}.{digest}"


def _verify(value: str, secret: str) -> str | None:
    if "." not in value:
        return None
    raw, _, sig = value.partition(".")
    if not hmac.compare_digest(_sign(raw, secret).split(".", 1)[1], sig):
        return None
    return raw


def issue_oauth_state() -> str:
    return _sign(secrets.token_urlsafe(16), settings.session_secret)


def verify_oauth_state(state: str | None) -> bool:
    return bool(state and _verify(state, settings.session_secret))


def create_session(db: Session, user: User) -> UserSession:
    token = secrets.token_urlsafe(32)
    session = UserSession(
        user_id=user.id,
        token=token,
        expires_at=datetime.now(UTC) + timedelta(days=settings.session_ttl_days),
    )
    db.add(session)
    db.commit()
    return session


def get_user_by_token(db: Session, token: str | None) -> User | None:
    if not token:
        return None
    session = db.scalar(
        select(UserSession).where(
            UserSession.token == token, UserSession.expires_at > datetime.now(UTC)
        )
    )
    return session.user if session else None


def find_user_by_identity(db: Session, provider: str, provider_id: str) -> User | None:
    from .models import AuthIdentity

    identity = db.scalar(
        select(AuthIdentity).where(
            AuthIdentity.provider == provider,
            AuthIdentity.provider_id == provider_id,
        )
    )
    return identity.user if identity else None
