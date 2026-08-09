from datetime import date, datetime

from fastapi import APIRouter, Depends

from ..deps import require_user
from ..models import User
from ..schemas import MeOut, UserOut

router = APIRouter(prefix="/api", tags=["me"])


@router.get("/me", response_model=MeOut)
def me(user: User = Depends(require_user)) -> MeOut:
    return MeOut(
        user=UserOut.model_validate(user),
        today=date.today(),
        server_time=datetime.now(),
    )
