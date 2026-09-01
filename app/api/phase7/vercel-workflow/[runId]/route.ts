import { getRun } from 'workflow/api';

function localOnly(): boolean {
  return process.env.NODE_ENV !== 'production' && !process.env.VERCEL;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
): Promise<Response> {
  if (!localOnly()) return new Response('Not found', { status: 404 });
  const { runId } = await params;
  if (!runId.trim()) return Response.json({ error: 'run_id_required' }, { status: 400 });

  try {
    const run = getRun(runId);
    const status = await run.status;
    if (status === 'completed') {
      const output = await run.returnValue;
      return Response.json({ status, output });
    }
    return Response.json({ status });
  } catch {
    return Response.json({ error: 'workflow_run_not_found' }, { status: 404 });
  }
}
