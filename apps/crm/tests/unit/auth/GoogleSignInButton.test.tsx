import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GoogleSignInButton } from "../../../components/auth/GoogleSignInButton";
import * as firebaseClient from "../../../lib/firebase/client";
import type { AuthResult } from "../../../lib/firebase/client";

const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock("../../../lib/firebase/client", () => ({
  signInWithGoogle: vi.fn(),
}));

describe("GoogleSignInButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls signInWithGoogle and redirects on success", async () => {
    vi.mocked(firebaseClient.signInWithGoogle).mockResolvedValue({ ok: true });
    render(<GoogleSignInButton />);

    fireEvent.click(screen.getByRole("button", { name: /Google/i }));

    await waitFor(() => {
      expect(firebaseClient.signInWithGoogle).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/app/inbox");
    });
  });

  it("redirects to next prop on success if provided", async () => {
    vi.mocked(firebaseClient.signInWithGoogle).mockResolvedValue({ ok: true });
    render(<GoogleSignInButton next="/dashboard" />);

    fireEvent.click(screen.getByRole("button", { name: /Google/i }));

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows an error message if Google sign in fails", async () => {
    vi.mocked(firebaseClient.signInWithGoogle).mockResolvedValue({ ok: false, error: "unknown_error" });
    render(<GoogleSignInButton />);

    fireEvent.click(screen.getByRole("button", { name: /Google/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Erro ao fazer login com Google.");
    });
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("shows pending state and disables button during login", async () => {
    let resolveLogin: (value: AuthResult) => void;
    vi.mocked(firebaseClient.signInWithGoogle).mockReturnValue(new Promise<AuthResult>(res => {
      resolveLogin = res;
    }));

    render(<GoogleSignInButton />);
    const button = screen.getByRole("button", { name: /Google/i });

    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent(/Conectando.../i);
    });

    resolveLogin!({ ok: true });

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/app/inbox");
    });
  });

  it("ignores popup_closed error quietly", async () => {
    vi.mocked(firebaseClient.signInWithGoogle).mockResolvedValue({ ok: false, error: "popup_closed" });
    render(<GoogleSignInButton />);

    fireEvent.click(screen.getByRole("button", { name: /Google/i }));

    // Should not show an alert, it just resets state
    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      const button = screen.getByRole("button", { name: /Google/i });
      expect(button).not.toBeDisabled();
    });
  });
});
