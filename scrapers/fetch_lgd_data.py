"""
Downloads India's Local Government Directory (LGD) data — states, districts,
and urban local bodies — into data/raw/lgd/.

This is NOT a scrape of a login-walled or JS-rendered site: LGD is bulk
open data mirrored on GitHub from lgdirectory.gov.in (GODL-India licence).
Re-run this any time to refresh data/raw/lgd/.

For a live/authoritative pull instead of the GitHub mirror, register for a
free API key at https://data.gov.in and fetch from
https://api.data.gov.in/resource/<resource-id>?api-key=<key>&format=json
(resource ids are shown on each dataset's page, e.g.
https://www.data.gov.in/resource/local-government-directory-lgd-states).
"""

import csv
import pathlib

import requests

RAW_BASE = "https://raw.githubusercontent.com/planemad/india-local-government-directory/main"

FILES = {
    "states.csv": f"{RAW_BASE}/administrative/1-state.csv",
    "districts.csv": f"{RAW_BASE}/administrative/2-district.csv",
    "urban_local_bodies.csv": f"{RAW_BASE}/municipal/urban-local-body.csv",
    "local_body_type_codes.csv": f"{RAW_BASE}/municipal/local-body-type-code.csv",
}

OUT_DIR = pathlib.Path(__file__).resolve().parent.parent / "data" / "raw" / "lgd"


def fetch(name: str, url: str) -> None:
    dest = OUT_DIR / name
    print(f"fetching {url} -> {dest}")
    resp = requests.get(url, headers={"User-Agent": "swaram-civic-scraper/0.1"}, timeout=30)
    resp.raise_for_status()
    dest.write_bytes(resp.content)


def summarize() -> None:
    with open(OUT_DIR / "urban_local_bodies.csv", newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    by_state: dict[str, int] = {}
    for row in rows:
        by_state[row["State Name"]] = by_state.get(row["State Name"], 0) + 1
    print(f"\n{len(rows)} urban local bodies across {len(by_state)} states/UTs")
    for state, count in sorted(by_state.items(), key=lambda kv: -kv[1])[:10]:
        print(f"  {state:35s} {count}")


if __name__ == "__main__":
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, url in FILES.items():
        fetch(name, url)
    summarize()
