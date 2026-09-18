# ADR: canonical current-state filename

- **Status:** accepted
- **Decision:** `docs/current-state.md` (lowercase) is the canonical current-state document.
- **Context:** Git tracked both `docs/Current-State.md` and `docs/current-state.md`. They are distinct paths to Git but collide on case-insensitive filesystems. The uppercase file contained an older 23-line F1 snapshot; the lowercase file contains the maintained current-state document.
- **Action:** remove `docs/Current-State.md` from Git tracking and preserve its unique historical snapshot at [`docs/archive/current-state-baseline-f1-2026-09-10.md`](../archive/current-state-baseline-f1-2026-09-10.md).
- **Scope:** documentation/path hygiene only; no runtime behavior changes.
