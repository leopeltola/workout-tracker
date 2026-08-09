from fastapi import Cookie, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .models import User
from .security import get_user_by_token


async def require_user(
    request: Request,
    db: Session = Depends(get_db),
    session_token: str | None = Cookie(default=None, alias=settings.session_cookie_name),
) -> User:
    user = get_user_by_token(db, session_token)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Cookie"},
        )
    return user
