import { cleanup, render, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Footer } from "@/components/layout/Footer";

afterEach(cleanup);

test("footer exposes real social links without invented ones", () => {
  const { container } = render(<Footer />);
  const footer = within(container.querySelector("footer")!);

  expect(footer.queryByRole("link", { name: /github/i })).not.toBeInTheDocument();

  const expectedHrefs: Record<string, string> = {
    WhatsApp: "https://wa.me/351910293287",
    Facebook: "https://www.facebook.com/profile.php?id=61592131762439",
    Instagram: "https://www.instagram.com/lumenva.group/",
  };

  for (const [name, href] of Object.entries(expectedHrefs)) {
    const link = footer.getByRole("link", { name: new RegExp(name, "i") });

    expect(link).toBeVisible();
    expect(link).toHaveAttribute("href", href);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }
});
