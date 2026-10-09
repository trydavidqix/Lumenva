# Social Workflow

Este documento descreve o fluxo de trabalho de conteúdo social, desde a criação até a publicação.

1. Conteúdo criado entra no status `DRAFT`.
2. Qualquer edição em conteúdo, variantes, mídia ou configurações de publicação muda o status do conteúdo de volta para `DRAFT`, invalidando aprovações ou agendamentos anteriores.
3. As aprovações exigem um snapshot inalterado.
4. Retry de publicações atua somente em destinos que falharam (status `failed`), sem duplicar publicações que já tiveram sucesso.
5. A aprovação é ligada estritamente ao locatário (`tenant`/`workspaceId`) e versão (`snapshotHash`) exatos.
6. A execução de publicación ocorre por provider, e qualquer erro transiente (`retryable`) permite novas tentativas explícitas.
