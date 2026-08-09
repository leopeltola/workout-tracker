from datetime import date

from tests.conftest import auth_cookie


def test_healthz(client):
    resp = client.get("/healthz")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_me_requires_auth(client):
    resp = client.get("/api/me")
    assert resp.status_code == 401


def test_me_with_session(client, db_session):
    user = auth_cookie(db_session, client)
    resp = client.get("/api/me")
    assert resp.status_code == 200
    body = resp.json()
    assert body["user"]["id"] == user.id
    assert body["user"]["username"] == user.username


def test_create_log_and_logout(client, db_session):
    auth_cookie(db_session, client)
    today = date.today().isoformat()

    resp = client.post(
        "/api/logs",
        json={"log_date": today, "exercise_name": "Bench Press"},
    )
    assert resp.status_code == 201, resp.text
    log = resp.json()
    assert log["exercise_name"] == "Bench Press"
    assert log["sets"] == []
    log_id = log["id"]

    resp = client.put(
        f"/api/logs/{log_id}",
        json={
            "sets": [
                {"set_number": 1, "reps": 10, "weight_kg": 60},
                {"set_number": 2, "reps": 8, "weight_kg": 65},
            ]
        },
    )
    assert resp.status_code == 200
    assert len(resp.json()["sets"]) == 2

    resp = client.get(f"/api/logs?log_date={today}")
    assert resp.status_code == 200
    logs = resp.json()
    assert len(logs) == 1
    assert len(logs[0]["sets"]) == 2
    assert logs[0]["sets"][1]["weight_kg"] == 65

    resp = client.post("/api/auth/logout")
    assert resp.status_code == 200
    assert client.get("/api/me").status_code == 401


def test_adding_same_exercise_same_day_is_idempotent(client, db_session):
    auth_cookie(db_session, client)
    today = date.today().isoformat()
    for _ in range(2):
        resp = client.post(
            "/api/logs",
            json={"log_date": today, "exercise_name": "Squat"},
        )
        assert resp.status_code == 201
    logs = client.get(f"/api/logs?log_date={today}").json()
    assert len(logs) == 1


def test_update_replaces_sets(client, db_session):
    auth_cookie(db_session, client)
    today = date.today().isoformat()
    log = client.post("/api/logs", json={"log_date": today, "exercise_name": "Deadlift"}).json()
    client.put(
        f"/api/logs/{log['id']}",
        json={"sets": [{"set_number": 1, "reps": 5, "weight_kg": 100}]},
    )
    client.put(
        f"/api/logs/{log['id']}",
        json={"sets": [{"set_number": 1, "reps": 3, "weight_kg": 120}]},
    )
    logs = client.get(f"/api/logs?log_date={today}").json()
    sets = logs[0]["sets"]
    assert len(sets) == 1
    assert sets[0]["weight_kg"] == 120


def test_delete_log(client, db_session):
    auth_cookie(db_session, client)
    today = date.today().isoformat()
    log = client.post("/api/logs", json={"log_date": today, "exercise_name": "Pull Up"}).json()
    resp = client.delete(f"/api/logs/{log['id']}")
    assert resp.status_code == 200
    assert client.get(f"/api/logs?log_date={today}").json() == []
    assert client.delete(f"/api/logs/{log['id']}").status_code == 404


def test_exercises_are_scoped_to_user(client, db_session):
    auth_cookie(db_session, client)
    today = date.today().isoformat()
    client.post("/api/logs", json={"log_date": today, "exercise_name": "Squat"})
    client.post("/api/logs", json={"log_date": today, "exercise_name": "Press"})

    resp = client.get("/api/exercises?q=squ")
    assert resp.status_code == 200
    names = [e["name"] for e in resp.json()]
    assert names == ["Squat"]

    resp = client.get("/api/exercises")
    names = [e["name"] for e in resp.json()]
    assert names == ["Press", "Squat"]  # most recently added first
