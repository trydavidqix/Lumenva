# LUMENVA V2.1 — CHANGELOG

## Mudanças principais em relação ao V2

Adicionados ou explicitados:

1. Decision Guard antes do LLM.
2. Context Lifecycle.
3. Agent Builder Reliability State Machine.
4. Provider-neutral Connection Core.
5. Run-owned Execution Channel.
6. External Event Inbox.
7. ActionReceipt.
8. Typed Retry Semantics.
9. Bounded Leasing Audit para job_queue.
10. Agent-facing API style.
11. Fleet / Run / Action Observability.
12. Trace metadata/content policy.
13. Messaging Campaign Engine.
14. Attribution & Conversion Gateway.
15. CRM Automation Engine.
16. Case Management.
17. Approved Response Registry.
18. Notification Delivery Layer.
19. Media Completion Barrier.
20. Follow-up Engine upgrades.
21. External MCP per Organization.
22. Custom Provider Catalog.
23. ERP/System-of-record expansion inspirado no Oryh.

## Decisões preservadas

- Maestri permanece único control plane.
- PostgreSQL permanece business truth.
- event_log permanece event substrate.
- job_queue permanece durable execution queue.
- BrowserMesh permanece browser execution plane.
- Capability OS + Tool Gateway substituem Tool Hub separado.
- Lumenva Brain separado permanece superseded.
- autonomia ilimitada permanece rejeitada.
- skills continuam lazy/on-demand.
- provider/model não define identidade do agente.
