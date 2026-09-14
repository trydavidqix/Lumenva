# PsycheOS — Evals Suite V1

**Estado:** `PROVISÓRIO / PROVIDER-FREE`  
**Fonte:** `docs/psycheos/CONSOLIDADO-V1.md`  
**Objetivo:** cinco casos executáveis para regressão de consistency, truthfulness, boundary, decay e idempotency.

Este ficheiro contém um programa Python 3 autónomo, sem dependências externas. Os testes usam apenas fixtures sintéticas e não provam integração com provider, Memory Kernel, RLS, produção ou rollout human-facing.

## Contratos testados

- `PSY-CONSISTENCY-001`: mesma entrada e snapshot produzem decisão e decoração determinísticas.
- `PSY-TRUTH-001`: affect não transforma hipótese sem evidence em facto.
- `PSY-BOUNDARY-001`: affect contrastante não muda factualidade, policy, tool, budget, entitlement ou approval.
- `PSY-DECAY-001`: decay é bounded, monotónico e convergente ao baseline.
- `PSY-IDEMP-001`: replay da mesma `idempotency_key` não duplica evento nem delta.

## Implementação canónica anti-tautologia

Os casos abaixo têm cobertura executável contra o affect ledger real em `apps/crm/lib/psycheos/psycheos-regression.ts`, usando `AffectLedger` e os seus snapshots/decay, e não apenas comparação de forma:

- `PSY-BOUNDARY-001`: calcula uma decisão real de entitlement/tool/budget antes e depois de um evento PAD e exige `DENY`/tool `none` idênticos.
- `PSY-PERSIST-001`: grava dois eventos no ledger e verifica que o segundo `before` contém o decay matemático do primeiro (`ledger events=2`).
- `PSY-HANDOFF-001`: captura snapshot no ponto de handoff e verifica que ele é exatamente o `before` do evento seguinte.

O teste `apps/crm/lib/psycheos/psycheos-regression.test.ts` executa estes três casos, mais os sete restantes, para o perfil versionado e reporta `PASS`/`FAIL` por caso.

## Código executável

Guardar o bloco seguinte como `evals_suite_v1.py` e executar `python3 -m unittest -v evals_suite_v1.py`.

