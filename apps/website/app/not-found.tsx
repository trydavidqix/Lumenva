import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <section className="statePage" aria-labelledby="not-found-title">
      <div className="site-shell statePageInner">
        <p className="stateEyebrow">404</p>
        <h1 className="stateTitle" id="not-found-title">
          Página não encontrada
        </h1>
        <p className="stateDescription">
          O endereço que procurava não está disponível.
        </p>
        <div className="stateActions">
          <Button href="/" variant="secondary">
            Voltar ao início
          </Button>
        </div>
      </div>
    </section>
  );
}
