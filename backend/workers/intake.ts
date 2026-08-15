import { createRequire } from 'node:module';

type QueryResult<Row> = { rows: Row[]; rowCount: number | null };
type PoolClient = {
  query<Row = Record<string, unknown>>(text: string, values?: unknown[]): Promise<QueryResult<Row>>;
  release(): void;
};
type PgPool = {
  query<Row = Record<string, unknown>>(text: string, values?: unknown[]): Promise<QueryResult<Row>>;
  connect(): Promise<PoolClient>;
  end(): Promise<void>;
};

const requireFromCore = createRequire(new URL('../core/package.json', import.meta.url));
const { Pool } = requireFromCore('pg') as {
  Pool: new (options: { connectionString: string; max: number }) => PgPool;
};

const QUEUE_NAME = 'intake';
const FALLBACK_MODEL = 'deterministic-local-fallback-v1';
const VISIBILITY_TIMEOUT_SECONDS = 60;
const IDLE_DELAY_MS = 1_000;

type QueueMessage = {
  msg_id: string;
  read_ct: number;
  message: {
    issue_id?: unknown;
    report_id?: unknown;
    source?: unknown;
    enqueued_at?: unknown;
  };
};

type IntakeRecord = {
  issue_id: string;
  report_id: string;
  issue_title: string | null;
  issue_category_id: string | null;
  description: string;
  latitude: number;
  longitude: number;
};

type Classification = {
  categoryId: string;
  title: string;
  description: string;
  verdict: 'CLEAR' | 'REDACT' | 'HOLD';
  confidence: number;
  reason: string;
};

const CATEGORY_RULES: ReadonlyArray<{
  id: string;
  label: string;
  words: readonly string[];
}> = [
  { id: 'pothole_road_damage', label: 'Road damage', words: ['pothole', 'road damage', 'broken road', 'crater'] },
  { id: 'garbage_waste', label: 'Garbage collection', words: ['garbage', 'waste', 'rubbish', 'trash', 'dump'] },
  { id: 'streetlight_not_working', label: 'Streetlight outage', words: ['streetlight', 'street light', 'lamp post', 'dark road'] },
  { id: 'water_leak_supply', label: 'Water service', words: ['water leak', 'water supply', 'pipe leak', 'no water'] },
];

