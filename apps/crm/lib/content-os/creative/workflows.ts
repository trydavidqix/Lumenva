export type WorkflowBuilder = (parameters: Record<string, unknown>) => Record<string, unknown>;

/** Product-owned allowlist. Arbitrary ComfyUI node graphs are not accepted. */
export class ContentOsWorkflowCatalog {
  constructor(private readonly builders: ReadonlyMap<string, WorkflowBuilder>) {}

  resolve(workflow: string, parameters: Record<string, unknown>): Record<string, unknown> {
    const builder = this.builders.get(workflow);
    if (!builder) throw new Error(`Unknown Content OS creative workflow: ${workflow}`);
    return builder(parameters);
  }
}

export function createWorkflowCatalog(entries: Record<string, WorkflowBuilder>): ContentOsWorkflowCatalog {
  return new ContentOsWorkflowCatalog(new Map(Object.entries(entries)));
}
