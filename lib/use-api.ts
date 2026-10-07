"use client"

import { useCallback, useEffect, useState } from "react"

// Cache em memória por URL: topbar, command palette e dashboard leem os mesmos
// endpoints (/api/tasks, /api/clients...) e não devem disparar requisições repetidas.
const TTL_MS = 15_000
const cache = new Map<string, { at: number; promise: Promise<unknown> }>()

export function fetchCached<T>(url: string, { force = false } = {}): Promise<T> {
  const hit = cache.get(url)
  if (!force && hit && Date.now() - hit.at < TTL_MS) return hit.promise as Promise<T>
  const promise = fetch(url, { cache: "no-store" }).then(async (response) => {
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload?.error || `Erro ao carregar ${url}`)
    return payload as T
  })
  cache.set(url, { at: Date.now(), promise })
  promise.catch(() => cache.delete(url))
  return promise
}

export function invalidateApi(prefix: string) {
  for (const key of cache.keys()) if (key.startsWith(prefix)) cache.delete(key)
}

export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(Boolean(url))

  const load = useCallback(
    (force = false) => {
      if (!url) return () => {}
      let cancelled = false
      setLoading(true)
      setError(null)
      fetchCached<T>(url, { force })
        .then((payload) => { if (!cancelled) setData(payload) })
        .catch((err: Error) => { if (!cancelled) setError(err.message) })
        .finally(() => { if (!cancelled) setLoading(false) })
      return () => { cancelled = true }
    },
    [url],
  )

  useEffect(() => load(), [load])

  return { data, error, loading, reload: () => load(true) }
}
