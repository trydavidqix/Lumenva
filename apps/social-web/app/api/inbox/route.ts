import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    // Strict schema validation for incoming webhook payload
    if (
      typeof payload !== 'object' ||
      payload === null ||
      typeof payload.tenantId !== 'string' ||
      typeof payload.accountId !== 'string' ||
      typeof payload.provider !== 'string' ||
      typeof payload.externalId !== 'string' ||
      typeof payload.messageId !== 'string' ||
      typeof payload.content !== 'string'
    ) {
      return NextResponse.json({ success: false, error: 'INVALID_SCHEMA' }, { status: 400 });
    }

    // Role checking and actual CRM contact bridge initialization
    // are dependent on Task 06 infrastructure which is currently missing/out-of-scope.
    // Throwing explicit blocker as requested.
    return NextResponse.json(
      {
        success: false,
        error: 'BLOCKED_DEPENDENCY',
        message: 'Task 06 infrastructure (ContactBridge, RBAC) is not integrated.'
      },
      { status: 501 } // Not Implemented / Dependency missing
    );
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
