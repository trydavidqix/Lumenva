# Lumenva Knowledge Core

> **O Cérebro Institucional da Lumenva**
> Fonte institucional que organiza e aponta para as fontes canônicas da Lumenva. Regras de produto e domínio valem conforme seus documentos canônicos; políticas de operação dos agentes ficam nos adapters e rules de cada plataforma. Não infira regra de produto ausente de documentação.

## Organograma de Domínios
- **`/docs/architecture/`**: Decisões técnicas globais e design de software.
- **`/docs/security/`**: Políticas de acesso, RLS, gestão de secrets e sandboxing.
- **`/docs/infra/`**: Especificações de Nuvem (Google Cloud Platform, Cloud Run, Cloud SQL).
- **`/docs/business-rules/`**: Regras puras de domínio e produto (finanças, vendas, integrações).
- **`/docs/runbooks/`**: Procedimentos de resolução de problemas, deploy, e rollbacks.

## Princípio do Company OS
A Lumenva opera sob um modelo AI-First, dividida em Mundos:
1. **Mundo A (Construção da Empresa):** Humanos e IAs trabalhando em conjunto no repositório. Claude orquestra, Codex coda, Gemini provisiona infraestrutura, ChatGPT Work pesquisa. Usamos os limites das nossas assinaturas.
2. **Mundo B (O Produto):** A aplicação consumindo APIs comerciais de LLMs atrás de um roteador agnóstico (Internal AI Router) no Google Cloud.

## Evidência & Hooks (Polícia de Automação)
Agentes não confiam em agentes. Nenhuma mutação de código crítica ou infraestrutura avança para STG/PROD sem:
- `pnpm typecheck`
- `pnpm test:unit`
- Linting
- Revisão por um modelo distinto (Multi-Model Review).

*Se o Knowledge Core for atualizado, a diretriz antiga morre instantaneamente.*
