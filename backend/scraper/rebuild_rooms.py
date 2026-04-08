import os
import re

import psycopg
import requests
import urllib3
from bs4 import BeautifulSoup
from dotenv import load_dotenv

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = "https://schedule.cpp.edu/"
SEMESTER_CODE = "2263"  # Spring Semester 2026

SUBJECTS = [
    "ABM", "ACC", "AG", "AGS", "AH", "AHS", "AMM", "ANT", "ARC", "ARO", "AST",
    "ATH", "AVS", "BIO", "BUS", "CE", "CHE", "CHM", "CHN", "CIS", "CLS", "CM",
    "COM", "CPU", "CRM", "CS", "DAN", "EBZ", "EC", "ECE", "ECI", "ECS", "EDD",
    "EDL", "EDU", "EGR", "EMT", "ENG", "ENV", "ERA", "ETE", "ETM", "EWS", "FRE",
    "FRL", "FST", "GBA", "GEO", "GER", "GSC", "HRT", "HST", "IBM", "IE", "IGE",
    "IME", "INA", "IPC", "KIN", "LA", "LRC", "LS", "MAE", "MAT", "ME", "MFE",
    "MHR", "MPA", "MSL", "MTE", "MU", "NTR", "OAPL", "PHL", "PHY", "PLS", "PLT",
    "PSY", "RS", "SCI", "SE", "SME", "SOC", "SPN", "STA", "STS", "SW", "TH",
    "TOM", "URP", "VCD",
]


def clean(text: str) -> str:
    return " ".join((text or "").replace("\xa0", " ").split())


def parse_building_room(raw_building_room: str) -> tuple[str, str]:
    raw_building_room = clean(raw_building_room)
    m = re.match(r"^Bldg\s+(.+?)\s+Rm\s+(.+)$", raw_building_room, re.IGNORECASE)
    if not m:
        return "", ""
    return m.group(1).strip(), m.group(2).strip()


def parse_component_mode(raw_component_mode: str) -> tuple[str, str]:
    raw_component_mode = clean(raw_component_mode)
    parts = [p.strip() for p in raw_component_mode.split(",", 1)]
    if len(parts) == 2:
        return parts[0], parts[1]
    return raw_component_mode, ""


def room_type_from_component_mode(component_mode: str) -> str:
    component, mode = parse_component_mode(component_mode)

    component_lower = component.lower()
    if "lab" in component_lower:
        return "Lab"
    if "seminar" in component_lower:
        return "Seminar"
    if "lecture" in component_lower:
        return "Lecture"
    if "activity" in component_lower:
        return "Activity"
    if "clinical" in component_lower:
        return "Clinical"
    if "practicum" in component_lower:
        return "Practicum"

    return component or "Unknown"


def scrape_subject_html(class_subject: str) -> str:
    session = requests.Session()

    page = session.get(BASE_URL, timeout=30, verify=False)
    page.raise_for_status()
    soup = BeautifulSoup(page.text, "html.parser")

    def get_val(element_id: str, default: str = "") -> str:
        el = soup.select_one(f"#{element_id}")
        if el and el.has_attr("value"):
            return el["value"]
        return default

    payload = {
        "__EVENTTARGET": "",
        "__EVENTARGUMENT": "",
        "__VIEWSTATE": get_val("__VIEWSTATE"),
        "__VIEWSTATEGENERATOR": get_val("__VIEWSTATEGENERATOR"),
        "__VIEWSTATEENCRYPTED": get_val("__VIEWSTATEENCRYPTED"),
        "__EVENTVALIDATION": get_val("__EVENTVALIDATION"),
        "ctl00$ContentPlaceHolder1$TermDDL": SEMESTER_CODE,
        "ctl00$ContentPlaceHolder1$ClassSubject": class_subject,
        "ctl00$ContentPlaceHolder1$CatalogNumber": "",
        "ctl00$ContentPlaceHolder1$Description": "",
        "ctl00$ContentPlaceHolder1$CourseComponentDDL": "Any Component",
        "ctl00$ContentPlaceHolder1$CourseAttributeDDL": "Any Attribute",
        "ctl00$ContentPlaceHolder1$CourseCareerDDL": "Any Career",
        "ctl00$ContentPlaceHolder1$InstModesDDL": "Any Mode",
        "ctl00$ContentPlaceHolder1$SessionDDL": "Any Session",
        "ctl00$ContentPlaceHolder1$StartTime": "ANY",
        "ctl00$ContentPlaceHolder1$EndTime": "ANY",
        "ctl00$ContentPlaceHolder1$Instructor": "",
        "ctl00$ContentPlaceHolder1$ClassDays$0": "on",
        "ctl00$ContentPlaceHolder1$ClassDays$1": "on",
        "ctl00$ContentPlaceHolder1$ClassDays$2": "on",
        "ctl00$ContentPlaceHolder1$ClassDays$3": "on",
        "ctl00$ContentPlaceHolder1$ClassDays$4": "on",
        "ctl00$ContentPlaceHolder1$ClassDays$5": "on",
        "ctl00$ContentPlaceHolder1$ClassDays$6": "on",
        "ctl00$ContentPlaceHolder1$ClassDays$7": "on",
        "ctl00$ContentPlaceHolder1$SearchButton": "Search",
    }

    headers = {
        "User-Agent": "Mozilla/5.0",
        "Referer": BASE_URL,
    }

    res = session.post(
        BASE_URL,
        data=payload,
        headers=headers,
        timeout=30,
        verify=False,
    )
    res.raise_for_status()
    return res.text


