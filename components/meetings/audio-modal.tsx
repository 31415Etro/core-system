"use client"

import { useEffect, useState } from "react"
import { Mic, Users } from "lucide-react"
import { Modal } from "@/components/core/overlays"
import { ErrorState, Skeleton } from "@/components/core/states"
import { apiJson } from "@/components/meetings/shared"

type Part = { track: "mic" | "tab"; index: number; start: number; duration: number | null; url: string | null }

const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`

/** Player da gravação: cada parte de ~10 min tem duas faixas — você (microfone) e os participantes (som do Meet). */
export function AudioModal({ meetingId, title, open, onOpenChange }: { meetingId: string; title: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [parts, setParts] = useState<Part[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setParts(null)
    setError(null)
    apiJson<{ parts: Part[] }>(`/api/meetings/${meetingId}/audio`).then((d) => setParts(d.parts), (e) => setError(e instanceof Error ? e.message : "Erro"))
  }, [open, meetingId])

  const indexes = [...new Set((parts ?? []).map((p) => p.index))].sort((a, b) => a - b)

  return (
    <Modal size="lg" open={open} onOpenChange={onOpenChange} title="Gravação" description={title}>
      {error ? <ErrorState message={error} /> : !parts ? <Skeleton className="h-32" /> : (
        <ol className="space-y-4">
          {indexes.map((i) => {
            const group = parts.filter((p) => p.index === i)
            const start = group[0]?.start ?? 0
            const duration = group.find((p) => p.duration)?.duration
            return (
              <li key={i} className="space-y-2 rounded-2xl border border-white/[0.08] p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">Parte {i + 1} · {clock(start)}{duration ? `–${clock(start + duration)}` : ""}</p>
                {(["mic", "tab"] as const).map((track) => {
                  const p = group.find((x) => x.track === track)
                  if (!p?.url) return null
                  return (
                    <div key={track} className="flex items-center gap-3">
                      <span className="flex w-28 shrink-0 items-center gap-1.5 text-xs text-zinc-300">{track === "mic" ? <><Mic className="size-3.5 text-primary" /> Você</> : <><Users className="size-3.5 text-primary" /> Participantes</>}</span>
                      <audio controls preload="none" src={p.url} className="h-9 w-full" />
                    </div>
                  )
                })}
              </li>
            )
          })}
        </ol>
      )}
    </Modal>
  )
}
