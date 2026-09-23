# GCP Logging

Este pacote (`@lumenva/gcp-logging`) implementa a camada de logging estruturado (JSON) para o Cloud Logging, seguindo as diretrizes do gate F8-J4.

## Funcionalidades

- Saída JSON estruturada pronta para consumo pelo GCP Logging.
- Redação automática de segredos (`password`, `token`, `cookie`, `cpf`, etc.) para conformidade LGPD e segurança.
- Suporte a correlacionamento (`request_id`, `trace_id`), mapeando `trace_id` para o formato nativo do GCP `logging.googleapis.com/trace`.
- Inserção de `organization_id` quando fornecido explicitamente no contexto do log (não infere automaticamente, conforme contrato).

## Uso

```typescript
import { logger } from '@lumenva/gcp-logging';

logger.info('User created successfully', {
  user_id: '123',
  organization_id: 'org_123',
  request_id: 'req_abc',
  trace_id: 'projects/my-project/traces/123456',
  email: 'test@example.com' // Será ocultado/redacted pelo log
});
```

A severidade padrão mapia:
- `debug` -> `DEBUG`
- `info` -> `INFO`
- `warn` -> `WARNING`
- `error` -> `ERROR` (escrito em `stderr`)
