import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { JsonLd } from "@/components/ui/JsonLd";

test("JSON-LD serialization prevents a string from closing its script element", () => {
  const { container } = render(<JsonLd data={{ description: "</script><script>bad()</script>" }} />);

  const scripts = container.querySelectorAll('script[type="application/ld+json"]');

  expect(scripts).toHaveLength(1);
  expect(scripts[0]?.textContent).toContain("\\u003c/script>");
  expect(scripts[0]?.textContent).not.toContain("</script>");
});
