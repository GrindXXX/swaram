/**
 * zod/index.ts — every schema at the system's edges.
 *
 * Four boundaries are covered:
 *   intake.ts       model output -> database
 *   report.ts       citizen -> server
 *   resolution.ts   authority -> server, and citizens -> server
 *   common.ts       the primitives all three share
 */

export * from './common.js';
export * from './intake.js';
export * from './report.js';
export * from './resolution.js';