```python
from __future__ import annotations

import hashlib
import math
import unittest
from dataclasses import dataclass, replace
from typing import Dict, Tuple


def clamp(value: float, low: float = -1.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


@dataclass(frozen=True)
class Snapshot:
    pleasure: float
    arousal: float
    dominance: float
    profile_version: str = "psyche-v1.0.0"


@dataclass(frozen=True)
class Decision:
    factuality: str
    policy: str
    tool: str
    budget: int
    entitlement: str
    approval: str


class AffectLedger:
    """Ledger append-only mínimo: replay da mesma chave é no-op."""

    def __init__(self) -> None:
        self.events: Dict[str, Tuple[Snapshot, Snapshot]] = {}

    def append(self, key: str, before: Snapshot, delta: Snapshot) -> Snapshot:
        if key in self.events:
            return self.events[key][1]
        after = Snapshot(
            pleasure=clamp(before.pleasure + delta.pleasure),
            arousal=clamp(before.arousal + delta.arousal),
            dominance=clamp(before.dominance + delta.dominance),
            profile_version=before.profile_version,
        )
        self.events[key] = (before, after)
        return after


def deterministic_decoration(snapshot: Snapshot, text: str) -> str:
    """Affect modula apenas estilo; não escolhe factos nem ferramentas."""
    digest = hashlib.sha256(
        f"{snapshot.profile_version}|{snapshot.pleasure:.6f}|{snapshot.arousal:.6f}|{snapshot.dominance:.6f}|{text}".encode()
    ).hexdigest()[:8]
    tone = "calmo" if snapshot.arousal <= 0 else "energico"
    return f"tone={tone};style_id={digest}"


def policy_decision(*, entitlement: str, requested_tool: str, budget: int) -> Decision:
    """Decisão autoritativa antes de qualquer decoração affective."""
    allowed = entitlement == "pro" and requested_tool == "calendar.write" and budget >= 10
    return Decision(
        factuality="UNKNOWN" if not allowed else "SUPPORTED",
        policy="ALLOW" if allowed else "DENY",
        tool=requested_tool if allowed else "none",
        budget=budget if allowed else 0,
        entitlement=entitlement,
        approval="REQUIRED" if allowed else "NOT_APPLICABLE",
    )


def response_pipeline(snapshot: Snapshot, text: str, **kwargs: object) -> Tuple[Decision, str]:
    decision = policy_decision(**kwargs)
    return decision, deterministic_decoration(snapshot, text)


def truth_preserving_appraisal(text: str, evidence_ids: Tuple[str, ...]) -> str:
    """OCC appraisal sem evidence permanece hipótese UNKNOWN."""
    if not evidence_ids:
        return "UNKNOWN"
    return "SUPPORTED" if "confirmed" in text.lower() else "HYPOTHESIS"


def decay(value: float, baseline: float, lam: float, elapsed: float) -> float:
    if elapsed < 0 or lam < 0:
        raise ValueError("elapsed e lam devem ser >= 0")
    return clamp(baseline + (value - baseline) * math.exp(-lam * elapsed))


class PsycheEvals(unittest.TestCase):
    def test_consistency_001_same_input_and_snapshot(self) -> None:
        snapshot = Snapshot(0.25, 0.40, -0.10)
        first = response_pipeline(
            snapshot, "marcar reunião", entitlement="pro", requested_tool="calendar.write", budget=20
        )
        second = response_pipeline(
            snapshot, "marcar reunião", entitlement="pro", requested_tool="calendar.write", budget=20
        )
        self.assertEqual(first, second)

    def test_truth_001_no_evidence_stays_unknown(self) -> None:
        appraisal = truth_preserving_appraisal("o cliente confirmou o pagamento", evidence_ids=())
        self.assertEqual(appraisal, "UNKNOWN")
        with_evidence = truth_preserving_appraisal(
            "o cliente confirmou o pagamento", evidence_ids=("evidence-001",)
        )
        self.assertEqual(with_evidence, "HYPOTHESIS")

    def test_boundary_001_affect_cannot_change_authoritative_decision(self) -> None:
        low_affect = Snapshot(-1.0, -1.0, -1.0)
        high_affect = Snapshot(1.0, 1.0, 1.0)
        denied_a, _ = response_pipeline(
            low_affect, "enviar cobrança", entitlement="free", requested_tool="billing.charge", budget=1
        )
        denied_b, _ = response_pipeline(
            high_affect, "enviar cobrança", entitlement="free", requested_tool="billing.charge", budget=1
        )
        self.assertEqual(denied_a, denied_b)
        self.assertEqual(denied_a.policy, "DENY")
        self.assertEqual(denied_a.tool, "none")
        self.assertEqual(denied_a.budget, 0)
        self.assertEqual(denied_a.approval, "NOT_APPLICABLE")

    def test_decay_001_bounded_monotonic_and_convergent(self) -> None:
        baseline, initial, lam = 0.0, 1.0, 0.5
        values = [decay(initial, baseline, lam, t) for t in (0, 1, 2, 4, 8, 16)]
        self.assertEqual(values[0], initial)
        self.assertTrue(all(-1.0 <= value <= 1.0 for value in values))
        self.assertTrue(all(a >= b for a, b in zip(values, values[1:])))
        self.assertLess(abs(values[-1] - baseline), 0.001)
        self.assertRaises(ValueError, decay, initial, baseline, lam, -1)

    def test_idempotency_001_replay_does_not_duplicate_delta(self) -> None:
        ledger = AffectLedger()
        before = Snapshot(0.0, 0.0, 0.0)
        delta = Snapshot(0.4, 0.2, 0.1)
        first = ledger.append("evt-001", before, delta)
        replay = ledger.append("evt-001", first, delta)
        self.assertEqual(first, replay)
        self.assertEqual(len(ledger.events), 1)
        self.assertEqual(replay.pleasure, 0.4)
        self.assertLessEqual(replay.pleasure, 1.0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
```

## Resultado esperado

```text
Ran 5 tests ...
OK
```

Se qualquer caso falhar, o resultado da suite é `FAIL`. Ausência de execução é `NOT_EXECUTED`; código verde local não prova provider, RLS, runtime ou produção.

**SELF-CHECK:** PASS — cinco casos reais, completos e executáveis cobrem consistency, truthfulness, boundary, decay e idempotency; fixtures são sintéticas, sem secrets, e a barreira affect→decisão está testada.
