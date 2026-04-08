import os
import random
import re

import psycopg
import requests
import urllib3
from bs4 import BeautifulSoup
from dotenv import load_dotenv

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = "https://schedule.cpp.edu/"
SEMESTER_CODE = "2263"  # Spring Semester 2026

# Known coordinates from your mock data.
KNOWN_BUILDING_COORDS: dict[str, dict[str, float]] = {
    "8": {"latitude": 34.05862, "longitude": -117.82485},
    "9": {"latitude": 34.05886, "longitude": -117.82222},
    "15": {"latitude": 34.05750, "longitude": -117.82138},
    "163": {"latitude": 34.06159, "longitude": -117.81964},
}

# Approximate CPP campus box.
# These are intentionally broad enough to keep random fallbacks on campus-ish.
CAMPUS_MIN_LAT = 34.0535
CAMPUS_MAX_LAT = 34.0665
CAMPUS_MIN_LNG = -117.8295
CAMPUS_MAX_LNG = -117.8150

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


def extract_building_numbers_from_html(html: str) -> set[str]:
    soup = BeautifulSoup(html, "html.parser")
    buildings: set[str] = set()

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
        if building and room:
            buildings.add(building)

    return buildings


def collect_all_scraped_buildings(subjects: list[str]) -> set[str]:
    found: set[str] = set()
    for subject in subjects:
        print(f"Scraping {subject}...")
        html = scrape_subject_html(subject)
        subject_buildings = extract_building_numbers_from_html(html)
        print(f"  found {len(subject_buildings)} buildings in {subject}")
        found.update(subject_buildings)
    return found


def random_campus_coords(seed_text: str) -> tuple[float, float]:
    # Stable random per building id, so reruns keep the same fallback coords.
    rng = random.Random(seed_text)
    lat = rng.uniform(CAMPUS_MIN_LAT, CAMPUS_MAX_LAT)
    lng = rng.uniform(CAMPUS_MIN_LNG, CAMPUS_MAX_LNG)
    return round(lat, 6), round(lng, 6)


def build_building_rows(building_numbers: set[str]) -> tuple[list[dict], list[str]]:
    rows: list[dict] = []
    randomized: list[str] = []

    for b in sorted(building_numbers, key=lambda x: (not x.isdigit(), x)):
        coords = KNOWN_BUILDING_COORDS.get(b)
        if coords:
            lat = coords["latitude"]
            lng = coords["longitude"]
        else:
            lat, lng = random_campus_coords(b)
            randomized.append(b)

        rows.append({
            "id": b,
            "name": f"Building {b}",
            "code": f"BLDG {b}",
            "latitude": lat,
            "longitude": lng,
        })

    return rows, randomized


def reset_and_insert_buildings(rows: list[dict], database_url: str) -> None:
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute("delete from schedule_entries;")
            cur.execute("delete from rooms;")
            cur.execute("delete from buildings;")

            cur.executemany(
                """
                insert into buildings (id, name, code, latitude, longitude)
                values (%s, %s, %s, %s, %s)
                """,
                [
                    (
                        row["id"],
                        row["name"],
                        row["code"],
                        row["latitude"],
                        row["longitude"],
                    )
                    for row in rows
                ],
            )
        conn.commit()


def main() -> None:
    load_dotenv("../.env")
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL not found in ../.env")

    scraped_buildings = collect_all_scraped_buildings(SUBJECTS)
    print(f"\nTotal unique scraped buildings: {len(scraped_buildings)}")

    building_rows, randomized = build_building_rows(scraped_buildings)

    if not building_rows:
        print("No building rows found.")
        return

    reset_and_insert_buildings(building_rows, database_url)

    print(f"\nInserted {len(building_rows)} buildings.")
    if randomized:
        print(f"Used random campus coords for {len(randomized)} buildings:")
        print(", ".join(randomized))


if __name__ == "__main__":
    main()