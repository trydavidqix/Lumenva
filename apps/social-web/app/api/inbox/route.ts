import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    // In a real scenario, this would call the inbox processor
    // with a real ContactBridge implementation

    return NextResponse.json({ success: true, processed: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
