"use client";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { signOutEverywhere } from "@/app/actions/settings/signOutEverywhere";

export function SecurityClient() {
  const [isSigningOut, startSignOut] = useTransition();

  function handleSignOutAll() {
    if (!confirm("Sair de TODOS os dispositivos? Você precisará fazer login de novo.")) return;
    startSignOut(async () => {
      await signOutEverywhere();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="space-y-3 p-6">
        <h2 className="text-sm font-semibold">Sessões ativas</h2>
        <p className="text-xs text-muted-foreground">
          Listagem de sessões — em breve. Por enquanto, deslogue todos os dispositivos:
        </p>
        <Button
          variant="outline"
          disabled={isSigningOut}
          onClick={handleSignOutAll}
        >
          {isSigningOut ? "Saindo…" : "Sair de todos os dispositivos"}
        </Button>
      </Card>
    </div>
  );
}
