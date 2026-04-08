import requests
import urllib3
#import json
import certifi
import re
from bs4 import BeautifulSoup
from datetime import datetime
from seed_neon import insert_schedule_rows

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = "https://schedule.cpp.edu/"
VERIFY_SSL = False

class RawClass:
    def __init__(self, course: str, section: str, class_number: str, title: str, time: str, date_range: str, instructor: str, capacity: str, units: str, building_room: str, component_mode: str):
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

    def to_schedule_rows(self, semester: str) -> list[dict]:
        if not self.building or not self.room:
            return []
        if not self.time_start or not self.time_end:
            return []
        if not self.day_of_week:
            return []

        room_id = f"{self.building}-{self.room}"
        course_name = f"{self.course_subject} {self.course_code}".strip()

        rows = []
        for day in self.day_of_week:
            rows.append({
                "roomId": room_id,
                "dayOfWeek": day,
                "startTime": self.time_start,
                "endTime": self.time_end,
                "courseName": course_name,
                "semester": semester,
            })
        return rows

    @staticmethod
    def _clean(text: str) -> str:
        return " ".join((text or "").replace("\xa0", " ").split())

    @classmethod
    def _parse_course(cls, course: str):
        course = cls._clean(course)
        m = re.match(r"^([A-Z]+)\s+(.+)$", course)
        if not m:
            return course, ""
        return m.group(1), m.group(2)

    @classmethod
    def _parse_time(cls, raw_time: str):
        raw_time = cls._clean(raw_time)

        # Example: "2:30 PM–3:45 PM MW"
        m = re.match(r"^(.*?(?:AM|PM))\s*[–-]\s*(.*?(?:AM|PM))\s+([A-Za-z]+)$", raw_time)
        if not m:
            return raw_time, "", []
        start = m.group(1).strip()
        end = m.group(2).strip()
        days = m.group(3).strip()

        time_start = cls._to_24h(start)
        time_end = cls._to_24h(end)
        day_list = cls._expand_days(days)

        return time_start, time_end, day_list

    @staticmethod
    def _to_24h(time_str: str) -> str:
        return datetime.strptime(time_str, "%I:%M %p").strftime("%H:%M")

    @staticmethod
    def _expand_days(days: str):
        result = []
        i = 0
        while i < len(days):
            if days[i:i+2] == "Tu":
                result.append("TUE")
                i += 2
            elif days[i:i+2] == "Th":
                result.append("THU")
                i += 2
            elif days[i:i+2] == "Sa":
                result.append("SAT")
                i += 2
            elif days[i:i+2] == "Su":
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

    @classmethod
    def _parse_date_range(cls, raw_date: str):
        raw_date = cls._clean(raw_date)
        parts = re.split(r"\s+to\s+", raw_date, flags=re.IGNORECASE)
        if len(parts) != 2:
            return raw_date, ""
        return parts[0], parts[1]

    @classmethod
    def _parse_building_room(cls, raw_building_room: str):
        raw_building_room = cls._clean(raw_building_room)

        # Example: "Bldg 1 Rm 103"
        m = re.match(r"^Bldg\s+(.+?)\s+Rm\s+(.+)$", raw_building_room, re.IGNORECASE)
        if not m:
            return raw_building_room, ""
        return m.group(1).strip(), m.group(2).strip()

    @classmethod
    def _parse_component_mode(cls, raw_component_mode: str):
        raw_component_mode = cls._clean(raw_component_mode)
        parts = [p.strip() for p in raw_component_mode.split(",", 1)]
        if len(parts) == 2:
            return parts[0], parts[1]
        return raw_component_mode, ""

def scrape_cpp_schedule(class_subject: str) -> str:
    session = requests.Session()

    # 1. Load form page
    page = session.get(BASE_URL, timeout=30, verify=VERIFY_SSL)
    page.raise_for_status()

    soup = BeautifulSoup(page.text, "html.parser")

    def get_val(element_id: str, default: str = ""):
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

        "ctl00$ContentPlaceHolder1$TermDDL": "2263",  # Spring Semester 2026
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

        # default checked class days
        "ctl00$ContentPlaceHolder1$ClassDays$0": "on",  # M
        "ctl00$ContentPlaceHolder1$ClassDays$1": "on",  # Tu
        "ctl00$ContentPlaceHolder1$ClassDays$2": "on",  # W
        "ctl00$ContentPlaceHolder1$ClassDays$3": "on",  # Th
        "ctl00$ContentPlaceHolder1$ClassDays$4": "on",  # F
        "ctl00$ContentPlaceHolder1$ClassDays$5": "on",  # Sa
        "ctl00$ContentPlaceHolder1$ClassDays$6": "on",  # Su
        "ctl00$ContentPlaceHolder1$ClassDays$7": "on",  # TBA

        "ctl00$ContentPlaceHolder1$SearchButton": "Search",
    }

    headers = {
        "User-Agent": "Mozilla/5.0",
        "Referer": BASE_URL,
    }

    res = session.post(BASE_URL, data=payload, headers=headers, timeout=30, verify=VERIFY_SSL)
    res.raise_for_status()
    return res.text

def extract_classes_from_html(html: str) -> list[ClassInfo]:
    soup = BeautifulSoup(html, "html.parser")
    class_list = soup.select_one("#class_list ol")
    if not class_list:
        return []
    items = class_list.select("li")
    classes: list[ClassInfo] = []
    for li in items:
        classes.append(ClassInfo(parse_li(li)))
    return classes


def clean(text: str) -> str:
    return " ".join(text.replace("\xa0", " ").split())

def parse_li(li) -> RawClass:
    # --- 1. COURSE ---
    course_el = li.select_one("span.ClassTitle strong")
    course = clean(course_el.get_text()) if course_el else ""

    # --- 2. SECTION ---
    full_text = clean(li.get_text(" ", strip=True))
    section_match = re.search(r"Section\s+(\w+)", full_text)
    section = section_match.group(1) if section_match else ""

    # --- 3. TABLE → DICT ---
    data = {}
    table = li.select_one("table")

    if table:
        for tr in table.select("tr"):
            cells = tr.find_all(["th", "td"])

            # iterate in pairs: th -> td
            i = 0
            while i < len(cells) - 1:
                if cells[i].name == "th" and cells[i + 1].name == "td":
                    key = clean(cells[i].get_text())
                    value = clean(cells[i + 1].get_text())
                    data[key] = value
                    i += 2
                else:
                    i += 1

    # --- 4. MAP TO CLASS ---
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


if __name__ == "__main__":
    with open("class_subjects.txt", "r") as f:
        class_subjects = [line.strip() for line in f if line.strip()]

    classes: list[ClassInfo] = []
    schedule_rows: list[dict] = []
    semester = "Spring 2026"

    for subject in class_subjects:
        print(f"Scraping {subject}...")
        subject_page = scrape_cpp_schedule(subject)
        infos = extract_classes_from_html(subject_page)

        classes.extend(infos)

        for info in infos:
            schedule_rows.extend(info.to_schedule_rows(semester))

    print("Sample row:", schedule_rows[0] if schedule_rows else "No rows")
    
    insert_schedule_rows(schedule_rows, semester)
    