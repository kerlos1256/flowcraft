import { notFound } from 'next/navigation';
import type { RunDetailDto } from '@flowcraft/shared-types';
import { getRun, ApiError } from '@/lib/api';
import { RunView } from '@/components/run-view';

export const dynamic = 'force-dynamic';

export default async function RunPage({ params }: { params: { id: string } }) {
  let run: RunDetailDto;
  try {
    run = await getRun(params.id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  return <RunView run={run} />;
}
