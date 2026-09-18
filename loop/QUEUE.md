# Loop queue

Maestro adds one audited remediation branch at a time to `loop/queue.json`.

Required fields: `id`, `status`, `branch`, `worktree`, `title`, `objective`,
`files`, `acceptance`, `verification`, `attempts`.

Run from repo root:

```bash
node scripts/loop-controller.mjs --queue loop/queue.json --tasks TASKS.md --runlog RUNLOG.md
```

Controller calls `maestri recruit`/`maestri ask` for one on-demand Builder and
one temporary Reviewer, then dismisses both. It never merges, pushes, deploys,
or passes a human gate.

Builder return contract: `FILES_CHANGED`, `COMMANDS_RUN`, `TEST_RESULTS`,
`KNOWN_ISSUES`, `STATUS=READY_FOR_REVIEW|FAILED`.

Maestro return contract: `TASK`, `STATUS`, `O_QUE_FOI_ALTERADO`,
`TESTES_EXECUTADOS`, `RESULTADO`, `RISCOS`, `PROXIMO_PASSO`.

Reviewer contract: first line `PASS`, or first line `FAIL` followed by numbered
findings. Every finding must include `Evidence:` and `Recommended action:`.
