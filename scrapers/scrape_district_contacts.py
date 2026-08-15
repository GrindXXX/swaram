"""
Scrapes district-level department/officer contacts from India's standard NIC
district-portal template (the "S3WaaS" template — same page structure at
<district>.nic.in across most Indian districts).

The richest page on this template is /en/directory/ — a sequence of per-
department tables (Police, BWSSB, BDA, BBMP, Zilla Panchayat, ...), each
with name/designation/email/phone. This is the piece CPGRAMS and LGD don't
have: real department contacts *per district*, not just per state/ministry.

Attribution quirk (verified by hand against known entities like BWSSB/BBMP
before trusting it): each table's department name is the <h2>/<h3>/<h4>
heading that comes AFTER it in the HTML, not before — the template renders
section labels below their content. Using find_previous() here silently
mislabels every row with the wrong department.

Falls back to /en/contact-directory/ or the who's-who page when a district's
site doesn't have /en/directory/.

Karnataka pilot: 5 districts with hostnames confirmed by search (not
guessed — a wrong hostname would silently produce zero rows or scrape
someone else's site). Extending to all ~31 Karnataka districts / ~766 India
districts means finding each remaining hostname the same way — NIC does not
publish a lookup table of them.

Usage:
    python3 scrapers/scrape_district_contacts.py
Writes data/departments/karnataka_district_contacts.csv
"""

import csv
import pathlib

import requests
from bs4 import BeautifulSoup

from emailutil import deobfuscate_email

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "departments" / "karnataka_district_contacts.csv"
USER_AGENT = "swaram-civic-scraper/0.1 (+hackathon research)"

# district_name -> base hostname, confirmed via search (2026-08-15), not guessed
DISTRICTS = {
    "BENGALURU URBAN": "https://bengaluruurban.nic.in",
    "MYSURU": "https://mysore.nic.in",
    "BELAGAVI": "https://belagavi.nic.in",
    "TUMAKURU": "https://tumkur.nic.in",
    "DAKSHINA KANNADA": "https://dk.nic.in",
}

CANDIDATE_PATHS = [
    "/en/directory/",
    "/en/contact-directory/",
    "/en/about-district/whos-who/",
    "/en/aboutdistrict/whos-who/",
]

IGNORE_HEADINGS = {"more menu"}


def get(url: str) -> requests.Response | None:
    try:
        resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=20)
    except requests.exceptions.SSLError:
        resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=20, verify=False)
    except requests.exceptions.RequestException:
        return None
    return resp if resp.status_code == 200 else None


def scrape_district(district: str, base_url: str) -> list[dict]:
    for path in CANDIDATE_PATHS:
        resp = get(base_url + path)
        if resp is None:
            continue
        soup = BeautifulSoup(resp.text, "lxml")
        tables = soup.find_all("table")
        if not tables:
            continue

        rows_out: list[dict] = []
        for table in tables:
            headers = [th.get_text(" ", strip=True).lower() for th in table.find_all("th")]
            if not any("name" in h for h in headers):
                continue

            heading_el = table.find_next(["h2", "h3", "h4"])
            heading = heading_el.get_text(strip=True) if heading_el else ""
            department = "" if heading.lower() in IGNORE_HEADINGS else heading

            for tr in table.find_all("tr")[1:]:
                cells = [td.get_text(" ", strip=True) for td in tr.find_all("td")]
                if len(cells) < 3:
                    continue
                name, designation = cells[0], cells[1]
                email_field = next((c for c in cells if "@" in c or "[at]" in c), "")
                rows_out.append(
                    {
                        "district": district,
                        "department": department,
                        "name": name,
                        "designation": designation,
                        "email": deobfuscate_email(email_field),
                        "source_url": base_url + path,
                    }
                )
        if rows_out:
            print(f"{district}: {path} -> {len(rows_out)} rows")
            return rows_out

    print(f"{district}: no working contact page found among {CANDIDATE_PATHS}")
    return []


if __name__ == "__main__":
    all_rows: list[dict] = []
    for district, base_url in DISTRICTS.items():
        all_rows.extend(scrape_district(district, base_url))

    with open(OUT, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f, fieldnames=["district", "department", "name", "designation", "email", "source_url"]
        )
        writer.writeheader()
        writer.writerows(all_rows)
    print(f"\n{OUT} — {len(all_rows)} rows across {len(DISTRICTS)} districts")
