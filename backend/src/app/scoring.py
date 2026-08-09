"""Per-exercise "score" used to decide records (PRs) and top lifts.

- weight_reps: estimated 1RM (Epley), so progress in either weight or reps counts.
  A weight-only set is treated as a max attempt at that weight.
- reps: bodyweight exercises; score is the rep count.
- time: holds/carries; score is the hold duration in seconds.
"""

from .models import Set

_UNITS = ("weight_reps", "reps", "time")


def is_valid_unit(unit: str) -> bool:
    return unit in _UNITS


def set_score(
    unit: str, weight_kg: float | None, reps: int | None, duration_s: int | None
) -> float:
    if unit == "weight_reps":
        if weight_kg is not None and reps is not None:
            return weight_kg * (1 + reps / 30)
        if weight_kg is not None:
            return weight_kg
        return float(reps or 0)
    if unit == "reps":
        return float(reps or 0)
    return float(duration_s or 0)


def model_set_score(unit: str, set: Set) -> float:
    return set_score(unit, set.weight_kg, set.reps, set.duration_s)