def extract_room_rows_from_html(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    rows: list[dict] = []

    for li in soup.select("#class_list li"):
        table = li.select_one("table")
        if not table:
            continue

        data: dict[str, str] = {}
        for tr in table.select("tr"):
            cells = tr.find_all(["th", "td"])
            i = 0
            while i < len(cells) - 1:
                if cells[i].name == "th" and cells[i + 1].name == "td":
                    key = clean(cells[i].get_text())
                    value = clean(cells[i + 1].get_text())
                    data[key] = value
                    i += 2
                else:
                    i += 1

        building_room = data.get("Building/Room", "")
        building, room = parse_building_room(building_room)
        if not building or not room:
            continue

        room_id = f"{building}-{room}"

        capacity_raw = clean(data.get("Capacity", ""))
        capacity = int(capacity_raw) if capacity_raw.isdigit() else 0

        component_mode = data.get("Compnt./Mode", "")
        room_type = room_type_from_component_mode(component_mode)

        rows.append({
            "id": room_id,
            "buildingId": building,
            "number": room,
            "type": room_type,
            "capacity": capacity,
        })

    return rows


def collect_all_scraped_rooms(subjects: list[str]) -> list[dict]:
    all_rows: list[dict] = []

    for subject in subjects:
        print(f"Scraping {subject}...")
        html = scrape_subject_html(subject)
        subject_rows = extract_room_rows_from_html(html)
        print(f"  found {len(subject_rows)} room rows in {subject}")
        all_rows.extend(subject_rows)

    return all_rows


def dedupe_rooms(room_rows: list[dict]) -> list[dict]:
    by_id: dict[str, dict] = {}

    for row in room_rows:
        room_id = row["id"]

        if room_id not in by_id:
            by_id[room_id] = row
            continue

        # Prefer larger nonzero capacity if we see conflicting duplicates.
        existing = by_id[room_id]
        if row["capacity"] > existing["capacity"]:
            by_id[room_id]["capacity"] = row["capacity"]

        # Prefer a more specific non-Unknown type.
        if existing["type"] == "Unknown" and row["type"] != "Unknown":
            by_id[room_id]["type"] = row["type"]

    return list(by_id.values())


def fetch_valid_building_ids(database_url: str) -> set[str]:
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute("select id from buildings")
            return {row[0] for row in cur.fetchall()}


def reset_and_insert_rooms(room_rows: list[dict], database_url: str) -> None:
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            # schedule_entries depends on rooms
            cur.execute("delete from schedule_entries;")
            cur.execute("delete from rooms;")

            cur.executemany(
                """
                insert into rooms (id, building_id, number, type, capacity)
                values (%s, %s, %s, %s, %s)
                """,
                [
                    (
                        row["id"],
                        row["buildingId"],
                        row["number"],
                        row["type"],
                        row["capacity"],
                    )
                    for row in room_rows
                ],
            )
        conn.commit()


def main() -> None:
    load_dotenv("../.env")
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL not found in ../.env")

    valid_building_ids = fetch_valid_building_ids(database_url)
    if not valid_building_ids:
        raise ValueError("No buildings found in DB. Run rebuild_buildings.py first.")

    all_scraped_rows = collect_all_scraped_rooms(SUBJECTS)
    deduped_rows = dedupe_rooms(all_scraped_rows)

    filtered_rows = [row for row in deduped_rows if row["buildingId"] in valid_building_ids]
    skipped_rows = [row for row in deduped_rows if row["buildingId"] not in valid_building_ids]

    print(f"\nTotal scraped room rows: {len(all_scraped_rows)}")
    print(f"Unique rooms after dedupe: {len(deduped_rows)}")
    print(f"Rooms ready to insert: {len(filtered_rows)}")
    print(f"Rooms skipped due to missing buildingId: {len(skipped_rows)}")

    if skipped_rows:
        skipped_buildings = sorted({row["buildingId"] for row in skipped_rows}, key=lambda x: (not x.isdigit(), x))
        print("Skipped buildingIds:")
        print(", ".join(skipped_buildings))

    if not filtered_rows:
        print("No room rows to insert.")
        return

    reset_and_insert_rooms(filtered_rows, database_url)
    print("\nDone. Neon now contains rebuilt rooms only.")


if __name__ == "__main__":
    main()