from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ..db import get_db
from ..deps import require_user
from ..models import Exercise, Set, User, WorkoutLog
from ..schemas import (
    DeleteResponse,
    LogCreate,
    LogOut,
    LogUpdate,
)

router = APIRouter(prefix="/api", tags=["logs"])


def _to_log_out(log: WorkoutLog) -> LogOut:
    return LogOut(
        id=log.id,
        exercise_id=log.exercise_id,
        exercise_name=log.exercise.name,
        muscle_group=log.exercise.muscle_group,
        log_date=log.log_date,
        order_index=log.order_index,
        notes=log.notes,
        sets=[set for set in log.sets],
    )


@router.get("/logs", response_model=list[LogOut])
def list_logs(
    log_date: date,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
) -> list[LogOut]:
    logs = db.scalars(
        select(WorkoutLog)
        .where(WorkoutLog.user_id == user.id, WorkoutLog.log_date == log_date)
        .options(selectinload(WorkoutLog.exercise), selectinload(WorkoutLog.sets))
        .order_by(WorkoutLog.order_index.asc(), WorkoutLog.id.asc())
    ).all()
    return [_to_log_out(log) for log in logs]


@router.post("/logs", response_model=LogOut, status_code=201)
def create_log(
    payload: LogCreate,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
) -> LogOut:
    name = payload.exercise_name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Exercise name is required")

    exercise = db.scalar(
        select(Exercise).where(
            Exercise.user_id == user.id,
            func.lower(Exercise.name) == name.lower(),
        )
    )
    if exercise is None:
        exercise = Exercise(user_id=user.id, name=name, muscle_group=payload.muscle_group)
        db.add(exercise)
        db.flush()
    elif payload.muscle_group and not exercise.muscle_group:
        exercise.muscle_group = payload.muscle_group

    log = db.scalar(
        select(WorkoutLog).where(
            WorkoutLog.user_id == user.id,
            WorkoutLog.exercise_id == exercise.id,
            WorkoutLog.log_date == payload.log_date,
        )
    )
    if log is None:
        max_order = db.scalar(
            select(func.max(WorkoutLog.order_index)).where(
                WorkoutLog.user_id == user.id,
                WorkoutLog.log_date == payload.log_date,
            )
        )
        log = WorkoutLog(
            user_id=user.id,
            exercise_id=exercise.id,
            log_date=payload.log_date,
            order_index=(max_order or 0) + 1,
            notes=payload.notes,
        )
        db.add(log)
    else:
        log.notes = payload.notes or log.notes

    db.commit()
    log = db.scalar(
        select(WorkoutLog)
        .where(WorkoutLog.id == log.id)
        .options(selectinload(WorkoutLog.exercise), selectinload(WorkoutLog.sets))
    )
    assert log is not None
    return _to_log_out(log)


@router.put("/logs/{log_id}", response_model=LogOut)
def update_log(
    log_id: int,
    payload: LogUpdate,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
) -> LogOut:
    log = _get_log_or_404(db, log_id, user.id)
    log.notes = payload.notes

    existing = {s.set_number: s for s in log.sets}
    seen: set[int] = set()
    for incoming in payload.sets:
        row = existing.get(incoming.set_number)
        seen.add(incoming.set_number)
        if row is None:
            row = Set(workout_log_id=log.id, set_number=incoming.set_number)
            db.add(row)
        row.reps = incoming.reps
        row.weight_kg = incoming.weight_kg
        row.duration_s = incoming.duration_s
    for set_number, row in existing.items():
        if set_number not in seen:
            db.delete(row)

    db.commit()
    db.refresh(log)
    return _to_log_out(log)


@router.delete("/logs/{log_id}", response_model=DeleteResponse)
def delete_log(
    log_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
) -> DeleteResponse:
    log = _get_log_or_404(db, log_id, user.id)
    db.delete(log)
    db.commit()
    return DeleteResponse()


def _get_log_or_404(db: Session, log_id: int, user_id: int) -> WorkoutLog:
    log = db.scalar(
        select(WorkoutLog)
        .where(WorkoutLog.id == log_id, WorkoutLog.user_id == user_id)
        .options(selectinload(WorkoutLog.exercise), selectinload(WorkoutLog.sets))
    )
    if log is None:
        raise HTTPException(status_code=404, detail="Log not found")
    return log
