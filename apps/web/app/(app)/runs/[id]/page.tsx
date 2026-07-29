import { notFound } from 'next/navigation';
import { getRun } from '@/lib/data';
import { resolveTenant } from '@/lib/workspace/tenant';
import { RunView } from '@/components/run-view';

export const dynamic = 'force-dynamic';

export default async function RunPage({ params }: { params: { id: string } }) {
  const tenant = (await resolveTenant())!;
  const run = await getRun(params.id, tenant);
  if (!run) notFound();
  return <RunView run={run} />;
}
