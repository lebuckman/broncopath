import os
import re
from datetime import datetime
from typing import Optional

import psycopg
import requests
from bs4 import BeautifulSoup
from pathlib import Path
from dotenv import load_dotenv

CALENDAR_URL = "https://www.cpp.edu/academic-programs/academic-calendar/index.shtml?cppshorturl=academic-calendar"

TERM_TITLE_RE = re.compile(r"^(Spring|Summer|Fall|Winter)\s+(\d{4})$", re.I)


def clean(text: str) -> str:
    return " ".join((text or "").replace("\xa0", " ").split())


def term_code(label: str) -> str:
    return label.lower().replace(" ", "-")


def parse_month_date(raw: str, default_year: int) -> Optional[str]:
    raw = clean(raw)
    if not raw or raw.upper() in {"N/A", "NA"}:
        return None

    raw = raw.replace("–", "-")
    first = raw.split("-")[0].strip()

    formats = [
        "%B %d, %Y",
        "%b %d, %Y",
        "%B %d",
        "%b %d",
    ]

    for fmt in formats:
        try:
            if "%Y" in fmt:
                return datetime.strptime(first, fmt).date().isoformat()

            parsed = datetime.strptime(f"{first} {default_year}", f"{fmt} %Y")
            return parsed.date().isoformat()
        except ValueError:
            pass

    return None


def parse_date_range(raw: str, default_year: int) -> tuple[Optional[str], Optional[str]]:
    raw = clean(raw).replace("–", "-")
    if not raw or raw.upper() in {"N/A", "NA"}:
        return None, None

    if "-" not in raw:
        parsed = parse_month_date(raw, default_year)
        return parsed, parsed

    left, right = [part.strip() for part in raw.split("-", 1)]

    start = parse_month_date(left, default_year)

    # If right side is just a day number, reuse left month.
    if re.fullmatch(r"\d{1,2}", right):
        month_match = re.match(r"^([A-Za-z]+)", left)
        if month_match:
            right = f"{month_match.group(1)} {right}"

    end = parse_month_date(right, default_year)

    return start, end


def fetch_calendar_soup() -> BeautifulSoup:
    res = requests.get(CALENDAR_URL, timeout=30)
    res.raise_for_status()
    return BeautifulSoup(res.text, "html.parser")


def find_term_sections(soup: BeautifulSoup):
    sections = []

    for header in soup.select(".accordion__header"):
        title_el = header.select_one("h3")
        if not title_el:
            continue

        label = clean(title_el.get_text())
        match = TERM_TITLE_RE.match(label)
        if not match:
            continue

        content = header.find_next_sibling("div", class_="accordion__content")
        if not content:
            continue

        season = match.group(1).title()
        year = int(match.group(2))

        sections.append({
            "label": f"{season} {year}",
            "season": season,
            "year": year,
            "content": content,
        })

    return sections


def parse_instruction_table(section: dict) -> tuple[dict, list[dict]]:
    label = section["label"]
    year = section["year"]
    content = section["content"]

    term = {
        "code": term_code(label),
        "label": label,
        "start_date": None,
        "end_date": None,
        "finals_start_date": None,
        "finals_end_date": None,
    }

    events = []

    table = content.select_one(".academic-instruction table")
    if not table:
        return term, events

    for tr in table.select("tbody tr"):
        cells = [clean(td.get_text(" ")) for td in tr.find_all(["td", "th"])]
        if len(cells) < 2:
            continue

        name = cells[0]
        value = cells[1]

        name_lower = name.lower()

        if "classes begin for all students" in name_lower:
            term["start_date"] = parse_month_date(value, year)

        elif "classes end for all students" in name_lower:
            term["end_date"] = parse_month_date(value, year)

        elif name_lower == "finals":
            start, end = parse_date_range(value, year)
            term["finals_start_date"] = start
            term["finals_end_date"] = end

            if start:
                events.append({
                    "title": f"{label} Finals",
                    "event_type": "finals",
                    "start_date": start,
                    "end_date": end or start,
                    "affects_classes": True,
                    "campus_closed": False,
                })

        elif "instruction break" in name_lower:
            start, end = parse_date_range(value, year)
            if start:
                events.append({
                    "title": name,
                    "event_type": "instruction_break",
                    "start_date": start,
                    "end_date": end or start,
                    "affects_classes": True,
                    "campus_closed": False,
                })

    return term, events


def parse_holiday_table(section: dict) -> list[dict]:
    year = section["year"]
    content = section["content"]

    events = []

    table = content.select_one(".holidays table")
    if not table:
        return events

    for tr in table.select("tbody tr"):
        cells = [clean(td.get_text(" ")) for td in tr.find_all(["td", "th"])]
        if len(cells) < 2:
            continue

        title = cells[0]
        date_texts = [value for value in cells[1:] if value and value != "\xa0"]

        for date_text in date_texts:
            start, end = parse_date_range(date_text, year)
            if not start:
                continue

            events.append({
                "title": title,
                "event_type": "holiday",
                "start_date": start,
                "end_date": end or start,
                "affects_classes": True,
                "campus_closed": True,
            })

    return events


def sync_academic_calendar(database_url: str) -> None:
    soup = fetch_calendar_soup()
    sections = find_term_sections(soup)

    terms = []
    events = []

    for section in sections:
        term, instruction_events = parse_instruction_table(section)
        holiday_events = parse_holiday_table(section)

        if term["start_date"] and term["end_date"]:
            terms.append(term)

        events.extend(instruction_events)
        events.extend(holiday_events)

    if not terms:
        raise ValueError("No academic terms parsed from CPP academic calendar.")

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            for term in terms:
                cur.execute(
                    """
                    insert into academic_terms
                    (code, label, start_date, end_date, finals_start_date, finals_end_date, source_url)
                    values (%s, %s, %s, %s, %s, %s, %s)
                    on conflict (code) do update set
                      label = excluded.label,
                      start_date = excluded.start_date,
                      end_date = excluded.end_date,
                      finals_start_date = excluded.finals_start_date,
                      finals_end_date = excluded.finals_end_date,
                      source_url = excluded.source_url,
                      updated_at = now()
                    """,
                    (
                        term["code"],
                        term["label"],
                        term["start_date"],
                        term["end_date"],
                        term["finals_start_date"],
                        term["finals_end_date"],
                        CALENDAR_URL,
                    ),
                )

            cur.execute("delete from academic_calendar_events;")

            for event in events:
                cur.execute(
                    """
                    insert into academic_calendar_events
                    (title, event_type, start_date, end_date, affects_classes, campus_closed, source_url)
                    values (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        event["title"],
                        event["event_type"],
                        event["start_date"],
                        event["end_date"],
                        event["affects_classes"],
                        event["campus_closed"],
                        CALENDAR_URL,
                    ),
                )

        conn.commit()

    print(f"Synced {len(terms)} academic terms.")
    print(f"Synced {len(events)} academic calendar events.")


if __name__ == "__main__":
    ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
    load_dotenv(ENV_PATH)
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL not found")

    sync_academic_calendar(database_url)