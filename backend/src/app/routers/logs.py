from collections import defaultdict
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ..db import get_db
from ..deps import require_user
from ..models import Exercise, Set, User, WorkoutLog
from ..schemas import (
    DeleteResponse,
    ExerciseUnit,
    LogCreate,
    LogOut,
    LogUpdate,
    SetOut,
)
from ..scoring import model_set_score

router = APIRouter(prefix="/api", tags=["logs"])


def _set_out(set: Set, unit: str, is_pr: bool) -> SetOut:
    return SetOut(
        id=set.id,
        set_number=set.set_number,
        reps=set.reps,
        weight_kg=set.weight_kg,
        duration_s=set.duration_s,
        is_pr=is_pr,
    )


def _log_out(log: WorkoutLog, unit: str, is_new_pr: bool, all_time_max: float) -> LogOut:
    return LogOut(
        id=log.id,
        exercise_id=log.exercise_id,
        exercise_name=log.exercise.name,
        muscle_group=log.exercise.muscle_group,
        log_date=log.log_date,
        order_index=log.order_index,
        notes=log.notes,
        unit=ExerciseUnit(unit),
        is_new_pr=is_new_pr,
        sets=[
            _set_out(s, unit, _is_pr(unit, s, all_time_max))
            for s in sorted(log.sets, key=lambda s: s.set_number)
        ],
    )


def _is_pr(unit: str, set: Set, all_time_max: float) -> bool:
    if all_time_max <= 0:
        return False
    return abs(model_set_score(unit, set) - all_time_max) < 1e-6


def _pr_context(
    db: Session, user_id: int, exercise_ids: set[int]
) -> tuple[dict[int, float], dict[int, float], dict[int, float], dict[int, str]]:
    """Per-exercise record context for a set of exercises.

    Returns (all_time_max, prior_max, day_best, unit) where the *_max maps are keyed by
    workout_log id and unit is keyed by exercise id. prior_max is the best score seen on
    strictly earlier days, so a day whose best exceeds it is a new PR.
    """
    if not exercise_ids:
        return {}, {}, {}, {}
    rows = db.execute(
        select(WorkoutLog.id, WorkoutLog.exercise_id, WorkoutLog.log_date).where(
            WorkoutLog.user_id == user_id, WorkoutLog.exercise_id.in_(exercise_ids)
        )
    ).all()
    log_ids = [r.id for r in rows]
    exercise_of_log = {r.id: r.exercise_id for r in rows}
    sets_by_log: dict[int, list[Set]] = defaultdict(list)
    for s in db.scalars(select(Set).where(Set.workout_log_id.in_(log_ids))).all():
        sets_by_log[s.workout_log_id].append(s)

    units = {
        e.id: e.unit
        for e in db.scalars(select(Exercise).where(Exercise.id.in_(exercise_ids))).all()
    }

    day_best: dict[int, float] = {}
    all_time_max: dict[int, float] = defaultdict(float)
    for log_id, sets in sets_by_log.items():
        unit = units.get(exercise_of_log[log_id], "weight_reps")
        best = max((model_set_score(unit, s) for s in sets), default=0.0)
        day_best[log_id] = best
        all_time_max[exercise_of_log[log_id]] = max(all_time_max[exercise_of_log[log_id]], best)

    # Prior best per log, computed by scanning each exercise's days in date order.
    by_exercise: dict[int, list[tuple[date, int]]] = defaultdict(list)
    for r in rows:
        by_exercise[r.exercise_id].append((r.log_date, r.id))
    prior_max: dict[int, float] = {}
    for items in by_exercise.values():
        items.sort()
        running = 0.0
        for _log_date, log_id in items:
            prior_max[log_id] = running
            running = max(running, day_best.get(log_id, 0.0))

    return dict(all_time_max), prior_max, day_best, units


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
    if not logs:
        return []

    all_time_max, prior_max, day_best, units = _pr_context(
        db, user.id, {log.exercise_id for log in logs}
    )
    return [
        _log_out(
            log,
            units[log.exercise_id],
            day_best.get(log.id, 0.0) > prior_max.get(log.id, 0.0),
            all_time_max.get(log.exercise_id, 0.0),
        )
        for log in logs
    ]


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
        exercise = Exercise(
            user_id=user.id,
            name=name,
            muscle_group=payload.muscle_group,
            unit=(payload.unit or ExerciseUnit.weight_reps).value,
        )
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
    return _log_with_context(db, user, log)


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
    return _log_with_context(db, user, log)


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


def _log_with_context(db: Session, user: User, log: WorkoutLog) -> LogOut:
    all_time_max, prior_max, day_best, units = _pr_context(db, user.id, {log.exercise_id})
    unit = units.get(log.exercise_id, "weight_reps")
    return _log_out(
        log,
        unit,
        day_best.get(log.id, 0.0) > prior_max.get(log.id, 0.0),
        all_time_max.get(log.exercise_id, 0.0),
    )


def _get_log_or_404(db: Session, log_id: int, user_id: int) -> WorkoutLog:
    log = db.scalar(
        select(WorkoutLog)
        .where(WorkoutLog.id == log_id, WorkoutLog.user_id == user_id)
        .options(selectinload(WorkoutLog.exercise), selectinload(WorkoutLog.sets))
    )
    if log is None:
        raise HTTPException(status_code=404, detail="Log not found")
    return log
