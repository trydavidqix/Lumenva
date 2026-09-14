# Voice personality + Patter — local verification harness evidence

Date: 2026-09-14
Branch: `feat/voice-personality-patter-inline`
PR: #37

> Historical filename retained to avoid breaking references. This is **not** GitHub Actions evidence.

The repository explicitly keeps GitHub Actions disabled at repository level. A workflow file cannot provide PR CI and must not be treated as an execution gate. The temporary branch-only workflow created during this task was removed after confirming `.claude/rules/testing-verification.md`.

Authoritative verification surfaces for this work are:

- focused tests executed in the assistant/local sandbox from branch source;
- a full runnable local checkout executing the canonical repository commands;
- Vercel Preview once the current team/access problem is corrected;
- controlled Speaches + PSTN runtime tests for the live voice boundary.

Canonical commands when a full checkout is available:

```bash
pnpm typecheck
pnpm lint
pnpm lint:channels
pnpm lint:tenant-filter
pnpm test:unit
cd apps/crm && bash scripts/verify-voice-core.sh
```

For the isolated worker:

```bash
cd workers/voice-worker
npm install
npm run check
```

Any command not actually executed must remain marked **unmeasured** in completion evidence. No merge to `main` is authorized by this evidence file.
