#!/usr/bin/env python3

import csv
import folium

INPUT_CSV = "cpp_buildings_grid_coords.csv"
OUTPUT_HTML = "cpp_buildings_map.html"

# Rough center of CPP
MAP_CENTER = [34.0565, -117.8115]


def parse_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def main():
    m = folium.Map(location=MAP_CENTER, zoom_start=16)

    with open(INPUT_CSV, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            lat = parse_float(row.get("latitude"))
            lon = parse_float(row.get("longitude"))
            if lat is None or lon is None:
                continue

            building_number = row.get("building_number", "")
            building_name = row.get("building_name", "")
            locator = row.get("locator", "")
            locator_used = row.get("locator_used", "")
            source = row.get("coord_source", "")
            review = row.get("needs_review", "")

            popup = f"""
            <b>{building_number} - {building_name}</b><br>
            locator: {locator}<br>
            locator_used: {locator_used}<br>
            source: {source}<br>
            needs_review: {review}
            """

            color = "red" if review == "yes" else "blue"

            folium.CircleMarker(
                location=[lat, lon],
                radius=5,
                popup=folium.Popup(popup, max_width=300),
                tooltip=f"{building_number} - {building_name}",
                color=color,
                fill=True,
                fill_opacity=0.8,
            ).add_to(m)

    m.save(OUTPUT_HTML)
    print(f"Wrote {OUTPUT_HTML}")


if __name__ == "__main__":
    main()