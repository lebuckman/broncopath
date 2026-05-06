import os
from pathlib import Path
from dotenv import load_dotenv

from academic_calendar_sync import sync_academic_calendar
from schedule_sync import sync_schedule


def main() -> None:
    ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
    load_dotenv(ENV_PATH)

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL not found")

    print("Syncing CPP academic calendar...")
    sync_academic_calendar(database_url)

    print("Syncing CPP schedule entries...")
    sync_schedule(database_url)

    print("Academic cron completed.")


if __name__ == "__main__":
    main()