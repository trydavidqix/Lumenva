export async function POST(request: Request): Promise<Response> {
  try {
    console.warn("CSP violation report", await request.text());
  } catch {
    console.warn("CSP violation report could not be read");
  }
  return new Response(null, { status: 204 });
}
