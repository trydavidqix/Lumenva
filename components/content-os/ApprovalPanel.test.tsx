import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ApprovalPanel } from "./ApprovalPanel";

describe("ApprovalPanel", () => {
  it("envia um rascunho para revisão e registra a decisão via callback", async () => {
    const user = userEvent.setup();
    const onTransition = vi.fn();
    render(<ApprovalPanel status="draft" canApprove onTransition={onTransition} />);
    await user.type(screen.getByLabelText(/Nota para a revisão/), "Rever o CTA");
    await user.click(screen.getByRole("button", { name: "Enviar para revisão" }));
    expect(onTransition).toHaveBeenCalledWith("in_review", "Rever o CTA");
  });

  it("oferece aprovação e pedido de alterações durante a revisão", () => {
    render(<ApprovalPanel status="in_review" canApprove />);
    expect(screen.getByRole("button", { name: "Aprovar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pedir alterações" })).toBeInTheDocument();
  });

  it("não permite nova decisão depois de agendado", () => {
    render(<ApprovalPanel status="scheduled" canApprove />);
    expect(screen.queryByRole("button", { name: "Aprovar" })).not.toBeInTheDocument();
    expect(screen.getByText("Agendado")).toBeInTheDocument();
  });
});
