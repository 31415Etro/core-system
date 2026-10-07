"use client"

import { useEffect, useRef, useState } from "react"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/core/overlays"
import { ErrorState, Skeleton } from "@/components/core/states"
import { apiJson } from "@/components/meetings/shared"
import { cn } from "@/lib/utils"

type Part = { index: number; start: number; duration: number | null; bytes: number | null; url: string | null }

const clock = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60)
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
}

/** Player do vídeo da reunião: as partes de ~5 min tocam em sequência, como um vídeo só. */
export function VideoModal({ meetingId, title, open, onOpenChange }: { meetingId: string; title: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [parts, setParts] = useState<Part[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [current, setCurrent] = useState(0)
  const video = useRef<HTMLVideoElement>(null)
  const autoplay = useRef(false)

  useEffect(() => {
    if (!open) return
    setParts(null)
    setError(null)
    setCurrent(0)
    autoplay.current = false
    apiJson<{ parts: Part[] }>(`/api/meetings/${meetingId}/video`).then((d) => setParts(d.parts.filter((p) => p.url)), (e) => setError(e instanceof Error ? e.message : "Erro"))
  }, [open, meetingId])

  // Ao trocar de parte, continua tocando se já estava tocando.
  useEffect(() => {
    if (autoplay.current) video.current?.play().catch(() => {})
  }, [current])

  const part = parts?.[current]
  const total = parts?.reduce((s, p) => s + (p.duration ?? 0), 0) ?? 0

  return (
    <Modal size="xl" open={open} onOpenChange={onOpenChange} title="Vídeo da reunião" description={title}>
      {error ? <ErrorState message={error} /> : !parts ? <Skeleton className="aspect-video w-full rounded-2xl" /> : !parts.length ? <ErrorState message="Nenhuma parte do vídeo disponível." /> : (
        <div className="space-y-3">
          <video
            key={part!.url}
            ref={video}
            src={part!.url!}
            controls
            playsInline
            preload="metadata"
            className="aspect-video w-full rounded-2xl border border-white/[0.08] bg-black"
            onPlay={() => { autoplay.current = true }}
            onEnded={() => { if (current < parts.length - 1) setCurrent(current + 1) }}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-subtle">
            <span>Parte {current + 1} de {parts.length}{part!.duration ? ` · começa em ${clock(part!.start)}` : ""}{total ? ` · duração total ${clock(total)}` : ""}</span>
            <Button variant="ghost" size="sm" asChild><a href={part!.url!} download={`reuniao-parte-${current + 1}.webm`}><Download /> Baixar esta parte</a></Button>
          </div>
          {parts.length > 1 && (
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Partes do vídeo">
              {parts.map((p, i) => (
                <button key={p.index} type="button" role="tab" aria-selected={i === current} onClick={() => setCurrent(i)}
                  className={cn("rounded-lg border px-2.5 py-1 text-xs tabular-nums transition-colors", i === current ? "border-[var(--core-yellow-border)] bg-[var(--core-yellow-tint)] text-foreground" : "border-white/[0.08] text-muted-foreground hover:text-foreground")}>
                  {clock(p.start)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
