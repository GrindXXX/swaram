# swaram

Civic issue reporting + public accountability layer for India — citizens photograph
an issue, it gets geo-tagged and routed to the department actually responsible for
it, and tracked publicly. This README describes the government department data
collected so far.

## Urban local bodies, by district — 4,814 total

Every Municipal Corporation, Municipality, Town Panchayat, Notified Area Council,
Municipal Council, and City/Town Municipal Council in India, each tagged with its
district and state. Sourced from India's Local Government Directory (LGD, Ministry
of Panchayati Raj) — 99.9% of rows (4,809/4,814) have a matched district.

By type, nationally:

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

Sample (Bengaluru area):

| State | District | Local Body | Type | LGD Code |
|---|---|---|---|---|
| KARNATAKA | BENGALURU URBAN | BBMP | Municipal Corporation | 276600 |
| KARNATAKA | BENGALURU URBAN | Attibele | Town Municipal Council | 276539 |
| KARNATAKA | BENGALURU URBAN | Chandapura | Town Municipal Council | 276533 |
| KARNATAKA | BENGALURU RURAL | Devanahalli | Town Municipal Council | 251994 |
| KARNATAKA | BENGALURU RURAL | Dod Ballapur | City Municipal Council | 251992 |

Top 5 states by ULB count: Uttar Pradesh (763), Tamil Nadu (661), Madhya Pradesh
(413), Maharashtra (406), Karnataka (315).

Full table: `data/departments/ulb_directory.csv`

## Central government departments — 92, with named contact + email

One nodal grievance officer per central ministry/department, published by DARPG.

| Department | Officer | Email |
|---|---|---|
| Administrative Reforms and Public Grievances | Sardendu Kumar Pandey, Director | Director-pg@gov.in |
| Agriculture and Farmers Welfare | Shri Rajesh Kumar, Deputy Secretary PG | rajesh.kumar67@nic.in |
| Atomic Energy | Shri K.V. Madhavadas, Deputy Secretary | dsscs@dae.gov.in |
| Ayush | Dr Srinivas Rao Chinta, Joint Adviser | ayush-cdn@gov.in |
| Bio Technology | Rajesh Kumar Singh, Director | rajesh.kumar@gov.in |
| Central Board of Direct Taxes | Swapna Devireddy, Addl. Director | delhi.addldit.eservices@incometax.gov.in |

Full table (all 92): `data/departments/nodal_officers_central.csv`

## State governments — 37 states/UTs, with named contact + email

One nodal grievance officer per state/UT.

| State | Officer | Email |
|---|---|---|
| Andhra Pradesh | Chinna Rao, CGO-CMO | pgrs-helpdesk@ap.gov.in |
| Assam | Shri Utpal Borah ACS, State Nodal Officer | artassamdept@gmail.com |
| Bihar | Miss Vineeta, DS | publicgrievances-bih@gov.in |
| Gujarat | Shri Hareet Shukla, Principal Secretary | secartd@gujarat.gov.in |
| Karnataka | Suma.S, Under Secretary | us2dpar-js@karnataka.gov.in |
| Maharashtra | Hemant Anant Mahajan, Deputy Secretary | hemant.mahajan@nic.in |

Full table (all 37): `data/departments/nodal_officers_state.csv`

**Limitation:** these two tables are ministry-level and state-level — one row per
department, one row per state, not one row per department per district. A true
per-district directory (e.g. "BBMP Solid Waste Dept, Bengaluru Urban, email X")
doesn't exist as a single national source; each district publishes its own
contact page with no shared format, so that layer would need to be built one
state at a time.

## State utility boards — water + electricity, all 36 states/UTs

Water boards and electricity DISCOMs aren't local governments, so they're not in
the LGD directory — this table is a separate, hand-compiled first pass covering
all 36 states/UTs (e.g. Karnataka → BWSSB for Bengaluru water, BESCOM/MESCOM/
HESCOM/GESCOM/CESC for electricity by region; Delhi → DJB for water, BSES
Rajdhani/Yamuna/TPDDL by zone for electricity).

**Not yet verified** — every row needs a cross-check against the agency's own
site before being relied on. Table: `data/departments/state_agencies.csv`

## City grievance portals checked so far

| City | Portal | Departments it covers |
|---|---|---|
| Bengaluru | Sahaaya 2.0 | BBMP, BESCOM, BWSSB, BMTC, BMRCL, BMRDA, BDA |
| Mumbai | MCGM Complaint Registration | MCGM/BMC |
| Hyderabad | GHMC | GHMC |
| Delhi | MCD 311 | MCD |
| Chennai | GCC Public Grievance Redressal | Greater Chennai Corporation |

Details (URLs, per-portal status): `data/departments/portals.json`
