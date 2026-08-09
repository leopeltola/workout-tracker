from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ..db import get_db
from ..deps import require_user
from ..models import Exercise, User, WorkoutLog
from ..schemas import (
    ExerciseDetailOut,
    ExerciseOut,
    ExerciseUpdate,
    HistoryEntryOut,
    SetOut,
    TopSetOut,
)
from ..scoring import model_set_score

router = APIRouter(prefix="/api", tags=["exercises"])

# Don't suggest deleted/misspelled garbage; hard cap on results.
DEFAULT_LIMIT = 20
TOP_SETS = 5


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


@router.get("/exercises/{exercise_id}", response_model=ExerciseDetailOut)
def get_exercise(
    exercise_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
) -> ExerciseDetailOut:
    exercise = db.scalar(
        select(Exercise).where(Exercise.id == exercise_id, Exercise.user_id == user.id)
    )
    if exercise is None:
        raise HTTPException(status_code=404, detail="Exercise not found")

    logs = db.scalars(
        select(WorkoutLog)
        .where(WorkoutLog.exercise_id == exercise.id, WorkoutLog.user_id == user.id)
        .options(selectinload(WorkoutLog.sets))
        .order_by(WorkoutLog.log_date.desc(), WorkoutLog.id.asc())
    ).all()

    top: list[TopSetOut] = []
    history: list[HistoryEntryOut] = []
    for log in logs:
        scored = [
            (s, model_set_score(exercise.unit, s))
            for s in sorted(log.sets, key=lambda s: s.set_number)
        ]
        best = max((score for _s, score in scored), default=0.0)
        history.append(
            HistoryEntryOut(
                log_id=log.id,
                log_date=log.log_date,
                best_score=best,
                sets=[
                    SetOut(
                        id=s.id,
                        set_number=s.set_number,
                        reps=s.reps,
                        weight_kg=s.weight_kg,
                        duration_s=s.duration_s,
                        score=score,
                    )
                    for s, score in scored
                ],
            )
        )
        for s, score in scored:
            if score > 0:
                top.append(
                    TopSetOut(
                        log_date=log.log_date,
                        set_number=s.set_number,
                        weight_kg=s.weight_kg,
                        reps=s.reps,
                        duration_s=s.duration_s,
                        score=score,
                    )
                )

    # Stable sorts: score desc, with date desc breaking ties.
    top.sort(key=lambda t: t.log_date, reverse=True)
    top.sort(key=lambda t: t.score, reverse=True)
    return ExerciseDetailOut(
        exercise=ExerciseOut.model_validate(exercise),
        top_sets=top[:TOP_SETS],
        history=[h for h in history if h.sets],
    )


@router.patch("/exercises/{exercise_id}", response_model=ExerciseOut)
def update_exercise(
    exercise_id: int,
    payload: ExerciseUpdate,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
) -> Exercise:
    exercise = db.scalar(
        select(Exercise).where(Exercise.id == exercise_id, Exercise.user_id == user.id)
    )
    if exercise is None:
        raise HTTPException(status_code=404, detail="Exercise not found")
    exercise.unit = payload.unit.value
    db.commit()
    db.refresh(exercise)
    return exercise
