# Dimensionamento de VPS para agentes autónomos — 2026-09-08

## Escopo e método

Pesquisa feita em 2026-09-08 para uma VPS Hetzner separada da produção. Os preços Hetzner abaixo são mensais, sem IVA e sem IPv4, para Alemanha/Finlândia, conforme a tabela oficial atualizada após 15-06-2026. A conversão dos preços Nous (USD) para EUR usa a referência do BCE de 08-09-2026: EUR 1 = USD 1,1614. Não houve deploy, criação de servidor, instalação ou medição numa máquina real.

As fontes oficiais foram priorizadas. Relatos de Reddit/GitHub dos últimos 30 dias foram usados como sinais de operação, não como especificação. Quando não existe número oficial, o número de planeamento está marcado como **estimativa conservadora**.

## Veredito executivo

- Para Hermes: reservar **2 GB por agente em uso normal**, mais 1,5 GB para sistema e margem. Browser, pesquisa pesada e sub-agentes podem levar um único agente a 4–8 GB; portanto 4 GB é o mínimo de teste, não uma margem confortável.
- Para OpenClaw: reservar **1,5 GB por agente** mais 1,5 GB de gateway/sistema. O upstream diz que 4 GB é suficiente para um gateway pequeno, mas há incidentes reais de 1,6 GB de pico, 200–600 MiB transitórios por chamada e até 6 GB de pico. O dimensionamento abaixo limita concorrência e evita tratar esses picos como impossíveis.
- Para começar com 2 agentes com folga real: **CAX31 (8 vCPU ARM, 16 GB, €20,99/mês)** se todas as dependências forem ARM64; **CX43 (8 vCPU x86, 16 GB, €15,99/mês)** é a opção x86 mais simples. A recomendação prática é CX43 pela compatibilidade.
- Para 4 agentes com folga real: **CX43** para OpenClaw; para Hermes, **CX43/CAX31** com 16 GB. Não usar 8 GB para quatro Hermes ativos com browser/sub-agentes.

## A. Hermes Agent (Nous Research)

### O que é confirmado oficialmente

