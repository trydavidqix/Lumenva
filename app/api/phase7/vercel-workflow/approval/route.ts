import { phase7ApprovalHook, phase7ApprovalToken } from '@/workflows/phase7-vercel-workflow-benchmark';

function localOnly(): boolean {
  return process.env.NODE_ENV !== 'production' && !process.env.VERCEL;
}

export async function POST(request: Request): Promise<Response> {
  if (!localOnly()) return new Response('Not found', { status: 404 });
  const body = (await request.json()) as {
    runId?: unknown;
    deliveryGroupId?: unknown;
    approved?: unknown;
  };
  if (
    typeof body.runId !== 'string' ||
    !body.runId.trim() ||
    typeof body.deliveryGroupId !== 'string' ||
    !body.deliveryGroupId.trim() ||
    typeof body.approved !== 'boolean'
  ) {
    return Response.json({ error: 'invalid_phase7_vercel_workflow_approval' }, { status: 400 });
  }

  try {
    await phase7ApprovalHook.resume(
      phase7ApprovalToken(body.deliveryGroupId, body.runId),
      { approved: body.approved },
    );
    return Response.json({ resumed: true });
  } catch {
    return Response.json({ resumed: false, reason: 'approval_hook_not_ready' }, { status: 409 });
  }
}
