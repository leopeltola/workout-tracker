from __future__ import annotations

from dataclasses import dataclass

import httpx

from .config import settings

AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
TOKEN_URL = "https://github.com/login/oauth/access_token"  # noqa: S105
USER_URL = "https://api.github.com/user"
SCOPE = "read:user user:email"


@dataclass
class GitHubProfile:
    provider_id: str
    username: str
    email: str | None
    avatar_url: str | None


def build_authorize_url(state: str) -> str:
    params = {
        "client_id": settings.github_client_id,
        "redirect_uri": settings.github_redirect_uri,
        "scope": SCOPE,
        "state": state,
    }
    return str(httpx.URL(AUTHORIZE_URL, params=params))


async def exchange_code(code: str) -> str:
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            TOKEN_URL,
            data={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
                "redirect_uri": settings.github_redirect_uri,
            },
            headers={"Accept": "application/json"},
        )
        resp.raise_for_status()
        data = resp.json()
    if "access_token" not in data:
        raise ValueError(data.get("error_description") or data.get("error") or "OAuth failed")
    return str(data["access_token"])


async def fetch_profile(access_token: str) -> GitHubProfile:
    async with httpx.AsyncClient(timeout=15) as client:
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": settings.app_name,
        }
        user_resp = await client.get(USER_URL, headers=headers)
        user_resp.raise_for_status()
        user = user_resp.json()

        email: str | None = user.get("email")
        if not email:
            emails_resp = await client.get(f"{USER_URL}/emails", headers=headers)
            if emails_resp.status_code == 200:
                primary = next((e for e in emails_resp.json() if e.get("primary")), None)
                if primary:
                    email = primary.get("email")

    return GitHubProfile(
        provider_id=str(user["id"]),
        username=str(user["login"]),
        email=email,
        avatar_url=user.get("avatar_url"),
    )
