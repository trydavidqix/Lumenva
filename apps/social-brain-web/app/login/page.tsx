import { login } from './actions'

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const hasError = params.error === 'invalid'

  return (
    <main
      style={{
        fontFamily: 'sans-serif',
        maxWidth: 420,
        margin: '80px auto',
        padding: 24,
      }}
    >
      <p style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 12 }}>
        Lumenva Social Brain
      </p>
      <h1>Iniciar sessão</h1>
      <p>Acesso privado ao workspace interno.</p>

      {hasError ? (
        <p role="alert" style={{ marginTop: 20 }}>
          Não foi possível iniciar sessão com esses dados.
        </p>
      ) : null}

      <form action={login} style={{ display: 'grid', gap: 14, marginTop: 24 }}>
        <label>
          <span style={{ display: 'block', marginBottom: 6 }}>Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            style={{ width: '100%', boxSizing: 'border-box', padding: 10 }}
          />
        </label>

        <label>
          <span style={{ display: 'block', marginBottom: 6 }}>Palavra-passe</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            style={{ width: '100%', boxSizing: 'border-box', padding: 10 }}
          />
        </label>

        <button type="submit" style={{ padding: 11, cursor: 'pointer' }}>
          Entrar
        </button>
      </form>
    </main>
  )
}
