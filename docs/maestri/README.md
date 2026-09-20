# Maestri — Lumenva Engineering Council

Este diretório operacionaliza o Agentic Engineering OS já definido em `docs/MISSION.md`, `docs/ARCHITECTURE.md` e `docs/DECISIONS.md`.

## Regra de autoridade

- **Maestri** é o control plane visual e de coordenação.
- **Claude Code em Maestro Mode** é o único orquestrador.
- **Codex** e **Gemini** são executores. Não criam uma hierarquia paralela.
- O executor principal é escolhido por task:
  - Codex: implementação geral, refactor, testes e integração.
  - Gemini: Google/Firebase/GCP e implementação Google-native quando houver vantagem concreta.
- O Reviewer é temporário e independente; quando possível usa um modelo diferente do executor.
- O verifier é determinístico: shell/scripts/testes reais, não um LLM.
- Merge, deploy, produção, secrets, custo relevante e alterações destrutivas continuam sujeitos a Human Gate.

## Arquivos

- `ENGINEERING_COUNCIL.md` — composição e protocolo do time.
- `PARTITURA_SETUP.md` — montagem do canvas e criação da Partitura.
- `roles/` — prompts copiáveis para Roles do Maestri.
- `notes/` — notas-base para conectar aos agentes.

## Compatibilidade com Maestri

Maestri instala Roles no diretório de projeto e suporta descoberta por `role.json`. O schema completo do sidecar não é documentado publicamente; por isso este repo mantém os prompts canônicos em Markdown e deixa o próprio Maestri gerar os metadados locais ao criar/importar as Roles.

Não commitar tokens, caminhos locais, comandos com secrets ou arquivos exportados de Partitura contendo dados locais.
