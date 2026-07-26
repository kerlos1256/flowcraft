import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getRun } from '@/lib/data';
import { RunView } from '@/components/run-view';

export const dynamic = 'force-dynamic';

export default async function RunPage({ params }: { params: { id: string } }) {
  const session = (await getSession())!;
  const run = await getRun(params.id, session.sub);
  if (!run) notFound();
  return <RunView run={run} />;
}
