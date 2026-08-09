from datetime import date, datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class ExerciseUnit(StrEnum):
    weight_reps = "weight_reps"
    reps = "reps"
    time = "time"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str | None = None
    avatar_url: str | None = None


class MeOut(BaseModel):
    user: UserOut
    today: date
    server_time: datetime


class SetIn(BaseModel):
    set_number: int = Field(ge=1)
    reps: int | None = Field(default=None, ge=1)
    weight_kg: float | None = Field(default=None, ge=0)
    duration_s: int | None = Field(default=None, ge=1)


class SetOut(SetIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_pr: bool = False
    score: float | None = None


class LogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    exercise_id: int
    exercise_name: str
    muscle_group: str | None = None
    log_date: date
    order_index: int
    notes: str | None = None
    unit: ExerciseUnit
    is_new_pr: bool = False
    sets: list[SetOut] = []


class LogCreate(BaseModel):
    log_date: date
    exercise_name: str = Field(min_length=1, max_length=120)
    muscle_group: str | None = Field(default=None, max_length=80)
    notes: str | None = Field(default=None, max_length=500)
    unit: ExerciseUnit | None = None


class LogUpdate(BaseModel):
    notes: str | None = Field(default=None, max_length=500)
    sets: list[SetIn] = []


class ExerciseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    muscle_group: str | None = None
    unit: ExerciseUnit


class ExerciseUpdate(BaseModel):
    unit: ExerciseUnit


class TopSetOut(BaseModel):
    log_date: date
    set_number: int
    weight_kg: float | None = None
    reps: int | None = None
    duration_s: int | None = None
    score: float


class HistoryEntryOut(BaseModel):
    log_id: int
    log_date: date
    best_score: float
    sets: list[SetOut]


class ExerciseDetailOut(BaseModel):
    exercise: ExerciseOut
    top_sets: list[TopSetOut]
    history: list[HistoryEntryOut]


class DeleteResponse(BaseModel):
    deleted: bool = True
