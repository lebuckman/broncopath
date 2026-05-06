import os
import re
from datetime import date, datetime

import psycopg
import requests
import urllib3
from bs4 import BeautifulSoup
from pathlib import Path
from dotenv import load_dotenv
from psycopg.rows import dict_row

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = "https://schedule.cpp.edu/"
VERIFY_SSL = False


def clean(text: str) -> str:
    return " ".join((text or "").replace("\xa0", " ").split())


class RawClass:
    def __init__(
        self,
        course: str,
        section: str,
        class_number: str,
        title: str,
        time: str,
        date_range: str,
        instructor: str,
        capacity: str,
        units: str,
        building_room: str,
        component_mode: str,
    ):
        self.course = course
        self.section = section
        self.class_number = class_number
        self.title = title
        self.time = time
        self.date_range = date_range
        self.instructor = instructor
        self.capacity = capacity
        self.units = units
        self.building_room = building_room
        self.component_mode = component_mode


class ClassInfo:
    def __init__(self, raw: RawClass):
        course_subject, course_code = self._parse_course(raw.course)
        time_start, time_end, day_of_week = self._parse_time(raw.time)
        date_start, date_end = self._parse_date_range(raw.date_range)
        building, room = self._parse_building_room(raw.building_room)
        component, mode = self._parse_component_mode(raw.component_mode)

        self.course_subject = course_subject
        self.course_code = course_code
        self.class_number = raw.class_number
        self.title = raw.title
        self.time_start = time_start
        self.time_end = time_end
        self.day_of_week = day_of_week
        self.date_start = date_start
        self.date_end = date_end
        self.capacity = raw.capacity
        self.building = building
        self.room = room
        self.component = component
        self.mode = mode

    def to_room_row(self) -> dict | None:
        if not self.building or not self.room:
            return None

        capacity = int(self.capacity) if str(self.capacity).isdigit() else 0

        return {
            "id": f"{self.building}-{self.room}",
            "buildingId": self.building,
            "number": self.room,
            "type": room_type_from_component(self.component),
            "capacity": capacity,
        }
    
    def to_schedule_rows(self, semester: str) -> list[dict]:
        if not self.building or not self.room:
            return []
        if not self.time_start or not self.time_end:
            return []
        if not self.day_of_week:
            return []

        room_id = f"{self.building}-{self.room}"
        course_name = f"{self.course_subject} {self.course_code}".strip()

        return [
            {
                "roomId": room_id,
                "dayOfWeek": day,
                "startTime": self.time_start,
                "endTime": self.time_end,
                "courseName": course_name,
                "semester": semester,
            }
            for day in self.day_of_week
        ]

    @staticmethod
    def _parse_course(course: str):
        course = clean(course)
        match = re.match(r"^([A-Z]+)\s+(.+)$", course)
        if not match:
            return course, ""
        return match.group(1), match.group(2)

    @classmethod
    def _parse_time(cls, raw_time: str):
        raw_time = clean(raw_time)

        match = re.match(
            r"^(.*?(?:AM|PM))\s*[–-]\s*(.*?(?:AM|PM))\s+([A-Za-z]+)$",
            raw_time,
        )

        if not match:
            return "", "", []

        start = match.group(1).strip()
        end = match.group(2).strip()
        days = match.group(3).strip()

        return cls._to_24h(start), cls._to_24h(end), cls._expand_days(days)

    @staticmethod
    def _to_24h(time_str: str) -> str:
        return datetime.strptime(time_str, "%I:%M %p").strftime("%H:%M")

    @staticmethod
    def _expand_days(days: str):
        result = []
        i = 0

        while i < len(days):
            if days[i:i + 2] == "Tu":
                result.append("TUE")
                i += 2
            elif days[i:i + 2] == "Th":
                result.append("THU")
                i += 2
            elif days[i:i + 2] == "Sa":
                result.append("SAT")
                i += 2
            elif days[i:i + 2] == "Su":
                result.append("SUN")
                i += 2
            elif days[i] == "M":
                result.append("MON")
                i += 1
            elif days[i] == "W":
                result.append("WED")
                i += 1
            elif days[i] == "F":
                result.append("FRI")
                i += 1
            else:
                i += 1

        return result

    @staticmethod
    def _parse_date_range(raw_date: str):
        raw_date = clean(raw_date)
        parts = re.split(r"\s+to\s+", raw_date, flags=re.IGNORECASE)
        if len(parts) != 2:
            return raw_date, ""
        return parts[0], parts[1]

    @staticmethod
    def _parse_building_room(raw_building_room: str):
        raw_building_room = clean(raw_building_room)

        match = re.match(
            r"^Bldg\s+(.+?)\s+Rm\s+(.+)$",
            raw_building_room,
            re.IGNORECASE,
        )

        if not match:
            return "", ""

        return match.group(1).strip(), match.group(2).strip()

    @staticmethod
    def _parse_component_mode(raw_component_mode: str):
        raw_component_mode = clean(raw_component_mode)
        parts = [part.strip() for part in raw_component_mode.split(",", 1)]
        if len(parts) == 2:
            return parts[0], parts[1]
        return raw_component_mode, ""


