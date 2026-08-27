# CRM Voice Open-Source Europe — Plano de Implementação

> **Status:** plano canônico registrado em 2026-08-27, aprovado pelo dono do repositório. O código
> atual da branch `implementacao-tokens-voice-core` (ver `docs/handoffs/HANDOFF-voice-core.md` e
> `docs/superpowers/plans/2026-08-27-voice-core-canonical-status.md`) ainda reflete majoritariamente
> a arquitetura ANTERIOR (Telnyx + Deepgram + ElevenLabs, número técnico comprado) — ver seção
> "Relação com a implementação existente" no fim deste documento antes de codar qualquer Fase.
>
> **Progresso:**
> - **Fase 1 — IMPLEMENTADA** (commit `f672eb78`). `VoiceEngine` aceita perfil de voz
>   (preset/customized/cloned, providers piper/kokoro/openvoice); adapter Pipecat criado como
>   scaffold atrás da mesma interface; adapter Patter intacto pra rollback.
> - **Fase 2 — IMPLEMENTADA PARCIAL** (commit `ad8e027d`). `SipGateway` criado
>   (`lib/voice/sip/gateway.ts`); adapter Asterisk/ARI criado (`lib/voice/sip/asterisk-adapter.ts`);
>   resolução conexão→número→organização criada (`resolve-organization.ts#resolveByConnection`);
>   migration `0131_voice_sip_connections.sql` (aditiva, `voice_phone_numbers`/
>   `voice_worker_endpoints` continuam funcionando pelo caminho Telnyx antigo). **Não fiz**:
>   `workers/voice-worker/main.mjs` continua exigindo `TELNYX_PHONE_NUMBER` — o SDK Patter+Telnyx
>   usado hoje pelo worker embute o carrier Telnyx na própria construção (`new Patter({ carrier: new
>   Telnyx(...), phoneNumber, ... })`); `technical_phone_e164` está espalhado por toda lógica de
>   direção/contexto/faturamento do worker. Trocar isso sem quebrar o caminho de rollback exige o
>   runtime Pipecat da Fase 3 — não dá pra fazer isolado sem meio-rewire arriscado. Fase 2 fica
>   "pronta pro Fase 3 consumir", não "worker já fala SIP".
> - **Fase 3 — IMPLEMENTADA PARCIAL** (commit pendente nesta sessão). Adapters STT/TTS/clone
>   criados atrás dos ports provider-neutros já existentes (`lib/voice/runtime/stt-port.ts`,
>   `tts-port.ts`): `lib/voice/stt/faster-whisper-adapter.ts` (rejeita transcrição vazia sem
>   inventar turno, valida locale antes de tocar no client); `lib/voice/tts/voice-catalog.ts`
>   (catalogação por idioma/país/género/nome/qualidade/licença/latência, licença incompatível
>   nunca entra no catálogo); `lib/voice/tts/piper-adapter.ts` e `kokoro-adapter.ts`
>   (`cancel()` aborta a stream real, pra barge-in); `lib/voice/clone/openvoice-adapter.ts`
>   (clonagem é caminho separado — `cloneProfileId` fixo na construção, nunca aceita override de
>   voz por chamada, exige consentimento verificado antes de qualquer criação de perfil,
>   revogação independente). `VoiceTtsOptions` ganhou campo opcional `voice` (voiceId/style/
>   speed/pitch) pra esses adapters saberem qual voz falar — antes só carregava `locale`.
>   **Não fiz**: nenhum desses adapters está ligado ao worker de produção nem a um processo
>   Pipecat/faster-whisper/Piper/Kokoro/OpenVoice real — são seams testáveis (interface + client
>   injetado), não integração viva. `whisper.cpp` (fallback sem GPU) não tem adapter ainda. A
>   troca de fato do worker (`workers/voice-worker/main.mjs` de Patter/Telnyx pra Pipecat) segue
>   pendente — é o mesmo bloqueio descrito na Fase 2.
> - **Fase 4 em diante — não implementadas** (config UI, matriz de idiomas, testes E2E,
>   homologação).

**Objetivo:** permitir que cada cliente crie um agent de voz usando o próprio número, escolha uma voz natural por idioma europeu, ajuste o estilo e, opcionalmente, clone uma voz autorizada.

