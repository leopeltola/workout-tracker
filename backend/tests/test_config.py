from app.config import _with_psycopg_driver


def test_postgres_url_gets_psycopg_driver():
    url = "postgres://user:pass@db:5432/workouts?sslmode=disable"
    assert _with_psycopg_driver(url) == (
        "postgresql+psycopg://user:pass@db:5432/workouts?sslmode=disable"
    )


def test_postgresql_url_gets_psycopg_driver():
    assert _with_psycopg_driver("postgresql://u:p@h/db") == "postgresql+psycopg://u:p@h/db"


def test_existing_driver_is_untouched():
    url = "postgresql+psycopg://u:p@h/db"
    assert _with_psycopg_driver(url) == url


def test_sqlite_untouched():
    url = "sqlite:///./dev.db"
    assert _with_psycopg_driver(url) == url
