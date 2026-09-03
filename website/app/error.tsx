"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";

interface GlobalErrorProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

export default function GlobalError({ reset }: GlobalErrorProps) {
  return (
    <section className="statePage" aria-labelledby="error-title">
      <div className="site-shell statePageInner">
        <p className="stateEyebrow">Erro</p>
        <h1 className="stateTitle" id="error-title">
          Algo correu mal
        </h1>
        <p className="stateDescription">
          Não foi possível carregar esta página. Tente novamente ou volte ao início.
        </p>
        <div className="stateActions">
          <Button onClick={reset} variant="secondary">
            Tentar de novo
          </Button>
          <Link className="stateLink" href="/">
            Ir para o início
          </Link>
        </div>
      </div>
    </section>
  );
}
