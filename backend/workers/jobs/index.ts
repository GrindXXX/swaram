import { runAgent, type AgentName } from '../agents.ts';
import {
  loadClusterContext,
  loadIntakeContext,
  loadVerifyContext,
  sendMessage,
  type AgentRunInsert,
  type ClusterCandidateInsert,
  type WorkerDb,
} from '../db.ts';
import {
  clusterContextSchema,
  clusterDecisionSchema,
  clusterEnvelopeSchema,
  intakeAgentOutputSchema,
  intakeContextSchema,
  intakeEnvelopeSchema,
  passiveEnvelopeSchema,
  verifyContextSchema,
  verifyEnvelopeSchema,
  verifyOpinionSchema,
  type QueueName,
} from '../schemas.ts';

const DEFAULT_MODEL = 'unspecified';

function asJson(value: unknown): AgentRunInsert['input'] {
  return JSON.parse(JSON.stringify(value)) as AgentRunInsert['input'];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function successfulRunExists(
  db: WorkerDb,
  agentName: AgentName,
  key: { reportId: string } | { resolutionId: string },
): Promise<boolean> {
  let query = db.from('agent_runs').select('id').eq('agent_name', agentName).eq('status', 'SUCCESS');
  query = 'reportId' in key
    ? query.eq('report_id', key.reportId)
    : query.eq('resolution_submission_id', key.resolutionId);
  const { data, error } = await query.limit(1);
  if (error) throw new Error(`agent_runs idempotency check failed: ${error.message}`);
  return data.length > 0;
}

async function logRun(db: WorkerDb, run: AgentRunInsert): Promise<number> {
  const { data, error } = await db.from('agent_runs').insert(run).select('id').single();
  if (error) throw new Error(`agent_runs insert failed: ${error.message}`);
  return data.id;
}

interface AuditSubject {
  issueId: string;
  reportId?: string;
  resolutionId?: string;
}

async function invokeAndAudit<T>(
  db: WorkerDb,
  agentName: AgentName,
  subject: AuditSubject,
  input: unknown,
  parse: (value: unknown) => T,
  metadata: (value: T) => { confidence: number | null; model: string; promptVersion?: string },
): Promise<{ output: T; runId: number }> {
  const startedAt = performance.now();
  try {
    const output = parse(await runAgent(agentName, input));
    const meta = metadata(output);
    const runId = await logRun(db, {
      agent_name: agentName,
      issue_id: subject.issueId,
      report_id: subject.reportId ?? null,
      resolution_submission_id: subject.resolutionId ?? null,
      input: asJson(input),
      output: asJson(output),
      confidence: meta.confidence,
      model: meta.model,
      prompt_version: meta.promptVersion ?? null,
      latency_ms: Math.round(performance.now() - startedAt),
      status: 'SUCCESS',
    });
    return { output, runId };
  } catch (error) {
    await logRun(db, {
      agent_name: agentName,
      issue_id: subject.issueId,
      report_id: subject.reportId ?? null,
      resolution_submission_id: subject.resolutionId ?? null,
      input: asJson(input),
      error: errorMessage(error),
      model: DEFAULT_MODEL,
      latency_ms: Math.round(performance.now() - startedAt),
      status: 'FAILED',
    });
    throw error;
  }
}

async function handleIntake(db: WorkerDb, raw: unknown): Promise<void> {
  const envelope = intakeEnvelopeSchema.parse(raw);
  if (await successfulRunExists(db, 'intake', { reportId: envelope.report_id })) {
    // At-least-once repair: a crash may happen after the audit insert but before
    // the downstream send. Cluster itself is idempotent, so re-send safely.
    await sendMessage(db, 'cluster', {
      issue_id: envelope.issue_id,
      report_id: envelope.report_id,
      enqueued_at: new Date().toISOString(),
    });
    return;
  }

  const context = intakeContextSchema.parse(
    await loadIntakeContext(db, envelope.issue_id, envelope.report_id),
  );
  const input = {
    text: context.text,
    transcript: context.transcript ?? undefined,
    locationContext: context.address ?? undefined,
  };
  const { output } = await invokeAndAudit(
    db,
    'intake',
    { issueId: envelope.issue_id, reportId: envelope.report_id },
    input,
    (value) => intakeAgentOutputSchema.parse(value),
    (value) => ({
      confidence: value.confidence,
      model: value.model,
      promptVersion: value.promptVersion,
    }),
  );

  // The run stores a proposal only. A human applies classification/routing via
  // apply_intake_proposal(); the worker merely starts duplicate analysis.
  await sendMessage(db, 'cluster', {
    issue_id: envelope.issue_id,
    report_id: envelope.report_id,
    intake_model: output.model,
    enqueued_at: new Date().toISOString(),
  });
}

async function handleCluster(db: WorkerDb, raw: unknown): Promise<void> {
  const envelope = clusterEnvelopeSchema.parse(raw);
  if (await successfulRunExists(db, 'cluster', { reportId: envelope.report_id })) return;

  const context = clusterContextSchema.parse(await loadClusterContext(db, envelope.issue_id));
  const { output, runId } = await invokeAndAudit(
    db,
    'cluster',
    { issueId: envelope.issue_id, reportId: envelope.report_id },
    context,
    (value) => clusterDecisionSchema.array().parse(value),
    (value) => ({
      confidence: value.length ? Math.max(...value.map((candidate) => candidate.confidence)) : null,
      model: value[0]?.model ?? 'deterministic-fallback',
    }),
  );

  const rows: ClusterCandidateInsert[] = output.map((candidate) => ({
    agent_run_id: runId,
    source_issue_id: envelope.issue_id,
    target_issue_id: candidate.candidateIssueId,
    confidence: candidate.confidence,
    rationale: candidate.reasoning,
  }));
  if (!rows.length) return;
  const { error } = await db.from('cluster_candidates').insert(rows);
  if (error) throw new Error(`cluster_candidates insert failed: ${error.message}`);
}

async function handleVerify(db: WorkerDb, raw: unknown): Promise<void> {
  const envelope = verifyEnvelopeSchema.parse(raw);
  const resolutionId = String(envelope.resolution_id);
  if (await successfulRunExists(db, 'verify', { resolutionId })) return;

  const context = verifyContextSchema.parse(await loadVerifyContext(db, resolutionId));
  const input = {
    before: [],
    after: [],
    beforeDescription: context.before_description ?? undefined,
    afterDescription: context.after_description ?? undefined,
    sameLocationEvidence: context.same_location ?? undefined,
  };
  await invokeAndAudit(
    db,
    'verify',
    { issueId: context.issue_id, resolutionId },
    input,
    (value) => verifyOpinionSchema.parse(value),
    (value) => ({ confidence: value.confidence, model: value.model }),
  );
}

export async function processMessage(db: WorkerDb, queue: QueueName, raw: unknown): Promise<void> {
  switch (queue) {
    case 'intake':
      return handleIntake(db, raw);
    case 'cluster':
      return handleCluster(db, raw);
    case 'verify':
      return handleVerify(db, raw);
    case 'dispatch':
    case 'notify':
      passiveEnvelopeSchema.parse(raw);
      throw new Error(`${queue} handler is not installed`);
  }
}
