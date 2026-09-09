import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ContentEditor } from "./ContentEditor";

describe("ContentEditor", () => {
  it("abre um novo rascunho com as secções editoriais e estado de aprovação", () => {
    render(<ContentEditor />);
    expect(screen.getByRole("heading", { name: "Criar conteúdo" })).toBeInTheDocument();
    expect(screen.getByLabelText("Título interno")).toBeInTheDocument();
    expect(screen.getByLabelText("O que este conteúdo precisa alcançar?")).toBeInTheDocument();
    expect(screen.getByLabelText("Hook")).toBeInTheDocument();
    expect(screen.getByLabelText("Roteiro/copy")).toBeInTheDocument();
    expect(screen.getByText("Estado e aprovação")).toBeInTheDocument();
  });

  it("marca alterações, propaga o draft e permite salvar", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSave = vi.fn();
    render(<ContentEditor onChange={onChange} onSave={onSave} />);
    await user.type(screen.getByLabelText("Título interno"), "Novo artigo");
    expect(onChange).toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Alterações não salvas");
    await user.click(screen.getByRole("button", { name: "Salvar rascunho" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: "Novo artigo", version: 1, status: "draft" }));
  });

  it("mantém ações de IA explícitas e acionáveis", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();
    render(<ContentEditor onGenerate={onGenerate} />);
    await user.click(screen.getByRole("button", { name: "Gerar opções" }));
    await user.click(screen.getByRole("button", { name: "Reescrever" }));
    expect(onGenerate).toHaveBeenNthCalledWith(1, "options");
    expect(onGenerate).toHaveBeenNthCalledWith(2, "rewrite");
  });
});
