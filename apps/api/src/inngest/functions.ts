import { WORKFLOW_RUN_EVENT, type FlowGraph } from '@flowcraft/shared-types';
import type { PrismaService } from '../prisma/prisma.service';
import { inngest } from './client';
import { runWorkflowGraph } from './graph-interpreter';

/**
 * Builds the Inngest functions with a Prisma instance in closure (they run in the
 * serve handler, outside Nest's request scope, so we inject Prisma explicitly).
 * Return type is inferred so we stay compatible across Inngest SDK versions.
 */
export function createFlowcraftFunctions(prisma: PrismaService) {
  const executeWorkflow = inngest.createFunction(
    {
      id: 'execute-workflow',
      // Every step inherits these retries — this is what makes the flaky HTTP node
      // visibly retry in the run history (spec §4 Phase 4).
      retries: 4,
      onFailure: async ({ event }) => {
        // The failure event wraps the original triggering event.
        const runId = (event as { data?: { event?: { data?: { runId?: string } } } }).data?.event
          ?.data?.runId;
        if (runId) {
          await prisma.workflowRun.update({
            where: { id: runId },
            data: { status: 'failed', completedAt: new Date() },
          });
        }
      },
    },
    { event: WORKFLOW_RUN_EVENT },
    async ({ event, step, runId: inngestRunId }) => {
      const { workflowId, runId, triggeredBy, payload } = event.data;

      // Correlate our run row back to Inngest's own run id (spec §3).
      await step.run('link-run', async () => {
        await prisma.workflowRun.update({
          where: { id: runId },
          data: { inngestRunId, status: 'running' },
        });
        return { inngestRunId };
      });

      const { graph } = await step.run('load-workflow', async () => {
        const wf = await prisma.workflow.findUniqueOrThrow({
          where: { id: workflowId },
          select: { graph: true },
        });
        return { graph: wf.graph as unknown as FlowGraph };
      });

      await runWorkflowGraph({ step, prisma, graph, runId, triggeredBy, payload });

      await step.run('complete-run', async () => {
        await prisma.workflowRun.update({
          where: { id: runId },
          data: { status: 'completed', completedAt: new Date() },
        });
        return { done: true };
      });
    },
  );

  // Cron example (spec §4 Phase 4.2): every 15 min, trigger any workflow the user
  // has marked `active`. Nothing fires unless a workflow is explicitly activated.
  const scheduledRunner = inngest.createFunction(
    { id: 'scheduled-workflow-runner' },
    { cron: '*/15 * * * *' },
    async ({ step }) => {
      const active = await step.run('find-active', async () =>
        prisma.workflow.findMany({ where: { status: 'active' }, select: { id: true } }),
      );
      for (const wf of active) {
        await step.run(`trigger-${wf.id}`, async () => {
          const run = await prisma.workflowRun.create({
            data: { workflowId: wf.id, status: 'running', triggeredBy: 'schedule' },
          });
          await inngest.send({
            name: WORKFLOW_RUN_EVENT,
            data: { workflowId: wf.id, runId: run.id, triggeredBy: 'schedule', payload: {} },
          });
          return { runId: run.id };
        });
      }
      return { triggered: active.length };
    },
  );

  return [executeWorkflow, scheduledRunner];
}
