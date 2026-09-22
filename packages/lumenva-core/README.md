# Lumenva Core

Runtime local independente da UI. O Core mantém ciclo de vida próprio, Event Bus tipado e agora também o Terminal Runtime PTY real. Desktop e futuras interfaces controlam o Core por contratos tipados; não possuem o processo nem os PTYs.

## Terminal Runtime

- `node-pty` é o backend PTY único.
- Windows usa ConPTY via `useConpty` quando disponível pelo `node-pty`.
- O Core possui create/write/resize/kill e publica `terminal.created`, `terminal.output` e `terminal.exited`.
- O renderer não recebe uma API de shell arbitrário; executáveis/args/cwd entram apenas pelos contratos do Core e serão associados aos manifests/policies do Agent Runtime.
- Fechar a UI não encerra sessões; o ciclo de vida pertence ao processo Core.

Invariantes: Core não depende do Electron; eventos têm id/timestamp/source; nenhum dado ausente é convertido em métrica falsa; secrets não são persistidos nem enviados em eventos.
