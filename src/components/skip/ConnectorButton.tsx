import { useEffect, useState } from 'react'

import {
  ConnectPopupBlockedError,
  connect,
  disconnect,
  listConnectors,
  type ConnectorStatus,
} from '../../lib/skipConnectors'

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** Connect / reconnect / disconnect one toolkit for the signed-in user. */
export function ConnectorButton({
  toolkit,
  name,
  className,
}: {
  toolkit: string
  name: string
  className?: string
}) {
  const [status, setStatus] = useState<ConnectorStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The consent page, when the browser blocked opening it: offered as a link.
  const [blockedUrl, setBlockedUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // Another toolkit: forget the previous one's status (the button stays
    // disabled until this one's arrives) so a click can't act on stale state.
    setStatus(null)
    setError(null)
    listConnectors()
      .then((all) => {
        if (!cancelled) setStatus(all.find((c) => c.toolkit === toolkit)?.status ?? null)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(errorText(e))
      })
    return () => {
      cancelled = true
    }
  }, [toolkit])

  // Back from the consent window (a framed app connects in a new one): refresh
  // the status in place, without resetting it, so the button shows the change.
  useEffect(() => {
    let cancelled = false
    const refresh = () => {
      listConnectors()
        .then((all) => {
          if (!cancelled) setStatus(all.find((c) => c.toolkit === toolkit)?.status ?? null)
        })
        .catch(() => {
          // The next click or load reports it; a background refresh must not.
        })
    }
    window.addEventListener('focus', refresh)
    // Broadcast connector state change so other components or pages react
    window.dispatchEvent(new CustomEvent('skip_connector_change', { detail: { toolkit, status } }))
    return () => {
      cancelled = true
      window.removeEventListener('focus', refresh)
    }
  }, [toolkit, status])
  const onClick = async () => {
    setBusy(true)
    setError(null)
    setBlockedUrl(null)
    try {
      if (status === 'connected') {
        await disconnect(toolkit)
        setStatus('not_connected')
        window.dispatchEvent(
          new CustomEvent('skip_connector_change', {
            detail: { toolkit, status: 'not_connected' },
          }),
        )
      } else {
        await connect(toolkit)
      }
    } catch (e: unknown) {
      if (e instanceof ConnectPopupBlockedError) setBlockedUrl(e.url)
      else setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const label = busy
    ? status === 'connected'
      ? 'Desconectando…'
      : 'Conectando…'
    : status === 'connected'
      ? `${name} conectado · Desconectar`
      : status === 'expired'
        ? `Reconectar ${name}`
        : `Conectar ${name}`

  return (
    <div className={className}>
      <button
        type="button"
        onClick={onClick}
        disabled={busy || status === null}
        aria-busy={busy}
        className={`inline-flex items-center justify-center rounded-md px-3 py-2 text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer ${
          status === 'connected'
            ? 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-300'
            : status === 'expired'
              ? 'border border-amber-300 bg-amber-500 text-white hover:bg-amber-600'
              : 'border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700'
        }`}
      >
        {label}
      </button>
      {blockedUrl && (
        <a
          href={blockedUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setBlockedUrl(null)}
          className="ml-2 text-sm underline"
        >
          Abrir página de conexão
        </a>
      )}
      {error && (
        <p role="alert" className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
