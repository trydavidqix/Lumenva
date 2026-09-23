import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "../../../components/auth/LoginForm";
import * as firebaseClient from "../../../lib/firebase/client";

// Mock NEXT router
const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

// Mock Firebase client wrapper
vi.mock("../../../lib/firebase/client", () => ({
  signInWithEmail: vi.fn(),
}));

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits email and password to signInWithEmail", async () => {
    vi.mocked(firebaseClient.signInWithEmail).mockResolvedValue({ ok: true });
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText(/Email/i), "test@example.com");
    await userEvent.type(screen.getByLabelText(/Senha/i), "password123");

    fireEvent.submit(screen.getByRole("button", { name: /Entrar/i }));

    await waitFor(() => {
      expect(firebaseClient.signInWithEmail).toHaveBeenCalledWith("test@example.com", "password123");
    });

    // Redirects to /app/inbox on success
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/app/inbox");
    });
  });

  it("redirects to next prop if provided", async () => {
    vi.mocked(firebaseClient.signInWithEmail).mockResolvedValue({ ok: true });
    render(<LoginForm next="/custom/path" />);

    await userEvent.type(screen.getByLabelText(/Email/i), "test@example.com");
    await userEvent.type(screen.getByLabelText(/Senha/i), "password123");
    fireEvent.submit(screen.getByRole("button", { name: /Entrar/i }));

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/custom/path");
    });
  });

  it("displays generic auth error on invalid credentials", async () => {
    vi.mocked(firebaseClient.signInWithEmail).mockResolvedValue({ ok: false, error: "invalid_credentials" });
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText(/Email/i), "test@example.com");
    await userEvent.type(screen.getByLabelText(/Senha/i), "wrongpassword");
    fireEvent.submit(screen.getByRole("button", { name: /Entrar/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Email ou senha incorretos.");
    });
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("displays fallback error on unknown failure", async () => {
    vi.mocked(firebaseClient.signInWithEmail).mockResolvedValue({ ok: false, error: "unknown_error" });
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText(/Email/i), "test@example.com");
    await userEvent.type(screen.getByLabelText(/Senha/i), "password123");
    fireEvent.submit(screen.getByRole("button", { name: /Entrar/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Erro inesperado. Tente novamente.");
    });
  });

  it("shows pending state while logging in", async () => {
    let resolveLogin: (value: any) => void;
    vi.mocked(firebaseClient.signInWithEmail).mockReturnValue(new Promise(res => {
      resolveLogin = res;
    }));

    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText(/Email/i), "test@example.com");
    await userEvent.type(screen.getByLabelText(/Senha/i), "password123");
    fireEvent.submit(screen.getByRole("button", { name: /Entrar/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Entrando.../i })).toBeDisabled();
    });

    resolveLogin!({ ok: true });

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/app/inbox");
    });
  });
});
