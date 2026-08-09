from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


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


class LogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    exercise_id: int
    exercise_name: str
    muscle_group: str | None = None
    log_date: date
    order_index: int
    notes: str | None = None
    sets: list[SetOut] = []


class LogCreate(BaseModel):
    log_date: date
    exercise_name: str = Field(min_length=1, max_length=120)
    muscle_group: str | None = Field(default=None, max_length=80)
    notes: str | None = Field(default=None, max_length=500)


class LogUpdate(BaseModel):
    notes: str | None = Field(default=None, max_length=500)
    sets: list[SetIn] = []


class ExerciseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    muscle_group: str | None = None


class DeleteResponse(BaseModel):
    deleted: bool = True
