from datetime import date, timedelta

from tests.conftest import auth_cookie


def test_new_exercise_defaults_to_weight_reps(client, db_session):
    auth_cookie(db_session, client)
    today = date.today().isoformat()
    client.post("/api/logs", json={"log_date": today, "exercise_name": "Bench Press"})
    (exercise,) = client.get("/api/exercises?q=bench").json()
    assert exercise["unit"] == "weight_reps"


def test_create_exercise_with_unit(client, db_session):
    auth_cookie(db_session, client)
    today = date.today().isoformat()
    client.post("/api/logs", json={"log_date": today, "exercise_name": "Plank", "unit": "time"})
    (exercise,) = client.get("/api/exercises?q=plank").json()
    assert exercise["unit"] == "time"


def test_existing_exercise_keeps_unit_on_log_create(client, db_session):
    auth_cookie(db_session, client)
    today = date.today().isoformat()
    client.post("/api/logs", json={"log_date": today, "exercise_name": "Plank", "unit": "time"})
    # Adding the same exercise again with a different unit must not change it.
    client.post("/api/logs", json={"log_date": today, "exercise_name": "Plank", "unit": "reps"})
    (exercise,) = client.get("/api/exercises?q=plank").json()
    assert exercise["unit"] == "time"


def test_patch_exercise_unit(client, db_session):
    auth_cookie(db_session, client)
    today = date.today().isoformat()
    log = client.post("/api/logs", json={"log_date": today, "exercise_name": "Pull Up"}).json()
    resp = client.patch(f"/api/exercises/{log['exercise_id']}", json={"unit": "reps"})
    assert resp.status_code == 200
    assert resp.json()["unit"] == "reps"


def test_logs_carry_unit_and_pr_flags(client, db_session):
    auth_cookie(db_session, client)
    today = date.today().isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()

    # Old record: 60 kg x 10 on yesterday.
    old = client.post(
        "/api/logs", json={"log_date": yesterday, "exercise_name": "Bench Press"}
    ).json()
    client.put(
        f"/api/logs/{old['id']}",
        json={"sets": [{"set_number": 1, "reps": 10, "weight_kg": 60}]},
    )

    # Today: tie the record on set 1, beat it on set 2.
    new = client.post("/api/logs", json={"log_date": today, "exercise_name": "Bench Press"}).json()
    client.put(
        f"/api/logs/{new['id']}",
        json={
            "sets": [
                {"set_number": 1, "reps": 10, "weight_kg": 60},
                {"set_number": 2, "reps": 8, "weight_kg": 65},
            ]
        },
    )

    logs = client.get(f"/api/logs?log_date={today}").json()
    assert len(logs) == 1
    log = logs[0]
    assert log["unit"] == "weight_reps"
    assert log["is_new_pr"] is True
    # Set 1 ties the old record: PR but not the all-time best any more.
    assert [s["is_pr"] for s in log["sets"]] == [False, True]


def test_tie_on_same_day_is_not_new_pr(client, db_session):
    auth_cookie(db_session, client)
    today = date.today().isoformat()
    log = client.post("/api/logs", json={"log_date": today, "exercise_name": "Squat"}).json()
    client.put(
        f"/api/logs/{log['id']}",
        json={"sets": [{"set_number": 1, "reps": 5, "weight_kg": 100}]},
    )
    logs = client.get(f"/api/logs?log_date={today}").json()
    assert logs[0]["is_new_pr"] is True
    assert logs[0]["sets"][0]["is_pr"] is True

    # Same value again the next day: still the record, but not "new".
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    log2 = client.post("/api/logs", json={"log_date": tomorrow, "exercise_name": "Squat"}).json()
    client.put(
        f"/api/logs/{log2['id']}",
        json={"sets": [{"set_number": 1, "reps": 5, "weight_kg": 100}]},
    )
    logs = client.get(f"/api/logs?log_date={tomorrow}").json()
    assert logs[0]["is_new_pr"] is False
    # The crown stays with the earlier record holder; a later tie gets nothing.
    assert logs[0]["sets"][0]["is_pr"] is False


def test_only_earliest_record_tie_gets_crown(client, db_session):
    auth_cookie(db_session, client)
    today = date.today().isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()

    # Day 1 logs the record twice (60 kg x 10 both times).
    log1 = client.post(
        "/api/logs", json={"log_date": yesterday, "exercise_name": "Bench Press"}
    ).json()
    client.put(
        f"/api/logs/{log1['id']}",
        json={
            "sets": [
                {"set_number": 1, "reps": 10, "weight_kg": 60},
                {"set_number": 2, "reps": 10, "weight_kg": 60},
            ]
        },
    )

    # Day 2 matches the record again — the crown must stay on day 1's first set.
    log2 = client.post("/api/logs", json={"log_date": today, "exercise_name": "Bench Press"}).json()
    client.put(
        f"/api/logs/{log2['id']}",
        json={"sets": [{"set_number": 1, "reps": 10, "weight_kg": 60}]},
    )

    logs = client.get(f"/api/logs?log_date={yesterday}").json()
    assert [s["is_pr"] for s in logs[0]["sets"]] == [True, False]

    logs = client.get(f"/api/logs?log_date={today}").json()
    assert [s["is_pr"] for s in logs[0]["sets"]] == [False]


def test_exercise_detail_record_flags(client, db_session):
    auth_cookie(db_session, client)
    today = date.today().isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()

    # Day 1: two identical record sets; day 2: same again.
    for day in (yesterday, today):
        log = client.post(
            "/api/logs", json={"log_date": day, "exercise_name": "Bench Press"}
        ).json()
        client.put(
            f"/api/logs/{log['id']}",
            json={
                "sets": [
                    {"set_number": 1, "reps": 10, "weight_kg": 60},
                    {"set_number": 2, "reps": 10, "weight_kg": 60},
                ]
            },
        )

    (exercise,) = client.get("/api/exercises?q=bench").json()
    detail = client.get(f"/api/exercises/{exercise['id']}").json()

    record_sets = [t for t in detail["top_sets"] if t["is_record"]]
    assert len(record_sets) == 1
    assert record_sets[0]["log_date"] == yesterday
    assert record_sets[0]["set_number"] == 1

    record_days = [h for h in detail["history"] if h["is_record_day"]]
    assert len(record_days) == 1
    assert record_days[0]["log_date"] == yesterday


def test_exercise_detail_has_top_sets_and_history(client, db_session):
    auth_cookie(db_session, client)
    today = date.today().isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()

    for day in (yesterday, today):
        log = client.post("/api/logs", json={"log_date": day, "exercise_name": "Deadlift"}).json()
        client.put(
            f"/api/logs/{log['id']}",
            json={"sets": [{"set_number": 1, "reps": 5, "weight_kg": 100}]},
        )

    (exercise,) = client.get("/api/exercises?q=dead").json()
    detail = client.get(f"/api/exercises/{exercise['id']}").json()
    assert detail["exercise"]["name"] == "Deadlift"
    assert len(detail["top_sets"]) == 2
    # Both sets score the same; most recent day wins the tie.
    assert detail["top_sets"][0]["log_date"] == today
    assert len(detail["history"]) == 2
    assert detail["history"][0]["log_date"] == today
    assert detail["history"][0]["best_score"] > 0


def test_exercise_detail_scoped_to_user(client, db_session):
    auth_cookie(db_session, client)
    resp = client.get("/api/exercises/999999")
    assert resp.status_code == 404
