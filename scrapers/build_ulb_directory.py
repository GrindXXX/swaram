"""
Joins the raw LGD files into one flat, README-friendly directory:
state, district, local body name, local body type, LGD code.

urban_local_bodies.csv has the local body + its type, but no district.
municipal_directory.csv (a subdistrict/village-level mapping) has the
district for each local body code. This joins the two on Localbody Code.

Run after scrapers/fetch_lgd_data.py. Writes data/departments/ulb_directory.csv.
"""

import csv
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "lgd"
OUT = ROOT / "data" / "departments" / "ulb_directory.csv"


def main() -> None:
    type_codes = {
        r["Local Body Code"]: r["Description"]
        for r in csv.DictReader(open(RAW / "local_body_type_codes.csv"))
    }

    district_by_code: dict[str, str] = {}
    with open(RAW / "municipal_directory.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            code = row["Localbody Code"]
            if code and code not in district_by_code:
                district_by_code[code] = row["District Name"]

    out_rows = []
    missing_district = 0
    with open(RAW / "urban_local_bodies.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            code = row["Local Body Code"]
            district = district_by_code.get(code, "")
            if not district:
                missing_district += 1
            out_rows.append(
                {
                    "state": row["State Name"],
                    "district": district,
                    "local_body_name": row["Local Body Name"],
                    "local_body_type": type_codes.get(row["Localbody Type Code"], ""),
                    "lgd_local_body_code": code,
                }
            )

    with open(OUT, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(out_rows[0].keys()))
        writer.writeheader()
        writer.writerows(out_rows)

    print(f"{OUT} — {len(out_rows)} rows, {missing_district} with no district match "
          f"({missing_district / len(out_rows):.1%})")


if __name__ == "__main__":
    main()
