# swaram

Civic issue reporting + public accountability layer for India. Citizens photograph
an issue (pothole, garbage, outage, ...), it gets geo-tagged, routed to the
department actually responsible, and tracked publicly — including when a
department falsely marks something resolved.

This does not replace official complaint portals (Swachhata-MoHUA, BBMP Sahaaya,
GHMC, MCD 311, etc). It sits on top of them as an independent public scoreboard.

## Repo layout

```
data/
  raw/lgd/                    Bulk-downloaded Local Government Directory data (see below)
  raw/portals/                Cached HTML from official grievance portals (scraper output)
  departments/
    taxonomy.json             Civic issue category -> type of authority responsible
    state_agencies.csv        State-level water boards / electricity DISCOMs (not in LGD)
    portals.json              Registry of official city grievance portals + scrape status
    ulb_directory.csv         4,814 urban local bodies, joined to their district (see below)
    nodal_officers_central.csv  92 central ministries/departments — real name + email
    nodal_officers_state.csv    37 states/UTs — real name + email
scrapers/
  fetch_lgd_data.py           Downloads state/district/urban-local-body data for all of India
  build_ulb_directory.py      Joins ULBs to their district -> ulb_directory.csv
  scrape_nodal_officers.py    Scrapes real dept/state contact directories -> nodal_officers_*.csv
  scrape_portal.py            Fetches + classifies official portals (server-rendered / SPA / blocked)
  requirements.txt
schema/
  department.schema.json      Resolved-department shape
  ticket.schema.json          A single reported issue, incl. transfer-chain + disputed-closure fields
```

## Where the department data comes from

**Jurisdiction directory (who governs where) — bulk open data, no scraping needed.**
`scrapers/fetch_lgd_data.py` pulls India's Local Government Directory (LGD, Ministry
of Panchayati Raj — the standard location/local-body code mandated for all
e-governance systems since 2016) from the GODL-India-licensed GitHub mirror of
lgdirectory.gov.in. One run gets:

- 36 states/UTs (`data/raw/lgd/states.csv`)
- 763 districts (`data/raw/lgd/districts.csv`)
- **4,814 urban local bodies across India** (`data/raw/lgd/urban_local_bodies.csv`) —
  every Municipal Corporation, Municipality, Town Panchayat, Notified Area
  Council, etc., with its LGD code, district, and state.

Run it any time to refresh:
```
pip install -r scrapers/requirements.txt
python3 scrapers/fetch_lgd_data.py
```

