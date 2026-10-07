"use client"

import { useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"

/**
 * Reage a um parâmetro da URL (deep links do "+ Novo" e da command palette,
 * ex.: ?novo=1, ?cliente=<id>) e o remove da barra de endereço em seguida.
 * Funciona também quando a navegação acontece com a página já aberta.
 */
export function useQueryParam(name: string, onValue: (value: string) => void, { keep = false }: { keep?: boolean } = {}) {
  const searchParams = useSearchParams()
  const value = searchParams.get(name)
  const callback = useRef(onValue)
  callback.current = onValue
  const previous = useRef<string | null>(null)

  useEffect(() => {
    const before = previous.current
    previous.current = value
    if (value === null) {
      // Com keep, o parâmetro saindo da URL também é uma mudança (ex.: voltar de "Receitas" para o financeiro geral).
      if (keep && before !== null) callback.current("")
      return
    }
    callback.current(value)
    if (keep) return // filtros navegáveis (ex.: ?tipo=income) ficam na URL para o menu destacar o item certo
    const url = new URL(window.location.href)
    url.searchParams.delete(name)
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash)
  }, [name, value, keep])
}
