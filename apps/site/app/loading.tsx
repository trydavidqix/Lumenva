export default function Loading() {
  return (
    <section className="statePage" aria-busy="true" aria-live="polite">
      <div className="site-shell statePageInner">
        <p className="stateEyebrow">Lumenva</p>
        <p className="stateLoading">A carregar…</p>
      </div>
    </section>
  );
}
