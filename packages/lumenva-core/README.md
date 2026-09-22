# Lumenva Core

Runtime local independente da UI. Esta primeira fatia estabelece o contrato do processo Core e um Event Bus tipado. Desktop, PTYs, agents, scheduler, MCG, storage e telemetry conectam-se a este processo sem possuir seu ciclo de vida.

Invariantes: Core não depende do Electron; fechar a UI não encerra o Core; eventos têm id/timestamp/source; nenhum dado ausente é convertido em métrica falsa.
