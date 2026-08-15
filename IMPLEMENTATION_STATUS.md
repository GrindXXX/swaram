# Swaram implementation status

Verified against `product-requirements.html` and `technical-plan.html` on 15 August 2026.

## Working Phase-0 paths

| Surface | Route / contract | Status |
|---|---|---|
| Citizen | `/`, `/i/:publicId`, legacy `/thread/:publicId` | Live Supabase feed and issue detail |
| Citizen | `/report`, `/report/confirm` | Text + GPS draft, email auth, atomic submission |
| Citizen | `/me/issues` | Live created/following lists |
| Citizen | Follow, public comment, "facing too", share | Live and authenticated |
| Government | `/auth/sign-in`, `/auth/callback` | Email magic link and roster-derived JWT claims |
| Government | `/gov`, `/gov/t/:publicId` | Scoped live queue and operational detail |
| Government | Start work, official reply, submit resolution | Live RPC actions with department/jurisdiction checks |
| Backend | `submit_citizen_report` | Auth-bound, idempotent Issue + Report creation |
| Backend | Intake queue worker | Durable local deterministic fallback, redaction, routing, publication and audit |
| Security | RLS and column privileges | Public/private visibility, immutable evidence fields and exact-location denial |
| Local demo | `backend/supabase/seed.sql` | Bengaluru-like categories, jurisdictions, authorities, officer and issues |

The browser talks to Supabase PostgREST/RPC directly. There is no duplicate REST application server. The current browser write contracts are:

- `submit_citizen_report`
- `citizen_issue_state`
- `set_citizen_issue_following`
- `create_citizen_comment`
- `add_citizen_issue_report`
- `gov_queue`
- `gov_issue_detail`
- `gov_start_issue`
- `gov_post_public_reply`
- `gov_submit_resolution`

## Not complete

These PRD features remain real implementation work and must not be represented as production-ready:

- Photo/video upload, signed media storage, compression, EXIF handling and voice transcription.
- Real multimodal intake, embedding retrieval, clustering/merge decisions and verifier agents.
- Real BBMP ward polygons and nationwide boundary/reference-data loaders. Local routing currently reports centroid fallback honestly.
- Notifications, push delivery, digests, SLA cron escalation and verification-window closure.
- Complete community-verification UI and outcome automation.
- Admin, moderation and civic-intelligence dashboards.
- Production Google OAuth, SMTP, hosted Supabase hook activation and officer provisioning workflow.
- Offline media queue, service worker/PWA install flow, four-language localization and formal WCAG/performance gates.
- Phase-2 newspaper, national map, performance index, predictive maintenance and contractor workflows.

## Local verification

```bash
cd backend
npx supabase start
npx supabase db reset
npx supabase test db

cd core
npm ci
npm run typecheck
npm run typecheck:worker
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  SWARAM_LOCAL_FALLBACK=1 npm run worker:intake

cd ../../apps/citizen
npm ci
npm run dev -- --host 127.0.0.1

cd ../web
npm ci
npm run dev -- --hostname 127.0.0.1
```

Use `npx supabase status -o env` to populate ignored `.env.local` files from local keys. Never put a service-role/secret key in `apps/citizen`.

Local URLs:

- Citizen: `http://127.0.0.1:5173`
- Government: `http://127.0.0.1:3000/gov`
- Supabase Studio: `http://127.0.0.1:54323`
- Mailpit: `http://127.0.0.1:54324`