**Arquitetura:** manter o CRM, Agent OS, Supabase, tokens, memória, policies e `VoiceEngine` como autoridade. Substituir Patter, Deepgram e ElevenLabs por adapters open-source, com Pipecat como runtime de voz e Asterisk/ARI como gateway SIP/BYOC.

**Stack definida:**

- Telefonia: Asterisk/ARI, isolado como serviço SIP.
- Runtime de voz: Pipecat.
- STT: faster-whisper.
- TTS principal: Piper para cobertura ampla de idiomas.
- TTS de maior naturalidade: Kokoro quando houver voz aprovada no idioma.
- Clonagem opcional: OpenVoice.
- CRM: `VoiceEngine` atual + Agent OS.
- Número: SIP/BYOC do próprio cliente.

**Restrições globais:**

- Não comprar número técnico.
- Não criar novo CRM, Agent Engine ou banco paralelo.
- Não alterar tokens existentes.
- Não permitir que Pipecat, Asterisk ou TTS executem tools comerciais diretamente.
- Toda ação continua passando pelo Agent OS, policy, tenant e auditoria.
- Gravação e clonagem exigem consentimento.
- Nenhuma voz clonada sem autorização verificável.
- Nenhum provider pago será obrigatório para a primeira versão.

---

### Fase 1 — Preparar o contrato provider-neutral

**Arquivos principais:**

- `lib/voice/engine/contracts.ts`
- `lib/voice/engine/factory.ts`
- `lib/voice/config.ts`
- `lib/voice/runtime/`

**Alterações:**

- Expandir o `VoiceEngine` para aceitar um perfil de voz.
- Adicionar os modos:

```text
preset
customized
cloned
```

- Definir o perfil com:

```text
locale
gender
voiceId
provider
style
speed
pitch
cloneProfileId
```

- Adicionar providers internos:

```text
piper
kokoro
openvoice
```

- Manter o adapter Patter temporariamente para rollback.
- Criar o adapter Pipecat sem mudar o contrato usado pelo Agent OS.
- O `VoiceEngine` deve continuar expondo:

```text
startSession()
events()
speak()
interrupt()
transfer()
end()
```

**Regra:** o Agent OS envia texto e recebe transcrição. Ele não conhece detalhes de Piper, Kokoro, OpenVoice ou Pipecat.

---

### Fase 2 — Trocar o número técnico por SIP/BYOC

**Arquivos principais:**

- `lib/voice/telnyx/`
- `lib/voice/identity/`
- `workers/voice-worker/`

**Alterações:**

- Criar uma interface `SipGateway` para receber e iniciar chamadas.
- Implementar Asterisk/ARI como primeiro gateway.
- Aceitar a conexão SIP/BYOC fornecida pela operadora do cliente.
- Associar:

```text
conexão SIP
        ↓
número E.164
        ↓
organização
        ↓
agent de voz
```

- Inbound:
  - validar conexão;
  - validar número chamado;
  - resolver organização;
  - localizar contacto;
  - iniciar sessão do agent.

- Outbound:
  - exigir organização, contacto, agent e objetivo;
  - validar que o número pertence à organização;
  - usar o Caller ID do próprio cliente;
  - rejeitar chamadas sem conexão verificada.

- Remover a obrigação de:

```text
TELNYX_PHONE_NUMBER
```

- Manter Telnyx apenas como adapter opcional quando for o carrier SIP escolhido pelo cliente.
- Eliminar a regra "um worker por número técnico".
- O worker passa a estar ligado à conexão SIP e resolve o número por chamada.

**Segurança:**

- conexão desconhecida: rejeitar;
- número não verificado: rejeitar outbound;
- tenant ambíguo: rejeitar;
- assinatura inválida: rejeitar;
- evento duplicado: ignorar sem criar novo efeito;
- chamada terminal: não reabrir.

---

### Fase 3 — Criar o runtime de voz open-source

**Arquitetura do worker:**

```text
Asterisk/ARI
      ↓
Node voice-worker
      ↓
Pipecat runtime
      ↓
faster-whisper
      ↓
Agent OS do CRM
      ↓
Piper ou Kokoro
      ↓
Asterisk/ARI
```

**Responsabilidades do Pipecat:**

- receber áudio;
- detectar início e fim da fala;
- executar VAD;
- enviar áudio para STT;
- enviar a transcrição ao CRM;
- receber a resposta do Agent OS;
- converter texto em áudio;
- suportar interrupção do agent;
- controlar turnos;
- emitir eventos de latência e erro.

