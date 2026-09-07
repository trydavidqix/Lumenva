# Content OS Video Composer

Private server-to-server boundary for video composition. The CRM owns the
creative job and canonical asset; this service is only a rendering worker.

## API contract

Only these operations are part of the V1 contract:

```text
POST /v1/jobs
GET  /v1/jobs/{id}
POST /v1/jobs/{id}/cancel
GET  /health
```

`POST /v1/jobs` receives a structured script, asset references and output
format. Responses contain a provider job identifier, state and (when ready)
an output descriptor. Provider configuration is not writable through this
API. The endpoint is private and must require a server-to-server bearer secret;
the secret must never be placed in a query string or logs.

The CRM must copy completed output into its own Storage bucket before exposing
an asset to a browser. Worker URLs are temporary implementation details, not
canonical asset identifiers.

## MoneyPrinterTurbo notice

If substantial portions of MoneyPrinterTurbo are copied into this service,
preserve its copyright and MIT license notices in the copied files and include
the upstream license in the distribution. Keep the extraction limited to the
composition path required by V1; do not copy the Streamlit UI, provider
configuration UI, or unrelated publishing code.
