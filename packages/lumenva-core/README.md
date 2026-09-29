# EXPERIMENTAL / PARTIAL — Lumenva Core

Preserved from frozen source `ec8b4e5e886c06af9d6fd6fa764e57089ea61963`. This package is archival experimental work: it is not production-ready, is not wired into apps or workspace activation, and requires GitHub Actions validation before any adoption. The PTY runtime accepts executable, arguments, working directory, and environment from its caller; treat it as privileged local code and do not expose it to an untrusted renderer. MCG/Maestri gateway integration is out of scope and excluded.

Runtime local independente da UI. O Core mantém ciclo de vida próprio, Event Bus tipado e agora também o Terminal Runtime PTY real. Desktop e futuras interfaces controlam o Core por contratos tipados; não possuem o processo nem os PTYs.

## Terminal Runtime

- `node-pty` é o backend PTY único.
- Windows usa ConPTY via `useConpty` quando disponível pelo `node-pty`.
- O Core possui create/write/resize/kill e publica `terminal.created`, `terminal.output` e `terminal.exited`.
- O renderer não recebe uma API de shell arbitrário; executáveis/args/cwd entram apenas pelos contratos do Core e serão associados aos manifests/policies do Agent Runtime.
- Fechar a UI não encerra sessões; o ciclo de vida pertence ao processo Core.

Invariantes: Core não depende do Electron; eventos têm id/timestamp/source; nenhum dado ausente é convertido em métrica falsa; secrets não são persistidos nem enviados em eventos.
