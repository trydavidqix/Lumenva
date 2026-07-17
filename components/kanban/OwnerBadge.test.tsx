/**
 * G3-03 — badge de responsável do lead no kanban.
 * Cobre owner presente (nome + iniciais) e ausente (badge "Sem responsável").
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { OwnerBadge, ownerInitials } from "./OwnerBadge";

describe("OwnerBadge", () => {
  it("mostra nome e iniciais quando há responsável", () => {
    render(<OwnerBadge ownerUserId="u-1" ownerName="Maria Silva" />);
    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    expect(screen.getByText("MS")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Responsável: Maria Silva"),
    ).toBeInTheDocument();
  });

  it("cai para rótulo genérico quando o nome do owner é desconhecido", () => {
    render(<OwnerBadge ownerUserId="u-2" ownerName={null} />);
    expect(screen.getByText("Responsável")).toBeInTheDocument();
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("mostra 'Sem responsável' quando owner é null", () => {
    render(<OwnerBadge ownerUserId={null} ownerName={null} />);
    expect(screen.getByLabelText("Sem responsável")).toBeInTheDocument();
    expect(screen.getByText("Sem responsável")).toBeInTheDocument();
  });

  it("ownerInitials usa primeira e última palavra", () => {
    expect(ownerInitials("Ana")).toBe("AN");
    expect(ownerInitials("Ana Paula Souza")).toBe("AS");
    expect(ownerInitials("   ")).toBe("?");
  });
});
