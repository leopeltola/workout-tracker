from __future__ import annotations

from fastapi import APIRouter, Cookie, Depends, HTTPException, Query, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..github import build_authorize_url, exchange_code, fetch_profile
from ..models import AuthIdentity, User, UserSession
from ..security import create_session, find_user_by_identity, issue_oauth_state, verify_oauth_state

router = APIRouter(prefix="/api/auth", tags=["auth"])

_STATE_COOKIE = "wt_oauth_state"

_PROVIDERS = {"github"}


def _safe_next_url(next: str | None) -> str:
    if next and next.startswith("/") and not next.startswith("//"):
        return next
    return "/"


@router.get("/login")
async def login(
    provider: str = Query(default="github"),
    next: str | None = Query(default=None),
) -> RedirectResponse:
    if provider not in _PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")
    state = issue_oauth_state()
    if provider == "github":
        url = build_authorize_url(state)
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")
    redirect = RedirectResponse(url=url, status_code=302)
    redirect.set_cookie(
        _STATE_COOKIE,
        state,
        max_age=600,
        httponly=True,
        secure=settings.env == "production",
        samesite="lax",
        path="/",
    )
    return redirect


@router.get("/callback")
async def callback(
    request: Request,
    response: Response,
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    next: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> RedirectResponse:
    target = _safe_next_url(next)
    stored_state = request.cookies.get(_STATE_COOKIE)
    if not code or not verify_oauth_state(state) or state != stored_state:
        return RedirectResponse(url="/login?error=state", status_code=302)
    try:
        access_token = await exchange_code(code)
        profile = await fetch_profile(access_token)
    except Exception:
        return RedirectResponse(url="/login?error=oauth", status_code=302)

    key = f"github:{profile.username.lower()}"
    allow = settings.allowed_identity_set
    if allow and key not in allow:
        return RedirectResponse(url="/login?error=not_allowed", status_code=302)

    user = _upsert_identity(db, provider="github", profile=profile)
    session = create_session(db, user)

    response = RedirectResponse(url=target, status_code=302)
    response.delete_cookie(_STATE_COOKIE, path="/")
    response.set_cookie(
        settings.session_cookie_name,
        session.token,
        max_age=settings.session_ttl_days * 24 * 3600,
        httponly=True,
        secure=settings.env == "production",
        samesite="lax",
        path="/",
    )
    return response


def _upsert_identity(db: Session, provider: str, profile) -> User:
    identity = find_user_by_identity(db, provider, profile.provider_id)
    if identity:
        user = identity.user
        if profile.email and profile.email != identity.email:
            identity.email = profile.email
            user.email = profile.email
        if profile.avatar_url and profile.avatar_url != user.avatar_url:
            user.avatar_url = profile.avatar_url
        db.commit()
        db.refresh(user)
        return user

    existing = db.scalar(select(User).where(User.username == profile.username))
    if existing:
        username = profile.username
        n = 2
        while db.scalar(select(User).where(User.username == username)):
            username = f"{profile.username}{n}"
            n += 1
        profile.username = username  # type: ignore[attr-defined]

    user = User(
        username=profile.username,
        email=profile.email,
        avatar_url=profile.avatar_url,
    )
    db.add(user)
    db.flush()
    db.add(
        AuthIdentity(
            user_id=user.id,
            provider=provider,
            provider_id=profile.provider_id,
            email=profile.email,
        )
    )
    db.commit()
    db.refresh(user)
    return user


@router.post("/logout")
async def logout(
    response: Response,
    db: Session = Depends(get_db),
    session_token: str | None = Cookie(default=None, alias=settings.session_cookie_name),
) -> dict:
    if session_token:
        sess = db.scalar(select(UserSession).where(UserSession.token == session_token))
        if sess:
            db.delete(sess)
            db.commit()
    response.delete_cookie(settings.session_cookie_name, path="/")
    return {"ok": True}
