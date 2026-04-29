"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { skipWhatsapp, markWhatsappConfigured } from "@/app/actions/onboarding/skipWhatsapp";

interface Props {
  wahaConfigured: boolean;
  sessionName: string;
}

export function ConnectWhatsappClient({ wahaConfigured, sessionName }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4 rounded-lg border bg-background p-6">
      {!wahaConfigured ? (
        <div className="rounded-md border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-medium">WAHA não está configurado.</p>
          <p className="mt-1">
            Suba o Docker (<code>docker compose up -d waha</code>) e recarregue, ou pule este passo
            agora — você pode configurar WhatsApp depois em <strong>Configurações → Canais</strong>.
          </p>
        </div>
      ) : (
        <div className="rounded-md border bg-muted/40 p-4 text-sm">
          <p className="font-medium">Sessão: {sessionName}</p>
          <p className="mt-1 text-muted-foreground">
            Geração do QR Code ainda exige o Docker em execução. Em ambientes E2E completos,
            o painel mostrará o QR e fará polling até <code>WORKING</code>.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => startTransition(() => void skipWhatsapp())}
        >
          Pular por enquanto
        </Button>
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                await markWhatsappConfigured(sessionName, "configured");
              } catch (err) {
                toast.error("Falha ao marcar passo. " + String(err));
              }
            })
          }
        >
          Já configurei (continuar)
        </Button>
      </div>
    </div>
  );
}
