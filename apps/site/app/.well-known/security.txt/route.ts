export function GET(): Response {
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);

  return new Response(
    [
      "Contact: mailto:lumenva.group@gmail.com",
      `Expires: ${expires.toISOString()}`,
      "Preferred-Languages: pt, en",
      "",
    ].join("\n"),
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
}
