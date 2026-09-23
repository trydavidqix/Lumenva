"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "@/lib/firebase/client";

export function GoogleSignInButton({ next }: { next?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = () => {
    setError(null);
    startTransition(async () => {
      const res = await signInWithGoogle();
      if (res.ok) {
        router.replace(next || "/app/inbox");
        return;
      }
      if (res.error === "popup_closed") {
        // User closed the popup, fail silently and allow retry
        return;
      }
      setError("Erro ao fazer login com Google.");
    });
  };

  return (
    <div className="space-y-4">
      {error && (
        <div
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      )}
      <Button
        variant="outline"
        type="button"
        className="w-full"
        disabled={isPending}
        onClick={handleSignIn}
      >
        {isPending ? "Conectando..." : "Entrar com Google"}
      </Button>
    </div>
  );
}
