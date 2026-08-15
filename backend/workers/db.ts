import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { queueMessageSchema, type QueueMessage, type QueueName } from './schemas.ts';

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type WorkerDatabase = {
  public: {
    Tables: {
      agent_runs: {
        Row: AgentRunInsert & { id: number; created_at: string };
        Insert: AgentRunInsert;
        Update: Partial<AgentRunInsert>;
        Relationships: [];
      };
      cluster_candidates: {
        Row: ClusterCandidateInsert & { id: string; created_at: string };
        Insert: ClusterCandidateInsert;
        Update: Partial<ClusterCandidateInsert>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      worker_queue_read: {
        Args: { p_queue: QueueName; p_visibility_timeout: number; p_batch_size: number };
        Returns: { msg_id: string; read_ct: number; enqueued_at: string; vt: string; message: Json }[];
      };
      worker_queue_archive: {
        Args: { p_queue: QueueName; p_msg_id: string; p_expected_read_ct: number };
        Returns: string;
      };
      worker_queue_retry: {
        Args: { p_queue: QueueName; p_msg_id: string; p_expected_read_ct: number; p_delay_seconds: number };
        Returns: string;
      };
      worker_queue_dead_letter: {
        Args: { p_queue: QueueName; p_msg_id: string; p_expected_read_ct: number; p_reason: string };
        Returns: string;
      };
      worker_queue_send: {
        Args: { p_queue: QueueName; p_message: Json; p_delay_seconds?: number };
        Returns: string;
      };
      worker_intake_context: {
        Args: { p_issue_id: string; p_report_id: string };
        Returns: Json;
      };
      worker_cluster_context: {
        Args: { p_issue_id: string };
        Returns: Json;
      };
      worker_verify_context: {
        Args: { p_resolution_id: string };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type AgentRunInsert = {
  agent_name: 'intake' | 'cluster' | 'verify';
  issue_id: string;
  report_id?: string | null;
  resolution_submission_id?: string | null;
  input: Json;
  output?: Json | null;
  error?: string | null;
  confidence?: number | null;
  model: string;
  prompt_version?: string | null;
  latency_ms?: number | null;
  status: 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'SKIPPED';
};

export type ClusterCandidateInsert = {
  agent_run_id: number;
  source_issue_id: string;
  target_issue_id: string;
  confidence: number;
  rationale: string;
};

export type WorkerDb = SupabaseClient<WorkerDatabase>;

export function createWorkerDb(): WorkerDb {
  const url = process.env['SUPABASE_URL'];
  const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url) throw new Error('SUPABASE_URL is not set');
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  if (serviceRoleKey === process.env['SUPABASE_ANON_KEY']) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY must not be the anon key');
  }

  return createClient<WorkerDatabase>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    db: { schema: 'public' },
    global: { headers: { 'x-swaram-client': 'worker-service-role' } },
  });
}

function rpcError(operation: string, error: { message: string } | null): Error {
  return new Error(`${operation} failed: ${error?.message ?? 'unknown database error'}`);
}

export async function readQueue(db: WorkerDb, queue: QueueName): Promise<QueueMessage | null> {
  const { data, error } = await db.rpc('worker_queue_read', {
    p_queue: queue,
    p_visibility_timeout: 120,
    p_batch_size: 1,
  });
  if (error) throw rpcError('worker_queue_read', error);

  const rows = Array.isArray(data) ? data : data == null ? [] : [data];
  if (rows.length === 0) return null;
  return queueMessageSchema.parse(rows[0]);
}

export async function archiveMessage(
  db: WorkerDb,
  queue: QueueName,
  msgId: string,
  readCount: number,
): Promise<void> {
  const { error } = await db.rpc('worker_queue_archive', {
    p_queue: queue,
    p_msg_id: msgId,
    p_expected_read_ct: readCount,
  });
  if (error) throw rpcError('worker_queue_archive', error);
}

export async function retryMessage(
  db: WorkerDb,
  queue: QueueName,
  msgId: string,
  readCount: number,
  delaySeconds: number,
): Promise<void> {
  const { error } = await db.rpc('worker_queue_retry', {
    p_queue: queue,
    p_msg_id: msgId,
    p_expected_read_ct: readCount,
    p_delay_seconds: delaySeconds,
  });
  if (error) throw rpcError('worker_queue_retry', error);
}

export async function deadLetterMessage(
  db: WorkerDb,
  queue: QueueName,
  msgId: string,
  readCount: number,
  reason: string,
): Promise<void> {
  const { error } = await db.rpc('worker_queue_dead_letter', {
    p_queue: queue,
    p_msg_id: msgId,
    p_expected_read_ct: readCount,
    p_reason: reason.slice(0, 2_000),
  });
  if (error) throw rpcError('worker_queue_dead_letter', error);
}

export async function sendMessage(db: WorkerDb, queue: QueueName, message: Json): Promise<void> {
  const { error } = await db.rpc('worker_queue_send', {
    p_queue: queue,
    p_message: message,
    p_delay_seconds: 0,
  });
  if (error) throw rpcError('worker_queue_send', error);
}

export async function loadIntakeContext(db: WorkerDb, issueId: string, reportId: string): Promise<Json> {
  const { data, error } = await db.rpc('worker_intake_context', {
    p_issue_id: issueId,
    p_report_id: reportId,
  });
  if (error) throw rpcError('worker_intake_context', error);
  return data;
}

export async function loadClusterContext(db: WorkerDb, issueId: string): Promise<Json> {
  const { data, error } = await db.rpc('worker_cluster_context', { p_issue_id: issueId });
  if (error) throw rpcError('worker_cluster_context', error);
  return data;
}

export async function loadVerifyContext(db: WorkerDb, resolutionId: string): Promise<Json> {
  const { data, error } = await db.rpc('worker_verify_context', { p_resolution_id: resolutionId });
  if (error) throw rpcError('worker_verify_context', error);
  return data;
}
