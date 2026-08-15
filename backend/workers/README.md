# Local intake worker

The intake worker drains the existing `pgmq` `intake` queue. It deliberately
uses a deterministic, visibly labelled local fallback instead of external AI.
It is not a production moderation model, so the run script explicitly enables
local mode.

From `backend/core` after `supabase db reset`:

```sh
npm install
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run worker:intake
```

Use `npm run typecheck:worker` to typecheck it. Successful processing, issue
updates, audit rows, and `pgmq.archive` happen in one transaction. Failed jobs
become visible again after 60 seconds. The fallback records its category,
safety decision, routing method, authority verification state, and queue ID in
`agent_runs` and `issue_history`.

The local seed contains no jurisdiction polygon. Its Bengaluru Urban centroid
therefore resolves as `CENTROID_FALLBACK`; neither seed nor worker relabels that
as polygon routing. An authority candidate is assigned only when its
`verification_status` is `VERIFIED`.