def load_subjects() -> list[str]:
    path = os.path.join(os.path.dirname(__file__), "class_subjects.txt")
    with open(path, "r", encoding="utf-8") as file:
        return [line.strip() for line in file if line.strip()]


def choose_target_term(database_url: str) -> dict:
    today = date.today().isoformat()

    with psycopg.connect(database_url) as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                select code, label, start_date, end_date
                from academic_terms
                where %s between start_date and end_date
                order by start_date
                limit 1
                """,
                (today,),
            )
            active = cur.fetchone()
            if active:
                return dict(active)

            cur.execute(
                """
                select code, label, start_date, end_date
                from academic_terms
                where start_date > %s
                order by start_date
                limit 1
                """,
                (today,),
            )
            upcoming = cur.fetchone()
            if upcoming:
                return dict(upcoming)

    raise ValueError("No active or upcoming academic term found.")


def get_form_state(session: requests.Session) -> tuple[BeautifulSoup, dict]:
    page = session.get(BASE_URL, timeout=30, verify=VERIFY_SSL)
    page.raise_for_status()

    soup = BeautifulSoup(page.text, "html.parser")

    def get_val(element_id: str, default: str = ""):
        el = soup.select_one(f"#{element_id}")
        if el and el.has_attr("value"):
            return el["value"]
        return default

    state = {
        "__VIEWSTATE": get_val("__VIEWSTATE"),
        "__VIEWSTATEGENERATOR": get_val("__VIEWSTATEGENERATOR"),
        "__VIEWSTATEENCRYPTED": get_val("__VIEWSTATEENCRYPTED"),
        "__EVENTVALIDATION": get_val("__EVENTVALIDATION"),
    }

    return soup, state


def find_term_dropdown(soup: BeautifulSoup):
    selectors = [
        "#ctl00_ContentPlaceHolder1_TermDDL",
        "#ContentPlaceHolder1_TermDDL",
        "select[name='ctl00$ContentPlaceHolder1$TermDDL']",
        "select[id$='TermDDL']",
        "select[name$='TermDDL']",
    ]

    for selector in selectors:
        dropdown = soup.select_one(selector)
        if dropdown:
            return dropdown

    # Last-resort heuristic: find a select with Spring/Fall/Winter/Summer options.
    for select in soup.select("select"):
        option_text = " ".join(option.get_text(" ") for option in select.select("option"))
        option_text_lower = option_text.lower()

        if (
            "spring semester" in option_text_lower
            or "fall semester" in option_text_lower
            or "winter intersession" in option_text_lower
            or "summer semester" in option_text_lower
        ):
            return select

    return None


def fetch_schedule_term_options(session: requests.Session) -> list[dict]:
    soup, _state = get_form_state(session)
    dropdown = find_term_dropdown(soup)

    if not dropdown:
        available_selects = [
            {
                "id": select.get("id"),
                "name": select.get("name"),
                "options": [clean(option.get_text()) for option in select.select("option")[:5]],
            }
            for select in soup.select("select")
        ]

        raise ValueError(
            f"Could not find schedule term dropdown. Available selects: {available_selects}"
        )

    options = []

    for option in dropdown.select("option"):
        code = option.get("value", "").strip()
        label = clean(option.get_text())

        if code and label:
            options.append({"code": code, "label": label})

    if not options:
        raise ValueError("Found schedule term dropdown, but it had no options.")

    return options


def normalize_term_label(label: str) -> str:
    return re.sub(
        r"\s+",
        " ",
        label.lower()
        .replace("semester", "")
        .replace("intersession", "")
        .replace("session", "")
        .strip(),
    )


def find_schedule_code(target_term: dict, options: list[dict]) -> str:
    target = normalize_term_label(target_term["label"])

    for option in options:
        option_label = normalize_term_label(option["label"])

        if target == option_label:
            return option["code"]

    raise ValueError(
        f"No schedule.cpp.edu term code found for {target_term['label']}. "
        f"Normalized target: {target}. "
        f"Available terms: {options}"
    )


def scrape_cpp_schedule(
    session: requests.Session,
    class_subject: str,
    semester_code: str,
) -> str:
    _soup, state = get_form_state(session)

    payload = {
        "__EVENTTARGET": "",
        "__EVENTARGUMENT": "",
        "__VIEWSTATE": state["__VIEWSTATE"],
        "__VIEWSTATEGENERATOR": state["__VIEWSTATEGENERATOR"],
        "__VIEWSTATEENCRYPTED": state["__VIEWSTATEENCRYPTED"],
        "__EVENTVALIDATION": state["__EVENTVALIDATION"],

        "ctl00$ContentPlaceHolder1$TermDDL": semester_code,
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
        verify=VERIFY_SSL,
    )

    res.raise_for_status()
    return res.text


def parse_li(li) -> RawClass:
    course_el = li.select_one("span.ClassTitle strong")
    course = clean(course_el.get_text()) if course_el else ""

    full_text = clean(li.get_text(" ", strip=True))
    section_match = re.search(r"Section\s+(\w+)", full_text)
    section = section_match.group(1) if section_match else ""

    data = {}
    table = li.select_one("table")

    if table:
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

    return RawClass(
        course=course,
        section=section,
        class_number=data.get("Class Nbr", ""),
        title=data.get("Title", ""),
        time=data.get("Time", ""),
        date_range=data.get("Date", ""),
        instructor=data.get("Instructor", ""),
        capacity=data.get("Capacity", ""),
        units=data.get("Units", ""),
        building_room=data.get("Building/Room", ""),
        component_mode=data.get("Compnt./Mode", ""),
    )


def extract_classes_from_html(html: str) -> list[ClassInfo]:
    soup = BeautifulSoup(html, "html.parser")
    class_list = soup.select_one("#class_list ol")

    if not class_list:
        return []

    return [ClassInfo(parse_li(li)) for li in class_list.select("li")]


def insert_schedule_rows(database_url: str, rows: list[dict], semester: str):
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                delete from schedule_entries
                where semester = %s
                """,
                (semester,),
            )

            if rows:
                cur.executemany(
                    """
                    insert into schedule_entries
                    (room_id, day_of_week, start_time, end_time, course_name, semester)
                    values (%s, %s, %s, %s, %s, %s)
                    """,
                    [
                        (
                            row["roomId"],
                            row["dayOfWeek"],
                            row["startTime"],
                            row["endTime"],
                            row["courseName"],
                            row["semester"],
                        )
                        for row in rows
                    ],
                )

        conn.commit()

    print(f"Inserted {len(rows)} schedule_entries rows for {semester}.")


