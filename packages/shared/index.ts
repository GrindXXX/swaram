/**
 * @swaram/shared
 *
 * Pure logic shared by the citizen app, the government portal and the workers.
 * Nothing here opens a socket, reads a database or calls Date.now() inside a
 * formula — every function is deterministic given its arguments, so the same
 * feed rank can be computed on the server, explained in a log and replayed in a
 * test.
 */

export * from './enums.js';
export * from './taxonomy.js';
export * from './scoring.js';
export * from './format.js';
export * from './zod/index.js';
