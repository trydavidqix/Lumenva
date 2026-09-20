/** Erro normalizado da Graph API. */
export class MetaError extends Error {
  constructor(
    message: string,
    readonly code?: number,
    readonly subcode?: number,
    readonly fbtraceId?: string,
  ) {
    super(message);
    this.name = "MetaError";
  }
}

/** Extrai a mensagem útil de uma resposta de erro da Graph API. */
export function parseMetaError(body: unknown): MetaError {
  const e = (body as { error?: Record<string, unknown> })?.error;
  if (!e) return new MetaError("Erro Meta desconhecido");
  const rawMessage = String(e.message ?? "Erro Meta");
  const message = rawMessage.toLowerCase();
  const code = typeof e.code === "number" ? e.code : undefined;
  const subcode = typeof e.error_subcode === "number" ? e.error_subcode : undefined;
  const hasCode = (value: number) => code === value || subcode === value || message.includes(String(value));
  const knownMessage =
    message.includes("session invalidated") ||
    message.includes("session has been invalidated") ||
    message.includes("frequent posting")
      ? "Instagram bloqueou por publicar demais; espera 1-2 dias"
      : message.includes("not an instagram business account") ||
          message.includes("user is not an instagram business")
        ? "A conta do Instagram precisa ser uma conta profissional (Business)"
        : subcode === 33 || message.includes("revoked_access_token")
          ? "A ligação da conta foi revogada; religa a conta"
          : code === 190 || message.includes("oauthexception")
            ? "token expirado, religa a conta"
              : hasCode(2207050)
              ? "Instagram restringiu esta conta"
              : hasCode(2207003)
                ? "Não foi possível descarregar a imagem; tenta novamente"
                : hasCode(2207020)
                  ? "A imagem expirou; envia-a novamente"
                  : hasCode(2207032)
                    ? "Não foi possível criar a publicação; tenta novamente"
                    : hasCode(2207001)
                      ? "O Instagram detetou esta publicação como spam; altera o conteúdo e tenta novamente"
                      : rawMessage;
  return new MetaError(
    knownMessage,
    code,
    subcode,
    typeof e.fbtrace_id === "string" ? e.fbtrace_id : undefined,
  );
}
