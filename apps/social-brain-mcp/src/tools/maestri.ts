import type { McpServer } from '@modelcontextprotocol/server'
import * as z from 'zod/v4'
import { ResourceRouter } from '@lumenva/operating-core'

import type { McpApplicationContext } from '../context'
import { runInstrumentedTool } from '../instrumentation/tool-run'
import { toolResult } from './result'

export function registerMaestriTools(server: McpServer, context: McpApplicationContext): void {
  server.registerTool(
    'maestri.status',
    {
      description: 'Get the status of the Maestri control plane',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () => toolResult(await runInstrumentedTool(context, 'maestri.status', {}, async () => {
      // Stub implementation
      return { status: 'operational' }
    })),
  )

  server.registerTool(
    'maestri.agents.list',
    {
      description: 'List active AI agents in the Maestri fabric',
      inputSchema: z.object({
        status: z.string().optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ status }) => toolResult(await runInstrumentedTool(context, 'maestri.agents.list', { status }, async () => {
      // Stub implementation
      return []
    })),
  )

  server.registerTool(
    'maestri.jobs.create',
    {
      description: 'Create a new job in the Maestri fabric',
      inputSchema: z.object({
        type: z.string(),
        payload: z.record(z.string(), z.any()),
        dry_run: z.boolean().optional(),
      }),
    },
    async (params) => toolResult(await runInstrumentedTool(context, 'maestri.jobs.create', params, async () => {
      const { type, dry_run } = params;
      if (dry_run) {
        return { would_dispatch_to: "Codex Cloud (simulated)" };
      }

      const router = new ResourceRouter();
      const taskRequirements = { capability: [type], priority: 1 };
      
      // Stub logic to pass the task to ResourceRouter.route
      await router.route(taskRequirements);
      
      return { jobId: 'stub-job-id', status: 'created' };
    })),
  )

  server.registerTool(
    'maestri.jobs.get',
    {
      description: 'Get the status and execution result of a job',
      inputSchema: z.object({
        jobId: z.string(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ jobId }) => toolResult(await runInstrumentedTool(context, 'maestri.jobs.get', { jobId }, async () => {
      return {
        status: 'completed',
        summary: 'Job completed successfully',
        files_changed: ['src/example.ts'],
        error: null,
      };
    })),
  )

  server.registerTool(
    'maestri.context.get',
    {
      description: 'Get the current execution context for the Maestri fabric',
      inputSchema: z.object({
        contextId: z.string(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ contextId }) => toolResult(await runInstrumentedTool(context, 'maestri.context.get', { contextId }, async () => {
      // Stub implementation
      return { contextId, data: {} }
    })),
  )

  server.registerTool(
    'maestri.tasks.dispatch',
    {
      description: 'Dispatch a task for cross-agent delegation',
      inputSchema: z.object({
        task: z.string(),
        assignee: z.string().optional(),
        priority: z.number().optional(),
      }),
    },
    async ({ task, assignee, priority }) => toolResult(await runInstrumentedTool(context, 'maestri.tasks.dispatch', { task, assignee, priority }, async () => {
      // Stub implementation for cross-agent delegation
      return { status: 'dispatched', taskId: 'stub-task-id', task, assignee, priority }
    })),
  )
}