def upsert_rooms(database_url: str, room_rows: list[dict]) -> None:
    if not room_rows:
        print("No rooms to upsert.")
        return

    by_id = {}

    for row in room_rows:
        existing = by_id.get(row["id"])

        if not existing:
            by_id[row["id"]] = row
            continue

        # Keep largest known capacity.
        if row["capacity"] > existing["capacity"]:
            existing["capacity"] = row["capacity"]

        # Prefer useful room type over Unknown.
        if existing["type"] == "Unknown" and row["type"] != "Unknown":
            existing["type"] = row["type"]

    deduped = list(by_id.values())

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute("select id from buildings")
            valid_building_ids = {row[0] for row in cur.fetchall()}

            filtered = [
                row for row in deduped
                if row["buildingId"] in valid_building_ids
            ]

            skipped = [
                row for row in deduped
                if row["buildingId"] not in valid_building_ids
            ]

            if skipped:
                print(
                    "Skipped rooms for missing buildings:",
                    sorted({row["buildingId"] for row in skipped}),
                )

            cur.executemany(
                """
                insert into rooms (id, building_id, number, type, capacity)
                values (%s, %s, %s, %s, %s)
                on conflict (id) do update set
                  building_id = excluded.building_id,
                  number = excluded.number,
                  type = excluded.type,
                  capacity = greatest(rooms.capacity, excluded.capacity)
                where
                  rooms.building_id is distinct from excluded.building_id
                  or rooms.number is distinct from excluded.number
                  or rooms.type = 'Unknown'
                  or excluded.capacity > rooms.capacity
                """,
                [
                    (
                        row["id"],
                        row["buildingId"],
                        row["number"],
                        row["type"],
                        row["capacity"],
                    )
                    for row in filtered
                ],
            )

        conn.commit()

    print(f"Upserted {len(filtered)} rooms.")


