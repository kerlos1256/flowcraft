import { notFound } from 'next/navigation';
import { getRun } from '@/lib/data';
import { RunView } from '@/components/run-view';

export const dynamic = 'force-dynamic';

export default async function RunPage({ params }: { params: { id: string } }) {
  const run = await getRun(params.id);
  if (!run) notFound();
  return <RunView run={run} />;
}
