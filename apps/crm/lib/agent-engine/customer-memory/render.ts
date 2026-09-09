import type { CustomerMemoryFact, CustomerQuickMemory } from "./types";

export interface RenderCustomerQuickMemoryOptions {
  maxChars?: number;
}

function safeFacts(facts: readonly CustomerMemoryFact[]): string[] {
  return facts
    .filter((fact) => fact.actionable && !fact.conflicted && fact.confidence >= 0.7)
    .map((fact) => fact.value.trim())
    .filter(Boolean);
}

/**
 * Compact, bounded prompt projection. This is context only: CRM/order state
 * remains authoritative and raw history stays behind governed read tools.
 */
export function renderCustomerQuickMemory(
  memory: CustomerQuickMemory | null,
  options: RenderCustomerQuickMemoryOptions = {},
): string {
  if (memory === null) return "";
  const maxChars = Math.max(128, options.maxChars ?? 1800);
  const lines: string[] = ["## Memória rápida do cliente (contexto, não fonte autoritativa)"];

  if (memory.identity.displayName) lines.push(`Nome: ${memory.identity.displayName}`);
  if (memory.identity.primaryPhone) lines.push(`Telefone confirmado: ${memory.identity.primaryPhone}`);

  const addresses = safeFacts(memory.addresses);
  if (addresses.length > 0) lines.push(`Endereço(s) confirmado(s): ${addresses.join(" | ")}`);
  const preferences = safeFacts(memory.preferences);
  if (preferences.length > 0) lines.push(`Preferências: ${preferences.join(" | ")}`);
  const habitualOrders = safeFacts(memory.habitualOrders);
  if (habitualOrders.length > 0) lines.push(`Pedido habitual: ${habitualOrders.join(" | ")}`);
  if (memory.recentOrderRefs.length > 0) lines.push(`Pedidos recentes (referências): ${memory.recentOrderRefs.join(", ")}`);
  if (memory.relationshipSummary?.trim()) lines.push(`Resumo da relação: ${memory.relationshipSummary.trim()}`);
  const channelFacts = safeFacts(memory.channelFacts);
  if (channelFacts.length > 0) lines.push(`Canal: ${channelFacts.join(" | ")}`);
  const events = safeFacts(memory.importantEvents);
  if (events.length > 0) lines.push(`Eventos importantes: ${events.join(" | ")}`);

  const rendered = lines.join("\n");
  if (rendered.length <= maxChars) return rendered;
  return `${rendered.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}
