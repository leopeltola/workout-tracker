from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import require_user
from ..models import Exercise, User, WorkoutLog
from ..schemas import ExerciseOut

router = APIRouter(prefix="/api", tags=["exercises"])

# Don't suggest deleted/misspelled garbage; hard cap on results.
DEFAULT_LIMIT = 20


@router.get("/exercises", response_model=list[ExerciseOut])
def list_exercises(
    q: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=DEFAULT_LIMIT, ge=1, le=50),
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
) -> list[Exercise]:
    recency = func.max(WorkoutLog.log_date).label("last_used")
    stmt = (
        select(Exercise, recency)
        .join(WorkoutLog, WorkoutLog.exercise_id == Exercise.id)
        .where(Exercise.user_id == user.id)
        .group_by(Exercise.id)
        .order_by(recency.desc().nullslast(), Exercise.name.asc())
        .limit(limit)
    )
    if q:
        stmt = stmt.where(Exercise.name.ilike(f"%{q.strip()}%"))
    rows = db.execute(stmt).all()
    return [exercise for exercise, _last_used in rows]
