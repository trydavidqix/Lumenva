import { cleanup, render, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Footer } from "@/components/layout/Footer";

afterEach(cleanup);

test("footer exposes neutral social placeholders without invented links", () => {
  const { container } = render(<Footer />);
  const footer = within(container.querySelector("footer")!);

  expect(footer.queryByRole("link", { name: /github/i })).not.toBeInTheDocument();

  for (const name of ["WhatsApp", "Facebook", "Instagram"]) {
    const placeholder = footer.getByLabelText(
      new RegExp(`${name}: perfil ainda não configurado`, "i"),
    );

    expect(placeholder).toBeVisible();
    expect(placeholder.closest("a")).toBeNull();
  }
});