**Responsabilidades do CRM:**

- identidade do tenant;
- contexto do contacto;
- agent escolhido;
- memória;
- tools;
- policies;
- approvals;
- transferência humana;
- histórico;
- auditoria;
- custos e métricas.

**STT:**

- usar faster-whisper como padrão;
- usar whisper.cpp apenas como fallback para máquinas sem GPU;
- definir modelo por capacidade do servidor;
- validar idioma pelo `locale` da chamada;
- rejeitar transcrição vazia sem inventar turno.

**TTS:**

- Piper para idiomas europeus com menor custo de infraestrutura;
- Kokoro quando a voz tiver melhor naturalidade no idioma;
- catalogar vozes por:

```text
idioma
país
género
nome
qualidade
licença
latência
```

- não disponibilizar vozes cujo modelo tenha licença incompatível com o produto.

**Clonagem:**

- OpenVoice como adapter separado;
- nunca misturar clonagem com o caminho normal de TTS;
- exigir gravação autorizada;
- validar qualidade e idioma;
- gerar um `cloneProfileId`;
- o runtime recebe apenas o identificador do perfil;
- áudio original e artefactos ficam em armazenamento privado;
- permitir revogação e eliminação do perfil;
- bloquear uso de voz de terceiros sem consentimento.

---

### Fase 4 — Configuração do agent no CRM

**Arquivos principais:**

- `app/api/v1/voice/config/route.ts`
- `app/app/settings/tenant/voice/_form.tsx`
- `lib/voice/config.ts`

**Interface do cliente:**

1. Escolher idioma/país.
2. Escolher voz masculina ou feminina.
3. Escolher voz específica.
4. Ajustar:
   - tom;
   - velocidade;
   - energia;
   - formalidade;
   - pausas;
   - estilo.
5. Ouvir prévia.
6. Ativar a voz.
7. Opcionalmente enviar gravação para clonagem.
8. Confirmar consentimento.
9. Testar a voz clonada.
10. Associar a voz ao agent.

**Persistência:**

- manter configurações gerais compatíveis com `organizations.settings.voice`;
- guardar apenas referências de perfil, nunca secrets;
- guardar configuração de voz publicada junto da versão do agent quando houver suporte a override por agent;
- configuração publicada deve ser imutável;
- alteração de voz cria nova versão ou nova configuração auditada;
- não alterar tabelas de tokens nem credenciais existentes.

**Fallback:**

```text
voz clonada indisponível
        ↓
voz Kokoro aprovada
        ↓
voz Piper aprovada
        ↓
falha segura ou transferência humana
```

Nunca trocar silenciosamente para uma voz de outro idioma ou tenant.

---

### Fase 5 — Matriz de idiomas europeus

A implementação não deve prometer todas as línguas antes de testar cada uma.

**Primeira matriz:**

- inglês;
- português de Portugal;
- espanhol;
- francês;
- alemão;
- italiano;
- neerlandês.

**Segunda expansão:**

- sueco;
- dinamarquês;
- norueguês;
- finlandês;
- polaco;
- checo;
- grego;
- romeno;
- húngaro;
- eslovaco;
- esloveno;
- bálticas;
- croata;
- búlgaro;
- ucraniano.

Cada idioma precisa de:

- pelo menos uma voz masculina;
- pelo menos uma voz feminina;
- teste de pronúncia;
- teste de números, datas e nomes;
- teste de latência;
- teste de interrupção;
- teste de chamada telefónica;
- licença validada;
- resultado `PASS`, `PARTIAL` ou `NOT_SUPPORTED`.

Não haverá fallback automático para outro idioma.

---

### Fase 6 — Testes

**Testes unitários:**

- seleção de voz por locale;
- escolha masculina/feminina;
- velocidade, tom e estilo;
- perfil clonado exige consentimento;
- perfil revogado não pode ser usado;
- voz inexistente é rejeitada;
- voz de outro tenant é rejeitada;
- idioma sem voz aprovada falha com segurança;
- fallback respeita a mesma língua;
- transcript vazio não gera resposta;
- interrupção cancela TTS;
- evento duplicado não duplica chamada;
- evento tardio não reabre chamada.

**Testes de integração:**

