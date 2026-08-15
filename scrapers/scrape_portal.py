"""
Scaffold for pulling public department/status metadata off a city's civic
grievance portal (data/departments/portals.json).

None of the portals in the registry have a confirmed JSON API yet — this
script's job is to fetch-and-cache each portal's HTML, check robots.txt,
and flag whether the page looks like a server-rendered page (safe for
BeautifulSoup) or a JS single-page app (needs DevTools inspection for the
underlying XHR/JSON endpoint before any scraping logic is worth writing).

Usage:
    python scrapers/scrape_portal.py --city Bengaluru
    python scrapers/scrape_portal.py --all

What this deliberately does NOT do: log in, submit forms, or fetch anything
behind a captcha/OTP wall. It also never collects complainant names or phone
numbers — only public department/ward/status metadata (DPDP Act boundary).
"""

import argparse
import json
import pathlib
import time
import urllib.robotparser
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

ROOT = pathlib.Path(__file__).resolve().parent.parent
PORTALS_FILE = ROOT / "data" / "departments" / "portals.json"
CACHE_DIR = ROOT / "data" / "raw" / "portals"
USER_AGENT = "swaram-civic-scraper/0.1 (+hackathon research; contact via repo)"
RATE_LIMIT_SECONDS = 1.0


def load_portals() -> list[dict]:
    data = json.loads(PORTALS_FILE.read_text())
    return [c for c in data["cities"] if c.get("url")]


def robots_allows(url: str) -> bool:
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    rp = urllib.robotparser.RobotFileParser()
    try:
        rp.set_url(robots_url)
        rp.read()
        return rp.can_fetch(USER_AGENT, url)
    except Exception:
        # No robots.txt reachable — proceed, but this is worth a manual check.
        return True


def classify(html: str) -> str:
    """Returns 'spa', 'blocked', or 'server_rendered' as a best-effort guess.
    This is a heuristic, not a guarantee — always eyeball the cached HTML."""
    soup = BeautifulSoup(html, "lxml")
    body_text = soup.get_text(separator=" ", strip=True)
    text_lower = body_text.lower()
    if "enable javascript" in text_lower and soup.find(id="root"):
        return "spa"
    if "not compatible with your browser" in text_lower or "contact your system administrator" in text_lower:
        return "blocked"
    script_count = len(soup.find_all("script"))
    if len(body_text) < 500 and script_count > 3:
        return "spa"
    return "server_rendered"


def fetch_one(entry: dict) -> None:
    url = entry["url"]
    city = entry["city"]
    print(f"\n=== {city} — {entry['portal_name']} ===")
    print(f"url: {url}")

    if not robots_allows(url):
        print("robots.txt disallows fetching this URL — skipping.")
        return

    resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=20)
    resp.raise_for_status()

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    slug = city.lower().replace(" ", "_")
    cache_path = CACHE_DIR / f"{slug}.html"
    cache_path.write_text(resp.text, encoding="utf-8")
    print(f"cached -> {cache_path} ({len(resp.text)} bytes)")

    verdict = classify(resp.text)
    if verdict == "spa":
        print(
            "looks like a JS-rendered SPA (little static text, several <script> "
            "tags). Open this URL in a browser, DevTools > Network > XHR, and "
            "look for a JSON endpoint before writing a scraper for this portal."
        )
    elif verdict == "blocked":
        print(
            "response looks like a bot/browser-compatibility wall (e.g. SAP "
            "portal rejecting the request), not real content. A plain requests.get "
            "won't work here — this needs a real browser (Playwright) or the "
            "portal's underlying API, if one exists."
        )
    else:
        print("looks server-rendered — BeautifulSoup against the cached HTML should work.")

    time.sleep(RATE_LIMIT_SECONDS)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--city", help="Fetch only this city (matches portals.json 'city' field)")
    parser.add_argument("--all", action="store_true", help="Fetch every portal with a known URL")
    args = parser.parse_args()

    portals = load_portals()
    if args.city:
        portals = [p for p in portals if p["city"].lower() == args.city.lower()]
        if not portals:
            print(f"no portal with url found for city={args.city!r}")
            return
    elif not args.all:
        parser.error("pass --city <name> or --all")

    for entry in portals:
        try:
            fetch_one(entry)
        except requests.exceptions.SSLError:
            print("SSL verification failed — likely a broken local CA bundle "
                  "(common in sandboxed/CI environments), not necessarily a "
                  "problem with the portal itself. Try `pip install --upgrade "
                  "certifi` or run this on a normal machine before concluding "
                  "the portal is down.")
        except requests.exceptions.RequestException as exc:
            print(f"failed to fetch {entry['url']}: {exc}")


if __name__ == "__main__":
    main()