O repositório oficial instala em Linux/macOS/WSL2/Termux e o caminho de desenvolvimento usa Python 3.11 (`uv venv venv --python 3.11`); o runtime do agente é Python, não Node. A documentação descreve CLI, gateway de mensagens, memória persistente, cron, Bot Mode e delegação para sub-agentes isolados: [documentação Hermes](https://hermes-agent.nousresearch.com/docs/), [repositório Hermes](https://github.com/NousResearch/hermes-agent#readme).

Não há requisito oficial publicado de RAM/CPU mínima. A frase “um VPS de $5” na página inicial é posicionamento, não um SLO de memória. Hermes não requer uma base de dados externa para o modo básico: a memória e sessões ficam no estado local (`~/.hermes`); serviços externos só são necessários para o modelo, canais, browser/serviços de ferramentas ou MCP que forem escolhidos. Honcho, Docker/SSH/Modal/Daytona e gateways de mensagens são opcionais, conforme a [arquitetura e ferramentas](https://hermes-agent.nousresearch.com/docs/user-guide/features/tools/).

### Evidência operacional e sizing

Um relato de utilizador mediu o processo CLI sem gateway em aproximadamente **200–350 MB RSS** e sugeriu pelo menos 2 GB, preferindo 4 GB: [Reddit — actual memory requirements](https://www.reddit.com/r/hermesagent/comments/1t246e3/actual_memory_ram_not_vram_requirements/). Outro relato, de 04–05-09-2026, informa OOM com 2 GB e depois 4 GB durante pesquisa com browser; mesmo 8 GB para um único agente continuava a ser considerado para margem: [Reddit — multiple agents using tools](https://www.reddit.com/r/hermesagent/comments/1w709c2/multiple_agents_using_tools_and_ram_requried/). O relato de 11-08-2026 alerta que Chromium muda rapidamente o perfil e pode exigir 8 GB ou swap: [Reddit — Hermes VPS](https://www.reddit.com/r/hermesagent/comments/1thlpq7/actually_best_hermes_agent_vps_hosting/).

**Veredito Hermes:**

- Mínimo técnico de arranque: **1 vCPU e 2 GB RAM** para CLI simples, sem browser, inferência remota e sem sub-agente concorrente. Isto é uma estimativa baseada nos 200–350 MB RSS observados, não uma garantia oficial.
- Mínimo recomendável: **2 vCPU e 4 GB RAM para um agente**. Reservar cerca de 1,5 GB para OS/serviços e 2 GB para o agente deixa pouca margem para browser.
- Repouso de planeamento: **0,25–0,50 GB por agente** (baseado no relato de 200–350 MB, arredondado para logs/estado).
- Pico de planeamento: **2–3 GB por agente sem browser; 4–8 GB para pesquisa/browser ou workloads que lançam ferramentas**. O caso de 4–8 GB é uma banda de risco observada, não um requisito universal.
- Sub-agente: a implementação cria processos/sessões isolados; não existe número oficial. Para orçamento, adicionar **0,25–0,50 GB em repouso e 0,75–1,5 GB durante execução por sub-agente concorrente**, mais CPU proporcional. Tratar como envelope conservador.
- CPU: 1 vCPU pode arrancar, mas **2 vCPU por agente** é o ponto de partida para não serializar heartbeat, ferramentas e gateway. CPU de browser é bursty.

## B. OpenClaw

### O que é confirmado oficialmente

O Gateway é o plano de controlo local para sessões, ferramentas, eventos e ligações de canais; Control UI, CLI e TUI ligam-se a ele. Canais, plugins, memória, browser e nós podem subir junto: [README oficial](https://github.com/openclaw/openclaw/blob/main/README.md). A documentação Docker diz que Docker é opcional e que uma imagem pré-construída evita o requisito de 6 GB usado apenas para build local: [Docker](https://docs.openclaw.ai/install/docker).

As páginas oficiais atuais divergem de um guia antigo: o guia “Getting started” ainda menciona Node 22.19+/23.11+/24+, mas a referência atual de instalação exige **Node 24.16+ ou 26.1+**, recomenda Node 26 e declara Node 22/23/25 sem suporte. A página mais recente de compatibilidade é a fonte que deve governar uma instalação nova: [Node.js atual](https://docs.openclaw.ai/install/node), [compatibilidade](https://docs.openclaw.ai/install/node-compatibility), [guia antigo](https://docs.openclaw.ai/getting-started).

Não há requisito oficial fixo de RAM por agente. O FAQ oficial diz que um VPS pequeno/Raspberry Pi com **4 GB RAM é suficiente** para um gateway comum: [FAQ](https://github.com/openclaw/openclaw/blob/main/docs/help/faq.md).

### Evidência operacional e sizing

Os relatos do próprio repositório mostram que “4 GB chega” não é envelope de pico: houve gateway com **~724 MB RAM e 100–130% CPU em idle** em v2026.4.29 com cinco agentes configurados ([issue #75707](https://github.com/openclaw/openclaw/issues/75707)); outro incidente registou **1,6 GB de pico** ([issue #75297](https://github.com/openclaw/openclaw/issues/75297)); e um caso reportou **6 GB de pico em 26 minutos** num VPS de 8 GB ([issue #24689](https://github.com/openclaw/openclaw/issues/24689)). Em v2026.6.11, uma chamada normal de dashboard causou **200–600 MiB de RSS transitório** com estado estável de ~350 MB ([issue #100041](https://github.com/openclaw/openclaw/issues/100041)). São bugs/regressões específicas, não consumo garantido de todas as versões; servem para margem e para fixar versão.

**Veredito OpenClaw:**

- Mínimo técnico: **2 vCPU e 4 GB RAM para um gateway/um agente**, apenas com modelo remoto, poucos plugins e sem browser local. O número de 4 GB é o recomendado pelo FAQ, não uma garantia contra regressões.
- Repouso de planeamento: **0,5–0,8 GB por gateway/agente**; usar 0,8 GB para orçamento.
- Pico normal de planeamento: **1,5–2 GB por agente**; dashboards, memória/indexação e transcrições podem acrescentar 0,2–0,6 GB transitórios.
- Pico patológico observado: **6 GB em uma instância**, por isso não prometer que 4 GB sobreviverá a qualquer versão/configuração.
- Sub-agente: OpenClaw multiplica sessões dentro do gateway; não há número oficial por sub-agente. Para planeamento, adicionar **0,5–1 GB por sub-agente concorrente**, mais 0,5 vCPU equivalente.
- Serviços que podem subir junto: Gateway, Control UI, plugins de memória (SQLite/índice), canais (Telegram/WhatsApp/Discord/etc.), browser/Playwright e sandbox Docker/Podman. Browser e sandbox devem ser tratados como componentes de pico separados.

### Segurança do Gateway

O Gateway deve ficar em `loopback` e ser acedido por túnel SSH/Tailscale quando possível. A runbook oficial recomenda autenticação por token, firewall/allowlist e sandbox para sessões não-main; a documentação de exposição diz explicitamente para nunca publicar o Gateway sem autenticação em `0.0.0.0`: [exposure runbook](https://docs.openclaw.ai/gateway/security/exposure-runbook), [network exposure](https://docs.openclaw.ai/gateway/security/network-exposure). Expor a porta transforma ferramentas, canais e eventualmente `exec` numa superfície de execução remota; para esta VPS separada, manter loopback, negar `exec` por defeito e usar um utilizador/host dedicado.

## C. Hetzner Cloud — preços atuais

Preços abaixo: Alemanha/Finlândia, sem IVA e sem IPv4, mensalidade máxima; 20 TB/mês incluídos para CX/CPX/CAX na Europa ([tráfego incluído](https://docs.hetzner.com/robot/general/traffic/)). A atualização de 15-06-2026 é a fonte oficial de preço e explica que o valor entrou em vigor para novas encomendas e resizes nessa data: [Hetzner price adjustment](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/). CX/CAX/CPX são recursos partilhados; a CPU pode sofrer vizinhos/burst ([FAQ de recursos](https://docs.hetzner.com/cloud/servers/faq/)).

| Plano | CPU | RAM | Disco NVMe | Tráfego EU | €/mês sem IVA | Veredito para agentes |
|---|---:|---:|---:|---:|---:|---|
| CAX11 (ARM64 Ampere) | 2 vCPU | 4 GB | 40 GB | 20 TB | 5,99 | 1 Hermes ou 1 OpenClaw em teste; pouca folga |
| CAX21 (ARM64 Ampere) | 4 vCPU | 8 GB | 80 GB | 20 TB | 10,49 | 2 Hermes leves ou 3 OpenClaw; margem limitada |
| CAX31 (ARM64 Ampere) | 8 vCPU | 16 GB | 160 GB | 20 TB | 20,99 | 5 Hermes ou 8 OpenClaw com envelope conservador |
| CX23 (x86 Intel/AMD) | 2 vCPU | 4 GB | 40 GB | 20 TB | 5,49 | 1 Hermes ou 1 OpenClaw; mínimo prático |
| CX33 (x86 Intel/AMD) | 4 vCPU | 8 GB | 80 GB | 20 TB | 8,49 | 2 Hermes ou 3 OpenClaw |
| CX43 (x86 Intel/AMD) | 8 vCPU | 16 GB | 160 GB | 20 TB | 15,99 | 5 Hermes ou 8 OpenClaw |
| CPX22 (x86 AMD) | 2 vCPU | 4 GB | 80 GB | 20 TB | 19,49 | 1 Hermes ou 1 OpenClaw; caro para RAM |
| CPX32 (x86 AMD) | 4 vCPU | 8 GB | 160 GB | 20 TB | 35,49 | 2 Hermes ou 3 OpenClaw; CPU melhor, custo alto |
| CPX42 (x86 AMD) | 8 vCPU | 16 GB | 320 GB | 20 TB | 69,49 | 5 Hermes ou 8 OpenClaw; só se CPU dedicada/regular compensar |

Os nomes e as especificações atuais são confirmados na página de produto Hetzner (inclui CAX/CX/CPX e disco): [Cloud made in Germany](https://www.hetzner.com/cloud-made-in-germany/). O CPX12 de 1 vCPU/2 GB aparece como produto europeu em documentação de catálogo, mas não consta na tabela de preço EU atual da alteração de junho; não o uso na recomendação por não ser uma base de compra segura ([catálogo cloud](https://docs.hetzner.cloud/whats-new)).

### Como foram calculadas as capacidades

Envelope de capacidade = (RAM total − 1,5 GB de sistema/daemon/logs − 1 GB de headroom) dividido por reserva por agente, arredondado para baixo. A tabela reduz ainda mais o resultado quando o workload tem maior risco. Reservas: Hermes 2,5 GB/agente (inclui pico sem browser); OpenClaw 1,5 GB/agente (inclui gateway e pico normal). Assim, a tabela não conta “agentes teóricos” que usam 100% da RAM. Browser local, indexação pesada, sub-agentes concorrentes e modelos locais invalidam a conta e pedem resize.

## D. Custo do cérebro de IA

### Nous Portal

O plano Plus custa **USD 20/mês**, inclui USD 22 de créditos mensais, limite de rollover de USD 10, modelos e ferramentas hospedadas; Super é USD 100/110 e Ultra USD 200/220: [planos Nous Portal](https://portal.nousresearch.com/manage-subscription). À taxa BCE de 08-09-2026 (USD 1,1614/EUR), Plus equivale a aproximadamente **€17,22/mês**, antes de impostos e do câmbio efetivo do cartão: [BCE](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html).

### Heartbeat DeepSeek — estimativa reproduzível

O catálogo Nous lista DeepSeek V4 Flash 0731 a **USD 0,04 por milhão de tokens de entrada e USD 0,13 por milhão de saída**: [modelos/preços Nous](https://portal.nousresearch.com/). Para um heartbeat a cada 5 minutos (288/dia, 8.640/mês), assumindo 2.000 tokens de entrada e 500 de saída por batida:

`17,28M × $0,04 + 4,32M × $0,13 = $1,2528/mês ≈ €1,08/mês`.

Sensibilidade: a cada 15 minutos e o mesmo payload, ≈ **€0,36/mês**; a cada 1 minuto, ≈ **€5,41/mês**. Contexto real, retries, ferramentas e respostas mais longas podem multiplicar esses valores. O heartbeat não “gasta” RAM adicional fixa; ele cria picos de CPU/RAM durante a chamada. Se o plano Plus for usado, o crédito de USD 22 cobre a estimativa de heartbeat, mas não implica custo de servidor Hetzner nem garante que ferramentas adicionais permaneçam dentro do crédito.

## Tabela final: capacidade com folga

| Plano Hetzner | Preço €/mês | RAM | Hermes com folga | OpenClaw com folga |
|---|---:|---:|---:|---:|
| CAX11 | 5,99 | 4 GB | 1 | 1 |
| CAX21 | 10,49 | 8 GB | 2 | 3 |
| CAX31 | 20,99 | 16 GB | 5 | 8 |
| CX23 | 5,49 | 4 GB | 1 | 1 |
| CX33 | 8,49 | 8 GB | 2 | 3 |
| CX43 | 15,99 | 16 GB | 5 | 8 |
| CPX22 | 19,49 | 4 GB | 1 | 1 |
| CPX32 | 35,49 | 8 GB | 2 | 3 |
| CPX42 | 69,49 | 16 GB | 5 | 8 |

**Recomendação:** começar com **CX43 (16 GB, €15,99/mês)** para 2 agentes com folga real e caminho para 4; escolher **CAX31 (16 GB, €20,99/mês)** apenas se ARM64 estiver validado por todas as ferramentas. Para 4 agentes, manter **CX43** e limitar browser/sub-agentes concorrentes; se Hermes fizer pesquisa/browser intensiva, subir para um plano de 32 GB em vez de contar cinco agentes no papel. Os preços não incluem IVA, IPv4 adicional, volumes, backups ou custos de modelo.

## Fontes recentes cruzadas (últimos 30 dias)

- [Reddit Hermes VPS, 19–25-08-2026](https://www.reddit.com/r/Hosting/comments/1vsnqbg/has_anyone_tried_running_hermes_agent_in_a_vps/) — confirma que o dimensionamento deve medir RAM/CPU; não fornece benchmark numérico.
- [Reddit Hermes, 04–05-09-2026](https://www.reddit.com/r/hermesagent/comments/1w709c2/multiple_agents_using_tools_and_ram_requried/) — 2 GB e 4 GB sofreram OOM durante browser/pesquisa; 8 GB ainda para um agente.
- [Reddit OpenClaw, 02-09-2026](https://www.reddit.com/r/openclaw/comments/1w50fmg/new_memory_system/) — confirma que memória/indexador é componente ativo e sujeito a mudanças; não é benchmark de RAM.
- [GitHub OpenClaw issue #119189](https://github.com/openclaw/openclaw/issues/119189) — warnings de pressão de memória em gateway; evidência qualitativa de que baseline depende de estado/indexação.

Quando relatos contradizem o FAQ (“4 GB chega”), o FAQ é a recomendação nominal para gateway pequeno; os issues mais recentes têm precedência para risco de pico porque medem versões/configurações reais e documentam RSS/CPU observados. Nenhuma fonte recente sustenta uma promessa universal de número de agentes sem workload fixo.
