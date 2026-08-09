from unittest.mock import AsyncMock

from app.github import GitHubProfile
from app.models import AuthIdentity, User
from app.routers import auth as auth_router
from app.security import issue_oauth_state


def _stub_github(monkeypatch, profile):
    monkeypatch.setattr(auth_router, "exchange_code", AsyncMock(return_value="fake-token"))
    monkeypatch.setattr(
        auth_router, "fetch_profile", AsyncMock(return_value=GitHubProfile(**profile))
    )


def _valid_state_cookie(client):
    state = issue_oauth_state()
    client.cookies.set("wt_oauth_state", state)
    return state


def test_callback_success_flow(client, db_session, monkeypatch):
    _stub_github(
        monkeypatch,
        {
            "provider_id": "12345",
            "username": "leopeltola",
            "email": "leopeltola@gmail.com",
            "avatar_url": None,
        },
    )
    state = _valid_state_cookie(client)

    resp = client.get(
        "/api/auth/callback",
        params={"code": "real-code", "state": state},
        follow_redirects=False,
    )

    assert resp.status_code == 302
    assert resp.headers["location"] == "/"
    assert "wt_session" in resp.cookies

    user = db_session.query(User).filter_by(username="leopeltola").one_or_none()
    assert user is not None
    assert db_session.query(AuthIdentity).filter_by(user_id=user.id).one_or_none() is not None

    me = client.get("/api/me")
    assert me.status_code == 200
    assert me.json()["user"]["username"] == "leopeltola"


def test_callback_rejects_mismatched_state(client, db_session):
    state = issue_oauth_state()
    resp = client.get(
        "/api/auth/callback",
        params={"code": "x", "state": state},
        follow_redirects=False,
    )
    assert resp.status_code == 302
    assert resp.headers["location"] == "/login?error=state"


def test_callback_rejects_disallowed_user(client, db_session, monkeypatch):
    _stub_github(
        monkeypatch,
        {
            "provider_id": "999",
            "username": "somebodyelse",
            "email": None,
            "avatar_url": None,
        },
    )
    state = _valid_state_cookie(client)
    resp = client.get(
        "/api/auth/callback",
        params={"code": "real-code", "state": state},
        follow_redirects=False,
    )
    assert resp.status_code == 302
    assert resp.headers["location"] == "/login?error=not_allowed"
