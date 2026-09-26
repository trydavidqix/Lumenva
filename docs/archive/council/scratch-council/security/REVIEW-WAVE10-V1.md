# Revisão de segurança — Wave 10 Delivery / Managed Service

Data: 2026-09-13  
Método: inspeção read-only via SSH no worker, sem build, testes, merge, deploy ou efeitos live. O caminho solicitado com barra (`wave10/mobile-delivery-2026-09-13`) não existe; a worktree registrada no worker é `/home/claude/src/worktrees/wave10-mobile-delivery-2026-09-13`.

## Commit e escopo

Worktree/branch: `wave10/mobile-delivery-2026-09-13`  
Commit: `f6585090df04ada1501276fce16679ed9b23db45` (`feat(wave10): add delivery plan gates`).

Arquivos alterados no commit:

- `apps/crm/lib/product-factory/delivery.ts`
- `apps/crm/tests/unit/product-factory-delivery.test.ts`

## Tenant e evidence — comparação com Wave 9

**PASS parcial:** a validação mantém o vínculo explícito entre tenant/projeto e evidências.

Em `delivery.ts`:

- Linhas 34-38 rejeitam artifact fora do delivery plan, `organization_id` ou `project_id` divergentes, `build_ref` divergente e `policy_version` diferente de `release_policy_version`.
- Linhas 39-45 exigem `content_hash`, `provenance_refs`, `test_refs`, `security_scan_refs`, `source_refs`, build `test_refs` e `evidence_refs` não vazios.
- Linha 46 exige artifact `VERIFIED` ou `APPROVED`.

Isso é coerente com o contrato da Wave 9, que carrega `organization_id`, `project_id`, refs de fonte/teste, policy e envelope de autoridade no BuildPlan. Os testes em `product-factory-delivery.test.ts:20-38` cobrem tenant cruzado e ausência de evidências básicas.

Limite importante: os refs são apenas strings não vazias. O código não resolve, autentica ou verifica se o hash, provenance, security scan, testes e evidence refs correspondem realmente ao artifact/build. A prova de conteúdo e durabilidade permanece **NOT_PROVEN**.

Outras lacunas de isolamento/consistência:

- `DeliveryArtifact` não carrega `organization_id` nem `project_id`; a pertença é inferida apenas pelo `delivery_plan_id` (`delivery.ts:13-18`). Não há verificação independente de que esse ID aponta para o tenant correto.
- `delivery_plan_id`, `artifact_ref`, `build_ref`, `organization_id` e `project_id` não têm validação de formato/conteúdo além das comparações; valores vazios podem passar em campos não comparados diretamente.
- `output_sha` é opcional (`delivery.ts:21`) e não é exigido pela validação.

## Canal sem validação de gate

**FAIL/BLOCKED para enforcement sistêmico; nenhum bypass específico de canal foi implementado, mas também não existe função de entrega que obrigue o gate.**

- `delivery.ts:1` declara os canais `WEB_PREVIEW`, `MOBILE_PREVIEW`, `APP_STORE`, `PLAY_STORE` e `MANAGED_SERVICE`.
- `delivery.ts:27-47` recebe `plan`, `artifact` e `buildEvidence` e aplica a mesma validação a todos os canais; não há ramo que isente `MANAGED_SERVICE`, App Store, Play Store ou preview.
- Porém, `validateDeliveryPlan` é somente um predicado. Não há neste commit uma operação `deliver`, transição de status ou wrapper que exija `valid === true` antes da entrega.
- `DeliveryPlan.status` aceita `DRAFT`, `VALIDATED`, `APPROVED`, `PACKAGED`, `DELIVERED`, `FAILED` e `BLOCKED_EXTERNAL` (`delivery.ts:4`), mas a validação não rejeita nenhum status nem exige `APPROVED`/`PACKAGED`.
- Não há correspondência entre canal e plataforma do artefato: por exemplo, `APP_STORE` pode acompanhar artifact `platform: "WEB"`, pois `delivery.ts:15` é opcional e nunca é comparado ao canal.
- Não há gate específico de capability, approval, credential/provider ou environment por canal.
- Assim, qualquer chamador que ignore o retorno, ou que trate `validateDeliveryPlan(...)` como informativo, pode prosseguir com qualquer canal, inclusive `MANAGED_SERVICE`. O código não demonstra um gate fail-closed na fronteira de execução.

Conclusão: **não há evidência de que um canal específico escape intencionalmente das checagens de tenant/evidence; há, contudo, uma lacuna crítica porque a checagem não está acoplada à ação de entrega nem à aprovação de status.**

## Secrets e logging

Busca read-only nos dois arquivos do commit por padrões de credencial (`sk-`, `api[_-]?key`, `secret`, `password`, `Bearer`, `console.`, `logger.`) não encontrou secret hardcoded ou logging sensível.

## Testes

Os testes declarados cobrem aceitação de artifact tenant-matched, tenant cruzado e ausência de hash/provenance/test/evidence refs. Não cobrem status `BLOCKED_EXTERNAL`, status não aprovado, mismatch canal/plataforma, capability/approval, artefato cross-tenant ou uma boundary efetiva de entrega. Não foram executados nesta revisão read-only.

## Veredito final

- Isolamento tenant/projeto e presença mínima de evidence: **PASS parcial**.
- Verificação da autenticidade/conteúdo das evidências: **NOT_PROVEN**.
- Bypass específico por canal: **não observado no predicado**.
- Gate obrigatório antes de entregar e status terminal/aprovado: **FAIL/BLOCKED**.
- Secret hardcoded/log sensível: **nenhum encontrado**.

Não promover para entrega gerenciada até existir uma fronteira de execução que rejeite plano não aprovado/não validado, chame a validação e pare em qualquer erro, com evidência resolvida/verificável e testes de cada canal (especialmente `MANAGED_SERVICE`).

SELF-CHECK: PASS — escopo read-only respeitado, worktree real identificado, sem testes/build/merge/deploy e sem exposição de segredos.
