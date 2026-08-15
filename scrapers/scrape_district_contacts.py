"""
Scrapes district-level department/officer contacts from India's standard NIC
district-portal template (the "S3WaaS" template, deployed by most Indian
districts at <district>.nic.in or <district>.<state>.gov.in — same page
structure, different hostnames and occasionally different URL slugs).

The richest page on this template is usually /directory/ or /en/directory/ —
a sequence of per-department tables (Police, water board, development
authority, municipal corp, Zilla Panchayat, ...), each with name/
designation/email/phone. This is the piece CPGRAMS and LGD don't have: real
department contacts *per district*, not just per state/ministry.

Attribution quirk (verified by hand against known entities like BWSSB/BBMP
before trusting it): each table's department name is the <h2>/<h3>/<h4>
heading that comes AFTER it in the HTML, not before — the template renders
section labels below their content. Using find_previous() here silently
mislabels every row with the wrong department.

Every hostname below was confirmed by search before use, never guessed — a
wrong hostname would silently produce zero rows or scrape someone else's
site. Two states we looked for (Rajasthan/Jaipur, West Bengal/Kolkata)
don't appear to run this template under a findable hostname, so they're
left out rather than guessed at.

This covers one representative district per state so far, not all ~766
districts nationally — there's no lookup table of hostnames, each one is
found individually. Extending coverage means repeating that search per
district.

Usage:
    python3 scrapers/scrape_district_contacts.py
Writes data/departments/india_district_contacts.csv
"""

import csv
import pathlib

import requests
from bs4 import BeautifulSoup

from emailutil import deobfuscate_email

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "departments" / "india_district_contacts.csv"
USER_AGENT = "swaram-civic-scraper/0.1 (+hackathon research)"

# district_name -> (state, base hostname), all confirmed via search, not guessed
DISTRICTS = {
    "BENGALURU URBAN": ("KARNATAKA", "https://bengaluruurban.nic.in"),
    "MYSURU": ("KARNATAKA", "https://mysore.nic.in"),
    "BELAGAVI": ("KARNATAKA", "https://belagavi.nic.in"),
    "TUMAKURU": ("KARNATAKA", "https://tumkur.nic.in"),
    "DAKSHINA KANNADA": ("KARNATAKA", "https://dk.nic.in"),
    "PATNA": ("BIHAR", "https://patna.nic.in"),
    "AHMEDABAD": ("GUJARAT", "https://ahmedabad.nic.in"),
    "CHENNAI": ("TAMIL NADU", "https://chennai.nic.in"),
    "LUCKNOW": ("UTTAR PRADESH", "https://lucknow.nic.in"),
    "BHOPAL": ("MADHYA PRADESH", "https://bhopal.nic.in"),
    "PUNE": ("MAHARASHTRA", "https://pune.gov.in"),
}

CANDIDATE_PATHS = [
    "/en/directory/",
    "/directory/",
    "/en/contact-directory/",
    "/contact-directory/",
    "/contact-directory2/",
    "/en/about-district/whos-who/",
    "/en/aboutdistrict/whos-who/",
    "/en/telephone-directory/",
    "/telephone-directory/",
    "/en/district-administration/",
    "/district-administration/",
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


def scrape_district(state: str, district: str, base_url: str) -> list[dict]:
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
            # Some district sites list Designation + contact only, no separate
            # Name column (e.g. patna.nic.in/district-administration/) — accept
            # either, and locate columns by header instead of assuming position
            # 0/1, since column order isn't consistent across site templates.
            name_idx = next((i for i, h in enumerate(headers) if "name" in h), None)
            desig_idx = next((i for i, h in enumerate(headers) if "designation" in h), None)
            email_idx = next((i for i, h in enumerate(headers) if "mail" in h), None)
            if name_idx is None and desig_idx is None:
                continue

            heading_el = table.find_next(["h2", "h3", "h4"])
            heading = heading_el.get_text(strip=True) if heading_el else ""
            department = "" if heading.lower() in IGNORE_HEADINGS else heading

            for tr in table.find_all("tr")[1:]:
                cells = [td.get_text(" ", strip=True) for td in tr.find_all("td")]
                if len(cells) < 2:
                    continue
                name = cells[name_idx] if name_idx is not None and name_idx < len(cells) else ""
                designation = cells[desig_idx] if desig_idx is not None and desig_idx < len(cells) else ""
                if not name and not designation:
                    continue
                if email_idx is not None and email_idx < len(cells):
                    email_field = cells[email_idx]
                else:
                    email_field = next((c for c in cells if "@" in c or "[at]" in c), "")
                rows_out.append(
                    {
                        "state": state,
                        "district": district,
                        "department": department,
                        "name": name,
                        "designation": designation,
                        "email": deobfuscate_email(email_field),
                        "source_url": base_url + path,
                    }
                )
        if rows_out:
            print(f"{state} / {district}: {path} -> {len(rows_out)} rows")
            return rows_out

    print(f"{state} / {district}: no working contact page found among {CANDIDATE_PATHS}")
    return []


if __name__ == "__main__":
    all_rows: list[dict] = []
    for district, (state, base_url) in DISTRICTS.items():
        all_rows.extend(scrape_district(state, district, base_url))

    with open(OUT, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["state", "district", "department", "name", "designation", "email", "source_url"],
        )
        writer.writeheader()
        writer.writerows(all_rows)
    states_covered = len({s for s, _ in DISTRICTS.values()})
    print(f"\n{OUT} — {len(all_rows)} rows across {len(DISTRICTS)} districts in {states_covered} states")
