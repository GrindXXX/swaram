type AgentHandler = (input: unknown) => unknown;

const exportNames = {
  intake: ['runIntakeAgent', 'runIntake', 'intakeAgent', 'run', 'default'],
  cluster: ['runClusterAgent', 'runCluster', 'clusterAgent', 'run', 'default'],
  verify: ['runVerifyAgent', 'runVerify', 'verifyAgent', 'run', 'default'],
} as const;

export type AgentName = keyof typeof exportNames;

function isModule(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function runAgent(name: AgentName, input: unknown): Promise<unknown> {
  const moduleUrl = new URL(`../core/agents/${name}.ts`, import.meta.url);
  const loaded: unknown = await import(moduleUrl.href);
  if (!isModule(loaded)) throw new Error(`${name} agent module has no exports`);

  for (const exportName of exportNames[name]) {
    const candidate = loaded[exportName];
    if (typeof candidate === 'function') {
      const handler = candidate as AgentHandler;
      return await handler(input);
    }
  }

  throw new Error(
    `${name} agent must export one of: ${exportNames[name].join(', ')}`,
  );
}