def upsert_schedule_rows(database_url: str, rows: list[dict], semester: str):
    if not rows:
        print("No schedule rows to upsert.")
        return

    seen = set()
    deduped = []

    for row in rows:
        key = (
            row["roomId"],
            row["dayOfWeek"],
            row["startTime"],
            row["endTime"],
            row["courseName"],
            row["semester"],
        )

        if key in seen:
            continue

        seen.add(key)
        deduped.append(row)

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute("select id from rooms")
            valid_room_ids = {row[0] for row in cur.fetchall()}

        filtered = [row for row in deduped if row["roomId"] in valid_room_ids]
        skipped_count = len(deduped) - len(filtered)
        if skipped_count:
            print(f"Skipped {skipped_count} schedule entries for missing rooms.")

        with conn.cursor() as cur:
            cur.executemany(
                """
                insert into schedule_entries
                (room_id, day_of_week, start_time, end_time, course_name, semester)
                values (%s, %s, %s, %s, %s, %s)
                on conflict
                (room_id, day_of_week, start_time, end_time, course_name, semester)
                do nothing
                """,
                [
                    (
                        row["roomId"],
                        row["dayOfWeek"],
                        row["startTime"],
                        row["endTime"],
                        row["courseName"],
                        row["semester"]
                    )
                    for row in filtered
                ],
            )

        conn.commit()

    print(f"Inserted or skipped {len(filtered)} schedule entries for {semester}.")


def room_type_from_component(component: str) -> str:
    component_lower = (component or "").lower()

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


def sync_schedule(database_url: str) -> None:
    target_term = choose_target_term(database_url)

    session = requests.Session()
    term_options = fetch_schedule_term_options(session)
    print("Target term:", target_term)
    print("Schedule term options:", term_options)
    semester_code = find_schedule_code(target_term, term_options)
    semester_label = target_term["label"]

    print(f"Selected academic term: {semester_label}")
    print(f"Using schedule.cpp.edu term code: {semester_code}")

    subjects = load_subjects()
    room_rows: list[dict] = []
    schedule_rows: list[dict] = []

    for subject in subjects:
        print(f"Scraping {subject}...")
        html = scrape_cpp_schedule(session, subject, semester_code)
        infos = extract_classes_from_html(html)

        for info in infos:
            room_row = info.to_room_row()
            if room_row:
                room_rows.append(room_row)

            schedule_rows.extend(info.to_schedule_rows(semester_label))

    print("Sample room:", room_rows[0] if room_rows else "No rooms")
    print("Sample schedule row:", schedule_rows[0] if schedule_rows else "No schedule rows")

    upsert_rooms(database_url, room_rows)
    upsert_schedule_rows(database_url, schedule_rows, semester_label)


if __name__ == "__main__":
    ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
    load_dotenv(ENV_PATH)
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL not found")

    sync_schedule(database_url)