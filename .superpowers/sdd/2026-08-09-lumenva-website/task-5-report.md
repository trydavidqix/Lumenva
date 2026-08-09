# Task 5 report — reusable layout, navigation, and UI primitives

## Scope delivered

- Added typed public-route, CTA, and shell-label registry entries in `website/content/site.ts`.
- Added the sticky Header, keyboard-accessible mobile navigation dialog, and factual Footer.
- Added reusable Button, SectionIntro, MagneticButton, and useMediaQuery primitives.
- Wrapped root children in Header, main landmark, and Footer; added a working skip link.
- Replaced the Hero CTA fragment with the known `/contato` route.

## TDD evidence

- Red: `pnpm --dir website test tests/components/header.test.tsx tests/components/button.test.tsx`
  failed as expected because `@/components/layout/Header` and `@/components/ui/Button` did not exist.
- Green: the same command passes with 2 files and 4 tests.

## Verification

`pnpm --dir website test tests/components/header.test.tsx tests/components/button.test.tsx && pnpm --dir website typecheck && pnpm --dir website lint`

All commands exit 0.

Remediation commit: `fix(website): contain mobile navigation dialog`.

## Commit

`feat(website): add marketing layout and navigation`

## Files

- `website/app/globals.css`, `website/app/layout.tsx`
- `website/components/layout/{Header,MobileNavigation,Footer}.{tsx,module.css}`
- `website/components/ui/{Button,SectionIntro}.{tsx,module.css}`
- `website/components/motion/MagneticButton.tsx`
- `website/hooks/useMediaQuery.ts`
- `website/content/site.ts`, `website/components/sections/Hero.tsx`
- `website/tests/components/{header,button}.test.tsx`

## Concerns

Dedicated Task 7 route templates can replace the shared minimal route entry without changing public URLs or navigation data.

## Remediation

- Added red regression coverage for dialog Tab and Shift+Tab containment, Escape closing with focus restoration, and an inert outside render root.
- Added red regression coverage that every registered navigation destination and the demo CTA target render through the public route entry.
- Green implementation portals the dialog to `body`, makes every non-modal body root inert while open, contains Tab focus, restores trigger focus after close, and preserves Escape and backdrop closing.
- Added a single static `[slug]` route entry backed by the typed public-route registry. It provides factual, minimal landing content only; dedicated Task 7 routes can replace it without changing navigation targets.

Remediation verification:

`pnpm --dir website test tests/components/header.test.tsx tests/components/public-routes.test.tsx && pnpm --dir website typecheck && pnpm --dir website lint`

All commands exit 0.
