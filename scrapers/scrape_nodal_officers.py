"""
Scrapes the public CPGRAMS officer directories:

- pgportal.gov.in/Home/NodalPgOfficers          -> central ministries/departments,
  first-contact ("nodal") officer
- pmopg.gov.in/CitizenReforms/Home/NodalPgOfficersState -> state governments,
  first-contact officer
- pgportal.gov.in/Home/NodalAuthorityForAppeal  -> central ministries/departments,
  second-contact ("appellate") officer — who to escalate to if the nodal
  officer doesn't resolve it

All three are plain server-rendered HTML tables (no JS, no auth, no
robots.txt block) published by DARPG specifically so the public can reach a
named contact. That makes them the closest thing to a legitimate "department
directory with names + emails" that's realistically scrapable.

They are NOT district-level — one row per ministry (central) or per state,
not per district. District-level department contacts would need a separate
scrape per state (each district collectorate site has its own "who's who"
page, no common format) — out of scope for this pass.

There is a fourth, larger layer — CPGRAMS's full ministry -> department ->
organization tree, used to route a grievance to a specific sub-office/PSU
when you file one — but the Lodge Grievance page that exposes it requires a
logged-in citizen account. That's not scraped here; doing so would mean
authenticating as a citizen just to extract data, which this script
deliberately does not do.

Usage:
    python3 scrapers/scrape_nodal_officers.py
Writes data/departments/nodal_officers_central.csv,
data/departments/nodal_officers_state.csv, and
data/departments/appeal_officers_central.csv.
"""

import csv
import pathlib

import requests
from bs4 import BeautifulSoup

from emailutil import deobfuscate_email

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "data" / "departments"
USER_AGENT = "swaram-civic-scraper/0.1 (+hackathon research)"

SOURCES = {
    "nodal_officers_central.csv": "https://pgportal.gov.in/Home/NodalPgOfficers",
    "nodal_officers_state.csv": "https://pmopg.gov.in/CitizenReforms/Home/NodalPgOfficersState",
    "appeal_officers_central.csv": "https://pgportal.gov.in/Home/NodalAuthorityForAppeal",
}


def scrape(url: str) -> list[dict]:
    try:
        resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=20)
    except requests.exceptions.SSLError:
        print(
            f"WARNING: TLS verification failed for {url} — falling back to "
            "verify=False for this run. That's a real security downgrade; only "
            "acceptable because this is a known broken-CA-bundle sandbox issue "
            "(see README). Don't ship verify=False as a default."
        )
        resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=20, verify=False)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "lxml")
    table = soup.find("table")
    rows = table.find_all("tr")

    out = []
    for tr in rows[1:]:  # skip header
        cells = [td.get_text(" ", strip=True) for td in tr.find_all("td")]
        if len(cells) < 5:
            continue
        _, org, officer, address, contact = cells[:5]
        out.append(
            {
                "organisation": org,
                "officer_name_designation": officer,
                "address": address,
                "phone_fax_raw": contact,
                "email": deobfuscate_email(contact),
                "source_url": url,
            }
        )
    return out


def write_csv(name: str, rows: list[dict]) -> None:
    dest = OUT_DIR / name
    with open(dest, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    print(f"{dest} — {len(rows)} rows")


if __name__ == "__main__":
    for filename, url in SOURCES.items():
        rows = scrape(url)
        write_csv(filename, rows)
