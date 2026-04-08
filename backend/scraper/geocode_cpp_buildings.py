#!/usr/bin/env python3

import csv
import re
from typing import Optional, Tuple

INPUT_CSV = "cpp_buildings.csv"
OUTPUT_CSV = "cpp_buildings_grid_coords.csv"

# Approximate bounding box for the main CPP campus map area.
# These are meant for campus-internal placement, not survey-grade coordinates.
#
# Top-left  ~= northwest corner of the mapped campus
# Bottom-right ~= southeast corner of the mapped campus
#
# You can tweak these later if points look slightly shifted.
TOP_LAT = 34.0669
BOTTOM_LAT = 34.0472
LEFT_LON = -117.8206
RIGHT_LON = -117.8010

ROW_ORDER = ["A", "B", "C", "D", "E", "F", "G", "H"]
COL_MIN = 1
COL_MAX = 12


def parse_locator(locator: str) -> Optional[Tuple[str, int]]:
    """
    Parse locators like:
      B-4
      E-12
      B-7,B-8
      C-4,D-5,C-7
      See inset
    Returns the first valid grid cell found.
    """
    if not locator:
        return None

    locator = locator.strip()
    matches = re.findall(r"([A-H])\s*-\s*(\d{1,2})", locator, flags=re.IGNORECASE)
    if not matches:
        return None

    row_letter, col_str = matches[0]
    row_letter = row_letter.upper()
    col = int(col_str)

    if row_letter not in ROW_ORDER:
        return None
    if not (COL_MIN <= col <= COL_MAX):
        return None

    return row_letter, col


def grid_cell_center(row_letter: str, col: int) -> Tuple[float, float]:
    """
    Convert a map grid cell to the centerpoint lat/lon.
    Rows A-H go top to bottom.
    Cols 1-12 go left to right.
    """
    row_index = ROW_ORDER.index(row_letter)  # 0..7
    col_index = col - 1                      # 0..11

    total_rows = len(ROW_ORDER)
    total_cols = COL_MAX - COL_MIN + 1

    lat_step = (TOP_LAT - BOTTOM_LAT) / total_rows
    lon_step = (RIGHT_LON - LEFT_LON) / total_cols

    lat = TOP_LAT - (row_index + 0.5) * lat_step
    lon = LEFT_LON + (col_index + 0.5) * lon_step

    return round(lat, 7), round(lon, 7)


def main() -> None:
    with open(INPUT_CSV, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    out_rows = []

    for row in rows:
        building_number = row["building_number"].strip()
        building_name = row["building_name"].strip()
        locator = row.get("locator", "").strip()

        parsed = parse_locator(locator)

        if parsed is None:
            latitude = ""
            longitude = ""
            coord_source = "unresolved"
            needs_review = "yes"
            locator_used = ""
        else:
            row_letter, col = parsed
            latitude, longitude = grid_cell_center(row_letter, col)
            coord_source = "pdf_grid_estimate"
            needs_review = "yes" if "," in locator or "inset" in locator.lower() else "no"
            locator_used = f"{row_letter}-{col}"

        out_rows.append({
            "building_number": building_number,
            "building_name": building_name,
            "locator": locator,
            "locator_used": locator_used,
            "latitude": latitude,
            "longitude": longitude,
            "coord_source": coord_source,
            "needs_review": needs_review,
        })

    fieldnames = [
        "building_number",
        "building_name",
        "locator",
        "locator_used",
        "latitude",
        "longitude",
        "coord_source",
        "needs_review",
    ]

    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(out_rows)

    print(f"Wrote {OUTPUT_CSV}")


if __name__ == "__main__":
    main()