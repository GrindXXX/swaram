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

## Appellate officers — 88 central departments, escalation contact + email

CPGRAMS has a second layer beyond the first-contact nodal officer above: a named
appellate authority to escalate to if the nodal officer doesn't resolve the
grievance. Same organisations as the central table, different (usually more
senior) officer.

| Department | Appellate Officer | Email |
|---|---|---|
| Central Board of Direct Taxes | Dipi Agarwal, Commissioner of Income Tax | delhi.dittps@incometax.gov.in |
| Central Board of Indirect Taxes and Customs | Dr. Shailendra Kumar Sinha, Director General | shailendra.sinha@gov.in |
| Department of Agriculture and Farmers Welfare | Smt. S. Rukmani, Joint Secretary | s.rukmani@nic.in |
| Department of Atomic Energy | Smt. Nidhi Pandey, Additional Secretary | as@dae.gov.in |
| Department of Commerce | Ms. Priya Nair, Economic Adviser | priyanair.10@gov.in |

Full table (all 88): `data/departments/appeal_officers_central.csv`

**Limitations of the three tables above:** they're ministry-level and
state-level — one row per department, one row per state, not one row per
department per district (that gap is what the next section starts to fill).
There's also a deeper CPGRAMS layer — the full ministry → department →
organization tree used to route a grievance to a specific sub-office/PSU when
filing one — but it's only exposed behind a logged-in citizen account on the
Lodge Grievance form, so it isn't included here.

## District-level department contacts — Karnataka pilot, 5 districts

Most Indian districts run the same government (NIC) website template, which
publishes a per-department contact directory: police, water board, development
authority, municipal corporation, zilla panchayat, revenue officers — each with
a name, designation, and often an email. This is the layer CPGRAMS doesn't
have. Piloted on 5 Karnataka districts so far — **72 contacts, 46 with an
email**:

| District | Department | Name | Designation | Email |
|---|---|---|---|---|
| BENGALURU URBAN | Bangalore Water Supply and Sewerage Board | (Chairman) | Chairman | chairman@bwssb.gov.in |
| BENGALURU URBAN | Bruhat Bengaluru Mahanagara Palike | Addl. Commissioner (Administration) | Additional Commissioner | addcomm.ad@gmail.com |
| BENGALURU URBAN | Bangalore Development Authority | Commissioner | Commissioner | com@bdabangalore.org |
| BENGALURU URBAN | Police Department | DCP Central | DCP | acpcentraltrafficbcp@ksp.gov.in |
| MYSURU | — (DC office) | Shri.Lakshmikanth Reddy.G, I.A.S | Deputy Commissioner & District Magistrate | dcmys-ka@nic.in |
| MYSURU | Tahasildar Mysuru | Mohana kumari | TAHASILDAR – SARGURU | mohana.kumari1980@ka.gov.in |
| MYSURU | Zilla Panchayath Mysuru | Shri. S UKESH KUMAR, I.A.S | Chief Executive Officer | ceo_zp_mys@nic.in |
| TUMAKURU | — (DC office) | Smt. Subha Kalyan, I.A.S | Deputy Commissioner & District Magistrate | dctumkur-ka@nic.in |

Full table: `data/departments/karnataka_district_contacts.csv`

**Coverage and caveats, honestly:** 5 of Karnataka's 31 districts, not all 31 —
each remaining district's site hostname has to be found individually (no
central lookup table for them). Belagavi's page had almost nothing usable
(1 row) and even had a literal "Sample Department" placeholder left in by
whoever built that page — a data-quality issue on the government's own site,
left as-is rather than papered over. This same NIC template is used well
beyond Karnataka — likely the biggest lever for scaling this table to the rest
of India, one state's district hostnames at a time.

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
