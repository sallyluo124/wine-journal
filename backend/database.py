import sqlite3
import json
from pathlib import Path
from models import TastingEntry

DB_PATH = Path(__file__).parent / "journal.db"


def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with _connect() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tastings (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                wine_name  TEXT    NOT NULL,
                producer   TEXT    NOT NULL DEFAULT '',
                vintage    INTEGER,
                color      TEXT    NOT NULL,
                aromas     TEXT    NOT NULL DEFAULT '[]',
                acidity    INTEGER NOT NULL,
                tannin     INTEGER NOT NULL,
                body       INTEGER NOT NULL,
                alcohol    INTEGER NOT NULL,
                rating     INTEGER NOT NULL,
                notes      TEXT    NOT NULL DEFAULT '',
                tasted_on  TEXT    NOT NULL
            )
        """)
        for col in ("country", "region", "village"):
            try:
                conn.execute(f"ALTER TABLE tastings ADD COLUMN {col} TEXT NOT NULL DEFAULT ''")
            except Exception:
                pass  # column already exists
        try:
            conn.execute("ALTER TABLE tastings ADD COLUMN grapes TEXT NOT NULL DEFAULT '[]'")
        except Exception:
            pass  # column already exists


def _row_to_entry(row: sqlite3.Row) -> TastingEntry:
    d = dict(row)
    d["aromas"] = json.loads(d["aromas"])
    d["grapes"] = json.loads(d.get("grapes", "[]"))
    return TastingEntry(**d)


def insert_tasting(entry: TastingEntry) -> TastingEntry:
    with _connect() as conn:
        cur = conn.execute(
            """INSERT INTO tastings
               (wine_name, producer, vintage, color, aromas,
                acidity, tannin, body, alcohol, rating, notes, tasted_on,
                country, region, village, grapes)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                entry.wine_name, entry.producer, entry.vintage, entry.color,
                json.dumps(entry.aromas),
                entry.acidity, entry.tannin, entry.body, entry.alcohol,
                entry.rating, entry.notes, str(entry.tasted_on),
                entry.country, entry.region, entry.village,
                json.dumps(entry.grapes),
            ),
        )
        entry.id = cur.lastrowid
        return entry


def fetch_all() -> list[TastingEntry]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM tastings ORDER BY id DESC"
        ).fetchall()
    return [_row_to_entry(r) for r in rows]


def fetch_one(tasting_id: int) -> TastingEntry | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM tastings WHERE id = ?", (tasting_id,)
        ).fetchone()
    return _row_to_entry(row) if row else None


def delete_tasting(tasting_id: int) -> bool:
    with _connect() as conn:
        cur = conn.execute(
            "DELETE FROM tastings WHERE id = ?", (tasting_id,)
        )
    return cur.rowcount > 0
