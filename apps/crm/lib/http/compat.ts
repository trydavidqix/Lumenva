/** Leitura dual durante a janela de compatibilidade do rename Lumenva. */
export function readHeaderWithLegacy(
  headers: { get(name: string): string | null },
  currentName: string,
  legacyName: string,
): string | null {
  return headers.get(currentName) ?? headers.get(legacyName);
}
