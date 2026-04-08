import os
from dotenv import load_dotenv
import psycopg
from psycopg.rows import dict_row

load_dotenv("../.env")
DATABASE_URL = os.getenv("DATABASE_URL")


def insert_schedule_rows(rows: list[dict], semester: str):
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL not found in ../.env")

    if not rows:
        print("No rows to insert.")
        return

    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Optional: clear existing rows for this semester first
            cur.execute(
                """
                delete from schedule_entries
                where semester = %s
                """,
                (semester,),
            )

            insert_sql = """
                insert into schedule_entries
                (room_id, day_of_week, start_time, end_time, course_name, semester)
                values (%s, %s, %s, %s, %s, %s)
            """

            values = [
                (
                    row["roomId"],
                    row["dayOfWeek"],
                    row["startTime"],
                    row["endTime"],
                    row["courseName"],
                    row["semester"],
                )
                for row in rows
            ]

            cur.executemany(insert_sql, values)

        conn.commit()

    print(f"Inserted {len(rows)} schedule_entries rows.")