const HOLD_WORDS = [
  'bomb', 'weapon', 'kill', 'suicide', 'assault', 'molest', 'rape', 'human trafficking',
] as const;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function localDatabaseUrl(): string {
  const value = requiredEnv('DATABASE_URL');
  const host = new URL(value).hostname;
  if (!['127.0.0.1', 'localhost', 'host.docker.internal'].includes(host)) {
    throw new Error(`Local fallback worker refuses non-local database host: ${host}`);
  }
  return value;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function redact(text: string): { text: string; changed: boolean } {
  const redacted = text
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email redacted]')
    .replace(/(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/g, '[phone redacted]')
    .replace(/https?:\/\/\S+/gi, '[link removed]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1_000);
  return { text: redacted, changed: redacted !== text.trim() };
}

function classify(record: IntakeRecord, activeCategories: Set<string>): Classification {
  const source = record.description.trim();
  const lower = source.toLowerCase();
  const unsafe = HOLD_WORDS.find((word) => lower.includes(word));
  const matched = CATEGORY_RULES.find(
    (rule) => activeCategories.has(rule.id) && rule.words.some((word) => lower.includes(word)),
  );
  const categoryId = matched?.id
    ?? (record.issue_category_id && activeCategories.has(record.issue_category_id)
      ? record.issue_category_id
      : activeCategories.has('other_civic') ? 'other_civic' : '');
  const cleaned = redact(source);

  if (unsafe || !categoryId || cleaned.text.length < 8) {
    return {
      categoryId,
      title: record.issue_title?.trim().slice(0, 120) || 'Civic report awaiting review',
      description: cleaned.text || 'Report withheld for local review.',
      verdict: 'HOLD',
      confidence: 0.5,
      reason: unsafe ? `local safety keyword: ${unsafe}` : 'insufficient safe classification data',
    };
  }

  return {
    categoryId,
    title: `${matched?.label ?? 'Civic issue'} reported locally`,
    description: cleaned.text,
    verdict: cleaned.changed ? 'REDACT' : 'CLEAR',
    confidence: matched ? 0.9 : 0.65,
    reason: matched ? 'deterministic keyword match' : 'deterministic generic civic fallback',
  };
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function archive(client: PoolClient, messageId: string): Promise<void> {
  const result = await client.query<{ archived: boolean }>(
    'select pgmq.archive($1, $2::bigint) as archived',
    [QUEUE_NAME, messageId],
  );
  if (!result.rows[0]?.archived) throw new Error(`pgmq failed to archive message ${messageId}`);
}

async function processMessage(pool: PgPool, queued: QueueMessage): Promise<void> {
  const issueId = queued.message.issue_id;
  const reportId = queued.message.report_id;
  if (!isUuid(issueId) || !isUuid(reportId)) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await archive(client, queued.msg_id);
      await client.query('commit');
      console.warn(`Archived malformed intake message ${queued.msg_id}.`);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
    return;
  }

  const client = await pool.connect();
  const startedAt = performance.now();
  try {
    await client.query('begin');
    await client.query(
      `select set_config('request.jwt.claims', '{"app_role":"ADMIN"}', true)`,
    );

    const alreadyProcessed = await client.query(
      `select 1 from agent_runs
        where agent_name = 'intake' and report_id = $1
          and model = $2 and status = 'SUCCESS'
        limit 1`,
      [reportId, FALLBACK_MODEL],
    );
    if (alreadyProcessed.rowCount) {
      await archive(client, queued.msg_id);
      await client.query('commit');
      return;
    }

    const result = await client.query<IntakeRecord>(
      `select i.id::text as issue_id, r.id::text as report_id,
              i.title as issue_title, i.category_id as issue_category_id,
              coalesce(nullif(btrim(r.description), ''), nullif(btrim(r.transcript), ''), '') as description,
              ST_Y(r.location::geometry) as latitude,
              ST_X(r.location::geometry) as longitude
         from reports r
         join issues i on i.id = r.issue_id
        where r.id = $1 and i.id = $2
        for update of i`,
      [reportId, issueId],
    );
    const record = result.rows[0];
    if (!record) {
      await archive(client, queued.msg_id);
      await client.query('commit');
      console.warn(`Archived intake message ${queued.msg_id}: issue/report no longer exists.`);
      return;
    }

    const categories = await client.query<{ id: string }>('select id from categories where is_active');
    const classification = classify(record, new Set(categories.rows.map(({ id }) => id)));

    await client.query(
      'update reports set description = $2 where id = $1',
      [reportId, classification.description],
    );

    let jurisdictionId: string | null = null;
    let authorityId: string | null = null;
    let departmentId: string | null = null;
    let tier: 'ONBOARDED' | 'CONTACTABLE' | 'UNMAPPED' = 'UNMAPPED';
    let method: 'POLYGON' | 'CENTROID_FALLBACK' | 'GEOCODE_FALLBACK' | 'MANUAL' | 'NONE' = 'NONE';
    let authorityVerification: string | null = null;

    if (classification.categoryId) {
      const route = await client.query<{
        jurisdiction_id: string | null;
        authority_id: string | null;
        department_id: string | null;
        tier: typeof tier;
        method: typeof method;
        verification_status: string | null;
      }>(
        `select r.jurisdiction_id::text, r.authority_id::text, r.department_id::text,
                r.tier, r.method, a.verification_status
           from resolve_authority($1, $2, $3) r
           left join authorities a on a.id = r.authority_id`,
        [record.latitude, record.longitude, classification.categoryId],
      );
      const resolved = route.rows[0];
      if (resolved) {
        jurisdictionId = resolved.jurisdiction_id;
        method = resolved.method;
        authorityVerification = resolved.verification_status;
        // The SQL resolver exposes an unverified candidate for human triage. The
        // worker must not turn that candidate into an automatic assignment.
        if (resolved.verification_status === 'VERIFIED') {
          authorityId = resolved.authority_id;
          departmentId = resolved.department_id;
          tier = resolved.tier;
        }
      }
    }

    const sensitive = classification.categoryId
      ? await client.query<{ is_sensitive: boolean }>(
          'select is_sensitive from categories where id = $1',
          [classification.categoryId],
        )
      : null;
    const shouldHold = classification.verdict === 'HOLD' || sensitive?.rows[0]?.is_sensitive === true;
    const output = {
      fallback: true,
      fallback_label: 'LOCAL DETERMINISTIC FALLBACK - NOT AI',
      category_id: classification.categoryId || null,
      moderation_verdict: shouldHold ? 'HOLD' : classification.verdict,
      reason: classification.reason,
      routing: {
        jurisdiction_id: jurisdictionId,
        authority_id: authorityId,
        department_id: departmentId,
        tier,
        method,
        authority_verification: authorityVerification,
      },
      queue: { name: QUEUE_NAME, msg_id: queued.msg_id, read_count: queued.read_ct },
    };

    const run = await client.query<{ id: string }>(
      `insert into agent_runs (
         agent_name, issue_id, report_id, input, output, confidence, model,
         prompt_version, latency_ms, status
       ) values ('intake', $1, $2, $3::jsonb, $4::jsonb, $5, $6, 'local-fallback-v1', $7, 'SUCCESS')
       returning id::text`,
      [
        issueId,
        reportId,
        JSON.stringify({ message: queued.message, text: record.description }),
        JSON.stringify(output),
        classification.confidence,
        FALLBACK_MODEL,
        Math.round(performance.now() - startedAt),
      ],
    );

    await client.query(
      `update issues
          set title = $2,
              description = $3,
              category_id = nullif($4, ''),
              severity = coalesce((select default_severity from categories where id = nullif($4, '')), severity),
              priority = coalesce((select default_severity::text::issue_priority from categories where id = nullif($4, '')), priority),
              jurisdiction_id = $5,
              jurisdiction_match_method = $6,
              authority_id = $7,
              department_id = $8,
              routing_tier = $9,
              moderation_verdict = $10::moderation_verdict,
               status = case
                 when $10::moderation_verdict = 'HOLD' then 'HELD'::issue_status
                 when status = 'HELD' then 'OPEN'::issue_status
                 else status
               end,
               visibility = case when $10::moderation_verdict = 'HOLD' then 'CONFIDENTIAL'::issue_visibility else 'PUBLIC'::issue_visibility end,
               published_at = case when $10::moderation_verdict = 'HOLD' then null else coalesce(published_at, now()) end
        where id = $1`,
      [
        issueId,
        classification.title,
        classification.description,
        classification.categoryId,
        jurisdictionId,
        method,
        authorityId,
        departmentId,
        tier,
        shouldHold ? 'HOLD' : classification.verdict,
      ],
    );

    await client.query(
      `insert into issue_history (issue_id, actor_type, action, new_value, metadata)
       values ($1, 'AGENT', 'LOCAL_FALLBACK_INTAKE', $2, $3::jsonb)`,
      [issueId, shouldHold ? 'HELD' : 'PUBLISHED', JSON.stringify({ agent_run_id: run.rows[0]?.id, ...output })],
    );
    await archive(client, queued.msg_id);
    await client.query('commit');
    console.info(`Processed intake message ${queued.msg_id} for issue ${issueId}.`);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  if (process.env['SWARAM_LOCAL_FALLBACK'] !== '1') {
    throw new Error(
      'Refusing to run deterministic moderation outside explicit local mode. Set SWARAM_LOCAL_FALLBACK=1.',
    );
  }

  const pool = new Pool({ connectionString: localDatabaseUrl(), max: 4 });
  let stopping = false;
  const stop = (): void => { stopping = true; };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  try {
    while (!stopping) {
      let result;
      try {
        result = await pool.query<QueueMessage>(
          'select msg_id::text, read_ct, message from pgmq.read($1, $2, 1)',
          [QUEUE_NAME, VISIBILITY_TIMEOUT_SECONDS],
        );
      } catch (error) {
        console.error('Unable to poll the intake queue; retrying.', error);
        await delay(IDLE_DELAY_MS);
        continue;
      }
      const message = result.rows[0];
      if (!message) {
        await delay(IDLE_DELAY_MS);
        continue;
      }
      try {
        await processMessage(pool, message);
      } catch (error) {
        console.error(`Intake message ${message.msg_id} failed; pgmq will retry after visibility timeout.`, error);
        if (message.read_ct >= 5) {
          try {
            await pool.query('select pgmq.archive($1, $2::bigint)', [QUEUE_NAME, message.msg_id]);
            console.error(`Archived poison intake message ${message.msg_id} after ${message.read_ct} attempts.`);
          } catch (archiveError) {
            console.error(`Could not archive poison intake message ${message.msg_id}; polling continues.`, archiveError);
          }
        }
        await delay(IDLE_DELAY_MS);
      }
    }
  } finally {
    await pool.end();
  }
}

await main();