- Asterisk/ARI para inbound;
- Asterisk/ARI para outbound;
- SIP/BYOC com número do cliente;
- Pipecat → STT → Agent OS → TTS;
- transferência para humano;
- encerramento;
- perda de conexão;
- timeout de STT;
- timeout de TTS;
- worker reiniciado durante chamada;
- isolamento entre organizações.

**Gate local:**

```bash
bash scripts/verify-voice-core.sh
```

O gate deverá incluir:

- contratos do novo `VoiceEngine`;
- adapter SIP;
- adapter Pipecat;
- STT local;
- TTS local;
- clonagem;
- matriz de idiomas;
- isolamento;
- consentimento;
- worker;
- build;
- typecheck;
- tenant lint.

---

### Fase 7 — Homologação e lançamento

**Ordem de ativação:**

1. Testes locais provider-free.
2. Teste com áudio gravado.
3. Teste em browser.
4. Teste com SIP interno.
5. Inbound real usando o número do cliente.
6. Outbound real usando o Caller ID do cliente.
7. Teste de transferência humana.
8. Teste com cada idioma aprovado.
9. Ativação para uma organização.
10. Expansão gradual.

**Métricas obrigatórias:**

- tempo até primeira resposta;
- latência STT;
- latência do Agent OS;
- latência TTS;
- interrupções;
- falhas de áudio;
- transferência;
- duração da chamada;
- custo de infraestrutura;
- qualidade por idioma;
- taxa de fallback;
- chamadas encerradas por erro.

**Critério de sucesso final:**

O cliente consegue:

```text
manter o próprio número
        ↓
ligar o número via SIP/BYOC
        ↓
criar um agent de voz
        ↓
escolher idioma e género da voz
        ↓
escolher voz natural
        ↓
ajustar tom e estilo
        ↓
testar
        ↓
clonar uma voz autorizada, se quiser
        ↓
atender e fazer chamadas reais
```

**Decisão final:** usar Pipecat como runtime open-source acoplado ao `VoiceEngine`; Asterisk/ARI para telefonia; faster-whisper para STT; Piper/Kokoro para vozes; OpenVoice para clonagem. O CRM continua sendo o cérebro e a fonte de verdade. Nenhuma adoção integral de outro projeto será feita.

---

## Relação com a implementação existente (`implementacao-tokens-voice-core`)

Registrado em 2026-08-27 ao lado do gate verde fresco da branch (`bash scripts/verify-voice-core.sh`,
35 arquivos de teste/114 testes, `next build` limpo — ver `2026-08-27-voice-core-canonical-status.md`).

**O que muda de arquitetura, não é incremento:**

| Camada | Implementação atual (branch) | Este plano |
|---|---|---|
| Telefonia | Telnyx, número técnico comprado por org | Asterisk/ARI, SIP/BYOC do cliente |
| STT | Deepgram (adapter atual) | faster-whisper (local/self-host) |
| TTS | ElevenLabs (adapter atual) | Piper (padrão) / Kokoro (naturalidade) |
| Clonagem de voz | não existe | OpenVoice, com consentimento e revogação |
| Runtime de mídia | Patter OSS | Pipecat |
| Modelo de número | 1 worker por número técnico | worker ligado à conexão SIP, resolve número por chamada |

**O que NÃO muda** (os 15 invariantes de segurança do `HANDOFF-voice-core.md` continuam valendo
integralmente): CRM/Agent OS como única fonte de verdade e único runtime de LLM; resolução de
organização antes de qualquer outra coisa; zero lookup cross-tenant; `runModelCall`/Agent Kernel
como seam canônico; Product Agents não promovidos automaticamente; proibição de merge em `main`
sem autorização explícita.

**Como isto deve ser trabalhado:**

- Este documento é o plano canônico para a PRÓXIMA fase do Voice Core — não invalida o trabalho já
  feito e testado na branch atual, que continua sendo a base de código real.
- Antes de abrir a Fase 1 aqui, o próximo agente deve reler `HANDOFF-voice-core.md` e este próprio
  plano juntos — não redesenhar do zero, não descartar os contratos/testes que já existem só porque
  o provider por trás vai trocar (o `VoiceEngine` provider-neutral já existe e é reaproveitado, não
  recriado).
- Continuar seguindo a regra de não mergear `main` sem autorização explícita.
- Continuar trabalhando na mesma branch (`implementacao-tokens-voice-core`) até decisão em contrário.
