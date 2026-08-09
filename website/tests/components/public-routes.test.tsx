import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import PublicRoutePage, { generateStaticParams } from "@/app/[slug]/page";
import { demoCta, navigation } from "@/content/site";

afterEach(cleanup);

test("every registered public navigation destination renders a landing page", async () => {
  expect(generateStaticParams()).toEqual(
    navigation.map(({ href }) => ({ slug: href.slice(1) })),
  );

  for (const item of navigation) {
    render(
      await PublicRoutePage({
        params: Promise.resolve({ slug: item.href.slice(1) }),
      }),
    );

    expect(screen.getByRole("heading", { level: 1 })).toBeVisible();
    cleanup();
  }
});

test("the demonstration CTA target renders a landing page", async () => {
  render(
    await PublicRoutePage({
      params: Promise.resolve({ slug: demoCta.href.slice(1) }),
    }),
  );

  expect(screen.getByRole("heading", { level: 1 })).toBeVisible();
});