For a live/authoritative pull instead of the mirror: register a free instant API
key at [data.gov.in](https://data.gov.in), then hit
`https://api.data.gov.in/resource/<resource-id>?api-key=<key>&format=json` —
resource IDs are on each dataset's page (e.g. the LGD States dataset).

### Departments by district (`data/departments/ulb_directory.csv`)

`scrapers/build_ulb_directory.py` joins the raw LGD files (local body ↔ district
share a code, not a name — this is what does the join) into one flat table:
**all 4,814 urban local bodies, each tagged with its district.** Match rate:
4,809/4,814 (99.9%) — 5 rows have no district match, worth a manual look before
relying on them.

By local body type, nationally:

| Type | Count |
|---|---|
| Town Panchayat | 2,364 |
| Municipality | 1,826 |
| Municipal Corporation | 248 |
| Notified Area Council | 136 |
| Town Municipal Council | 120 |
| City Municipal Council | 60 |
| Municipal Council | 59 |
| NCT Municipal Council | 1 (Delhi) |

Sample rows (Bengaluru area — this also doubles as a correctness check: BBMP
itself shows up correctly as the Municipal Corporation for BENGALURU URBAN):

| State | District | Local Body | Type | LGD Code |
|---|---|---|---|---|
| KARNATAKA | BENGALURU URBAN | BBMP | Municipal Corporation | 276600 |
| KARNATAKA | BENGALURU URBAN | Attibele | Town Municipal Council | 276539 |
| KARNATAKA | BENGALURU URBAN | Chandapura | Town Municipal Council | 276533 |
| KARNATAKA | BENGALURU RURAL | Devanahalli | Town Municipal Council | 251994 |
| KARNATAKA | BENGALURU RURAL | Dod Ballapur | City Municipal Council | 251992 |

Full 4,814-row table is in the CSV — this is a sample, not the whole dataset.

### Department names + emails (`data/departments/nodal_officers_*.csv`)

This is real, scraped, verifiable data — not filled in from memory. DARPG (Dept
of Administrative Reforms & Public Grievances) publishes exactly this — a named
contact per department — as plain server-rendered HTML tables, no auth, no JS:

- `pgportal.gov.in/Home/NodalPgOfficers` → **92 central ministries/departments**
- `pmopg.gov.in/CitizenReforms/Home/NodalPgOfficersState` → **37 states/UTs**

`scrapers/scrape_nodal_officers.py` scrapes both, de-obfuscates the `[at]`/`[dot]`
email encoding, and writes two CSVs. Every one of the 129 rows produced a
syntactically valid email on this run. Sample:

| Organisation | Officer | Email |
|---|---|---|
| Administrative Reforms and Public Grievances | Sardendu Kumar Pandey, Director | Director-pg@gov.in |
| Agriculture and Farmers Welfare | Shri Rajesh Kumar, Deputy Secretary PG | rajesh.kumar67@nic.in |
| Atomic Energy | Shri K.V. Madhavadas, Deputy Secretary | dsscs@dae.gov.in |
| Central Board of Direct Taxes | Swapna Devireddy, Addl. Director | delhi.addldit.eservices@incometax.gov.in |
| **Karnataka** (state) | Suma.S, Under Secretary | *see CSV* |
| **Maharashtra** (state) | Hemant Anant Mahajan, Deputy Secretary | *see CSV* |

**Important limitation: this is ministry-level and state-level, not district-level.**
One row per central department, one row per state — not one row per department
per district. A true district-level directory (e.g. "BBMP Solid Waste Dept,
Bengaluru Urban, email X") would need scraping each district collectorate's own
"who's who" page one state at a time — no common format across states, genuinely
a much larger job. Treat these two CSVs as the pan-India escalation layer (who do
you email if a city-level portal stonewalls you), not the primary routing table —
`ulb_directory.csv` + `taxonomy.json` do the actual per-ticket routing.

**State-level utility boards (water boards, electricity DISCOMs) — not in LGD,
hand-curated.** These are parastatal agencies, not local governments, so they
don't show up in the LGD directory. `data/departments/state_agencies.csv` has a
first pass for all 36 states/UTs. **Every row is marked `verified=FALSE`** except
where noted — this is a starting seed from general knowledge, not a verified
source. Before the demo, cross-check each state you actually route tickets for
against the agency's own site.

**Ward-level assignment + live complaint volumes — needs scraping, and it's the
hard part.** `data/departments/portals.json` tracks 5 metro portals we found and
already probed once (`scrapers/scrape_portal.py`, run 2026-08-15):

| City | Portal | Status |
|---|---|---|
| Hyderabad | GHMC | fetches fine, server-rendered → BeautifulSoup works |
| Chennai | GCC Public Grievance Redressal | fetches fine, server-rendered → BeautifulSoup works |
| Delhi | MCD 311 | confirmed React SPA — needs DevTools inspection for the JSON API |
| Mumbai | MCGM (SAP iView portal) | rejects plain requests — needs Playwright or its underlying SAP web service |
| Bengaluru | Sahaaya 2.0 | inconclusive here (sandbox SSL issue) — retest on a normal machine; also has a documented history of being pulled from app stores, worth citing in the pitch |

Re-run/extend with:
```
python3 scrapers/scrape_portal.py --city Hyderabad
python3 scrapers/scrape_portal.py --all
```

Rules baked into the scraper: 1 req/sec, checks `robots.txt` first, caches every
response to `data/raw/portals/`, and **never collects complainant names or phone
numbers** — only public department/ward/status metadata (DPDP Act boundary).
Department-name text and ward routing logic on each portal still need to be
extracted by hand once you've confirmed HTML vs. JSON per city — that part
isn't automated yet.

## How resolution works (`data/departments/taxonomy.json`)

A reported issue's category maps to an **authority type** (e.g. `pothole_road_damage`
→ `ULB_ENGINEERING`), which then resolves to an actual name by joining:
- `ULB_*` types → the LGD local body covering that lat/lng (point-in-polygon
  against ward boundaries, not yet in this repo — see `schema/department.schema.json`)
- `STATE_*` types → `data/departments/state_agencies.csv` for that state

Below a confidence threshold, route to the ULB's general grievance cell instead
of guessing, and show the guess to the user for confirmation.

## Validation checklist before trusting any of this in a demo

- Ward polygon count for a city matches its current LGD local-body count
  (Bengaluru went 198 → 243 → 225 wards — stale boundary files will silently
  misroute tickets)
- Every `state_agencies.csv` row you rely on has `verified=TRUE` and a source
- Spot-check ~20 random LGD rows by hand
- Stamp every scraped/derived row with `source` + `retrieved_at`
