'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import type { PublishingStatusItem } from '../lib/publishing/status-data'

export function PublishStatusCard({ item }: { item: PublishingStatusItem }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function retry() {
    setBusy(true)
    setError(null)

    try {
      const response = await fetch(`/api/publishing/${item.id}/retry`, { method: 'POST' })
      const result = (await response.json()) as { ok: boolean; code?: string }
      if (!response.ok || !result.ok) {
        setError(result.code ?? 'publish_retry_failed')
        return
      }
      router.refresh()
    } catch {
      setError('publish_retry_failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <article style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16, display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <strong>{item.topic}</strong>
          <div style={{ fontSize: 13, opacity: 0.75 }}>
            {item.platform} · {item.accountName ?? 'Conta ligada'}
          </div>
        </div>
        <strong>{humanStatus(item.status)}</strong>
      </div>

      {item.scheduledFor ? (
        <div>Horário: {new Date(item.scheduledFor).toLocaleString('pt-PT')}</div>
      ) : null}
      {item.publishedAt ? (
        <div>Publicado: {new Date(item.publishedAt).toLocaleString('pt-PT')}</div>
      ) : null}
      <div>Tentativas: {item.attemptCount}</div>

      {item.externalUrl ? (
        <a href={item.externalUrl} target="_blank" rel="noreferrer">Abrir publicação</a>
      ) : item.externalPostId ? (
        <div>ID externo: {item.externalPostId}</div>
      ) : null}

      {item.errorSummary ? <p role="status">{item.errorSummary}</p> : null}

      {item.retryEligible ? (
        <button
          type="button"
          onClick={() => void retry()}
          disabled={busy}
          style={{ width: 'fit-content', padding: '8px 14px', cursor: 'pointer' }}
        >
          {busy ? 'A tentar novamente…' : 'Tentar novamente'}
        </button>
      ) : null}

      {error ? <p role="alert">Não foi possível iniciar o retry: {error}</p> : null}
    </article>
  )
}

function humanStatus(status: string): string {
  switch (status) {
    case 'queued':
      return 'Na fila'
    case 'scheduled':
      return 'Agendado'
    case 'publishing':
      return 'A publicar'
    case 'published':
      return 'Publicado'
    case 'retrying':
      return 'A tentar novamente'
    case 'reconcile_required':
    case 'unknown':
      return 'A confirmar estado'
    case 'failed':
      return 'Falhou'
    case 'cancelled':
      return 'Cancelado'
    default:
      return 'Estado desconhecido'
  }
}
