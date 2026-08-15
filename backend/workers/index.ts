import { ZodError } from 'zod';
import { setTimeout as sleep } from 'node:timers/promises';

import {
  archiveMessage,
  createWorkerDb,
  deadLetterMessage,
  readQueue,
  retryMessage,
} from './db.ts';
import { processMessage } from './jobs/index.ts';
import { queueNameSchema, type QueueMessage, type QueueName } from './schemas.ts';

const POLL_INTERVAL_MS = positiveIntegerEnv('WORKER_POLL_INTERVAL_MS', 1_000);
const MAX_ATTEMPTS = positiveIntegerEnv('WORKER_MAX_ATTEMPTS', 5);
const BASE_RETRY_SECONDS = positiveIntegerEnv('WORKER_BASE_RETRY_SECONDS', 5);

function positiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function configuredQueues(): QueueName[] {
  const raw = process.env['WORKER_QUEUES'] ?? 'intake,cluster,verify';
  const queues = raw.split(',').map((value) => queueNameSchema.parse(value.trim()));
  return [...new Set(queues)];
}

function errorMessage(error: unknown): string {
  if (error instanceof ZodError) return `invalid message: ${error.message}`;
  return error instanceof Error ? error.message : String(error);
}

function retryDelay(readCount: number): number {
  return Math.min(BASE_RETRY_SECONDS * 2 ** Math.max(0, readCount - 1), 900);
}

async function settleFailure(
  db: ReturnType<typeof createWorkerDb>,
  queue: QueueName,
  message: QueueMessage,
  error: unknown,
): Promise<void> {
  const reason = errorMessage(error);
  if (message.read_ct >= MAX_ATTEMPTS) {
    await deadLetterMessage(db, queue, message.msg_id, message.read_ct, reason);
    console.error(JSON.stringify({ level: 'error', queue, msg_id: message.msg_id, dead_lettered: true, error: reason }));
    return;
  }

  const delaySeconds = retryDelay(message.read_ct);
  await retryMessage(db, queue, message.msg_id, message.read_ct, delaySeconds);
  console.warn(JSON.stringify({ level: 'warn', queue, msg_id: message.msg_id, retry_in_seconds: delaySeconds, error: reason }));
}

async function main(): Promise<void> {
  const db = createWorkerDb();
  const queues = configuredQueues();
  const abortController = new AbortController();

  const shutdown = (signal: NodeJS.Signals): void => {
    console.info(JSON.stringify({ level: 'info', event: 'shutdown', signal }));
    abortController.abort();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  let queueIndex = 0;
  console.info(JSON.stringify({ level: 'info', event: 'worker_started', queues, concurrency: 1 }));

  while (!abortController.signal.aborted) {
    const queue = queues[queueIndex % queues.length];
    queueIndex += 1;
    if (!queue) continue;

    try {
      const message = await readQueue(db, queue);
      if (!message) {
        await sleep(POLL_INTERVAL_MS, undefined, { signal: abortController.signal }).catch(() => undefined);
        continue;
      }

      try {
        await processMessage(db, queue, message.message);
        await archiveMessage(db, queue, message.msg_id, message.read_ct);
        console.info(JSON.stringify({ level: 'info', queue, msg_id: message.msg_id, event: 'archived' }));
      } catch (error) {
        await settleFailure(db, queue, message, error);
      }
    } catch (error) {
      console.error(JSON.stringify({ level: 'error', queue, event: 'poll_failed', error: errorMessage(error) }));
      await sleep(POLL_INTERVAL_MS);
    }
  }

  console.info(JSON.stringify({ level: 'info', event: 'worker_stopped' }));
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({ level: 'fatal', error: errorMessage(error) }));
  process.exitCode = 1;
});
