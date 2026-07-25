import { PrismaClient } from '@prisma/client';
import { NODE_TEMPLATES, type FlowGraph } from '@flowcraft/shared-types';

const prisma = new PrismaClient();

// A demo flow that exercises every interesting path: a durable delay, a flaky
// HTTP node (to show Inngest retries), and a condition that branches — the
// false branch's node gets marked `skipped`.
const demoGraph: FlowGraph = {
  nodes: [
    { id: 'n1', type: 'flowNode', position: { x: 260, y: 40 }, data: { type: 'manual_trigger', label: 'Manual Trigger', config: {} } },
    { id: 'n2', type: 'flowNode', position: { x: 260, y: 170 }, data: { type: 'delay', label: 'Delay', config: { amount: 5, unit: 's' } } },
    {
      id: 'n3',
      type: 'flowNode',
      position: { x: 260, y: 300 },
      data: {
        type: 'http_request',
        label: 'HTTP Request',
        config: { method: 'GET', url: 'https://example.com/ping', failRate: 0.4 },
      },
    },
    {
      id: 'n4',
      type: 'flowNode',
      position: { x: 260, y: 430 },
      data: { type: 'condition', label: 'Condition', config: { left: '1', operator: 'eq', right: '1' } },
    },
    {
      id: 'n5',
      type: 'flowNode',
      position: { x: 460, y: 560 },
      data: { type: 'send_slack', label: 'Send Slack', config: { channel: '#alerts', message: 'API is healthy ✅' } },
    },
    {
      id: 'n6',
      type: 'flowNode',
      position: { x: 60, y: 560 },
      data: { type: 'send_email', label: 'Send Email', config: { to: 'ops@example.com', subject: 'API down', body: 'Investigate.' } },
    },
  ],
  edges: [
    { id: 'e1', source: 'n1', target: 'n2' },
    { id: 'e2', source: 'n2', target: 'n3' },
    { id: 'e3', source: 'n3', target: 'n4' },
    { id: 'e4', source: 'n4', target: 'n5', sourceHandle: 'true' },
    { id: 'e5', source: 'n4', target: 'n6', sourceHandle: 'false' },
  ],
};

async function main() {
  console.log('Seeding node templates + demo workflow…');

  for (const t of NODE_TEMPLATES) {
    await prisma.nodeTemplate.upsert({
      where: { type: t.type },
      update: { label: t.label, configSchema: t.configSchema as object },
      create: { type: t.type, label: t.label, configSchema: t.configSchema as object },
    });
  }
  console.log(`✓ ${NODE_TEMPLATES.length} node templates`);

  const existing = await prisma.workflow.findFirst({ where: { name: 'Demo: Flaky API check' } });
  if (!existing) {
    await prisma.workflow.create({
      data: { name: 'Demo: Flaky API check', graph: demoGraph as object, status: 'draft' },
    });
    console.log('✓ demo workflow created');
  } else {
    await prisma.workflow.update({ where: { id: existing.id }, data: { graph: demoGraph as object } });
    console.log('✓ demo workflow refreshed');
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
