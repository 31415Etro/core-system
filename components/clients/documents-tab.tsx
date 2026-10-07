"use client"

import { useCallback, useEffect, useState } from "react"
import { Database, Download, ExternalLink, FileText, Loader2, Paperclip, Search, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CardHeader, GlassCard } from "@/components/core/glass-card"
import { InputField, SelectField, TextareaField } from "@/components/core/form-fields"
import { notify } from "@/components/core/notify"
import { Modal } from "@/components/core/overlays"
import { StatusBadge, type StatusTone } from "@/components/core/status-badge"
import { EmptyState, ErrorState, Skeleton } from "@/components/core/states"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type ClientDocument = {
  id: string; category: string; title: string; file_name: string | null; file_size_bytes?: number | null
  signed_at?: string | null; notes?: string | null; created_at: string | null; legacy?: boolean
}

const CATEGORIES: Record<string, { label: string; tone: StatusTone }> = {
  contrato: { label: "Contrato", tone: "primary" },
  aditivo: { label: "Aditivo", tone: "warning" },
  proposta: { label: "Proposta", tone: "info" },
  nota_fiscal: { label: "Nota fiscal", tone: "success" },
  documento: { label: "Documento", tone: "neutral" },
  outro: { label: "Outro", tone: "neutral" },
}
const MAX_BYTES = 50 * 1024 * 1024
const fmtDate = (iso: string | null | undefined) => (iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("pt-BR") : "—")
const fmtSize = (b: number | null | undefined) => (!b ? "" : b > 1024 * 1024 ? `${(b / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

function UploadModal({ clientId, open, onOpenChange, onUploaded }: { clientId: string; open: boolean; onOpenChange: (o: boolean) => void; onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("contrato")
  const [signedAt, setSignedAt] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<"idle" | "upload" | "save">("idle")

  useEffect(() => { if (open) { setFile(null); setTitle(""); setCategory("contrato"); setSignedAt(""); setNotes(""); setError(null); setStep("idle") } }, [open])

  function pick(f: File | undefined) {
    if (!f) return
    if (f.type !== "application/pdf") { setError("Envie um arquivo PDF."); return }
    if (f.size > MAX_BYTES) { setError("O arquivo deve ter até 50 MB."); return }
    setError(null)
    setFile(f)
    if (!title) setTitle(f.name.replace(/\.pdf$/i, "").replace(/[-_]+/g, " "))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !title.trim()) return
    try {
      // O PDF vai direto do navegador para o Storage (URL assinada): a Vercel limita requisições a 4,5 MB.
      setStep("upload")
      const urlResponse = await fetch(`/api/clients/${clientId}/financials/upload-url`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "documento", file_name: file.name }) })
      const target = await urlResponse.json().catch(() => ({}))
      if (!urlResponse.ok) throw new Error(target.error || "Erro ao preparar o envio")
      const { error: uploadError } = await createClient().storage.from(target.bucket).uploadToSignedUrl(target.path, target.token, file, { contentType: "application/pdf" })
      if (uploadError) throw new Error(uploadError.message)

      setStep("save")
      const response = await fetch(`/api/clients/${clientId}/documents`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storage_path: target.path, file_name: file.name, file_size_bytes: file.size, title, category, signed_at: signedAt || null, notes }) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Erro ao registrar o documento")

      notify.success("Documento anexado", title)
      onUploaded()
      onOpenChange(false)
    } catch (err) {
      notify.error("Não foi possível anexar", err instanceof Error ? err.message : undefined)
    } finally {
      setStep("idle")
    }
  }

  const busy = step !== "idle"
  return (
    <Modal size="lg" open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o) }} title="Anexar documento" description="PDF de até 50 MB, guardado em armazenamento privado. Só usuários do sistema conseguem abrir.">
      <form onSubmit={submit} className="space-y-5">
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]) }}
          className={cn("flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed px-6 py-8 text-center transition-colors", file ? "border-primary/40 bg-primary/[0.04]" : "border-white/15 bg-white/[0.02] hover:border-primary/40 hover:bg-primary/[0.03]")}
        >
          {file ? <FileText className="size-7 text-primary" /> : <Upload className="size-7 text-subtle" />}
          <span className="text-sm font-medium text-foreground">{file ? file.name : "Arraste o PDF aqui ou clique para escolher"}</span>
          <span className="text-xs text-subtle">{file ? fmtSize(file.size) : "Somente PDF · até 50 MB"}</span>
          <input type="file" accept="application/pdf" className="sr-only" disabled={busy} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = "" }} />
        </label>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

        <div className="grid gap-4 sm:grid-cols-2">
          <InputField label="Título" required fieldClassName="sm:col-span-2" placeholder="Ex.: Contrato de prestação de serviços 2026" value={title} onChange={(e) => setTitle(e.target.value)} />
          <SelectField label="Categoria" value={category} onValueChange={setCategory} options={Object.entries(CATEGORIES).map(([value, c]) => ({ value, label: c.label }))} />
          <InputField label="Data de assinatura" type="date" helper="Opcional" value={signedAt} onChange={(e) => setSignedAt(e.target.value)} />
          <TextareaField label="Observações" fieldClassName="sm:col-span-2" placeholder="Vigência, reajuste, aditivos relacionados..." value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" disabled={!file || !title.trim() || busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Paperclip />}
            {step === "upload" ? "Enviando arquivo..." : step === "save" ? "Registrando..." : "Anexar documento"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export function DocumentsTab({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [documents, setDocuments] = useState<ClientDocument[] | null>(null)
  const [installed, setInstalled] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("all")
  const [uploadOpen, setUploadOpen] = useState(false)
  const [deleting, setDeleting] = useState<ClientDocument | null>(null)
  const [opening, setOpening] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const response = await fetch(`/api/clients/${clientId}/documents`, { cache: "no-store" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Erro ao carregar documentos")
      setInstalled(payload.installed !== false)
      setDocuments([...(payload.documents ?? []), ...(payload.legacy ?? [])])
    } catch (err) {
      setDocuments([])
      setError(err instanceof Error ? err.message : "Erro ao carregar documentos")
    }
  }, [clientId])

  useEffect(() => { load() }, [load])

  async function open(doc: ClientDocument, download = false) {
    setOpening(doc.id + (download ? "-d" : ""))
    // Abre a aba antes do await para o navegador não bloquear o pop-up.
    const win = download ? null : window.open("about:blank", "_blank")
    try {
      const response = await fetch(`/api/clients/${clientId}/documents/${doc.id}${download ? "?download=1" : ""}`, { cache: "no-store" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Erro ao abrir o documento")
      if (win) win.location.href = payload.url
      else window.location.href = payload.url
    } catch (err) {
      win?.close()
      notify.error("Não foi possível abrir", err instanceof Error ? err.message : undefined)
    } finally {
      setOpening(null)
    }
  }

  async function remove() {
    const doc = deleting!
    setDeleting(null)
    try {
      const response = await fetch(`/api/clients/${clientId}/documents/${doc.id}`, { method: "DELETE" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Erro ao excluir")
      notify.success("Documento excluído", doc.title)
      load()
    } catch (err) {
      notify.error("Não foi possível excluir", err instanceof Error ? err.message : undefined)
    }
  }

  const items = (documents ?? []).filter((d) => (category === "all" || d.category === category) && `${d.title} ${d.file_name ?? ""} ${d.notes ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()))
  const contracts = (documents ?? []).filter((d) => d.category === "contrato").length

  return (
    <div className="space-y-4">
      <GlassCard className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <CardHeader icon={FileText} title="Contratos e documentos" description={`PDFs de ${clientName}: contratos, aditivos, propostas e notas. Armazenamento privado.`} />
        {installed && <Button onClick={() => setUploadOpen(true)} className="shrink-0"><Upload /> Anexar PDF</Button>}
      </GlassCard>

      {!installed && (
        <GlassCard><EmptyState icon={Database} title="Documentos ainda não instalados" description="Execute o script 220_client_vault_documents.sql no Supabase para anexar vários PDFs por cliente. O contrato do Financeiro do projeto continua disponível abaixo." className="border-white/[0.06] py-8" /></GlassCard>
      )}

      {documents === null ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <>
          {documents.length > 0 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar documento..." aria-label="Buscar documento" className="h-10 pl-10" />
              </div>
              <div className="flex flex-wrap gap-2">
                {["all", ...Object.keys(CATEGORIES).filter((c) => documents.some((d) => d.category === c))].map((c) => (
                  <button key={c} type="button" onClick={() => setCategory(c)}
                    className={cn("rounded-full border px-3 py-1 text-xs transition-colors", category === c ? "border-[var(--core-yellow-border)] bg-[var(--core-yellow-tint)] text-foreground" : "border-white/[0.08] text-muted-foreground hover:text-foreground")}>
                    {c === "all" ? `Todos (${documents.length})` : `${CATEGORIES[c].label} (${documents.filter((d) => d.category === c).length})`}
                  </button>
                ))}
              </div>
              <p className="text-xs text-subtle sm:ml-auto">{contracts} {contracts === 1 ? "contrato" : "contratos"}</p>
            </div>
          )}

          {items.length ? (
            <GlassCard padded={false} className="overflow-hidden">
              <ul className="divide-y divide-white/[0.06]">
                {items.map((d) => {
                  const cat = CATEGORIES[d.category] ?? CATEGORIES.outro
                  return (
                    <li key={d.id} className="flex flex-col gap-3 p-4 transition-colors hover:bg-white/[0.02] sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-red-400/20 bg-red-400/10 text-[10px] font-bold text-red-300">PDF</span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-medium text-foreground">{d.title}</p>
                            <StatusBadge tone={cat.tone} dot={false}>{cat.label}</StatusBadge>
                            {d.legacy && <span className="text-[11px] text-subtle">· Financeiro do projeto</span>}
                          </div>
                          <p className="truncate text-xs text-subtle">
                            {[d.file_name, fmtSize(d.file_size_bytes), d.signed_at && `assinado em ${fmtDate(d.signed_at)}`, d.created_at && `enviado em ${fmtDate(d.created_at)}`].filter(Boolean).join(" · ")}
                          </p>
                          {d.notes && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{d.notes}</p>}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button variant="outline" size="sm" onClick={() => open(d)} disabled={opening !== null}>{opening === d.id ? <Loader2 className="animate-spin" /> : <ExternalLink />} Abrir</Button>
                        <Button variant="outline" size="sm" onClick={() => open(d, true)} disabled={opening !== null} aria-label={`Baixar ${d.title}`}>{opening === `${d.id}-d` ? <Loader2 className="animate-spin" /> : <Download />}</Button>
                        {!d.legacy && <Button variant="ghost" size="sm" onClick={() => setDeleting(d)} className="text-red-400 hover:text-red-300" aria-label={`Excluir ${d.title}`} title="Excluir"><Trash2 /></Button>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </GlassCard>
          ) : (
            <GlassCard>
              <EmptyState icon={FileText} title={documents.length ? "Nenhum documento encontrado" : "Nenhum documento anexado"} description={documents.length ? "Tente outro termo ou categoria." : "Anexe o contrato assinado e outros PDFs para encontrá-los quando precisar."} action={!documents.length && installed ? <Button size="sm" onClick={() => setUploadOpen(true)}><Upload /> Anexar primeiro PDF</Button> : undefined} className="border-white/[0.06] py-12" />
            </GlassCard>
          )}
        </>
      )}

      <UploadModal clientId={clientId} open={uploadOpen} onOpenChange={setUploadOpen} onUploaded={load} />
      <Modal size="sm" open={Boolean(deleting)} onOpenChange={(o) => { if (!o) setDeleting(null) }} title="Excluir documento?" description={deleting ? `“${deleting.title}” será apagado definitivamente.` : undefined}
        footer={<><Button variant="outline" onClick={() => setDeleting(null)}>Cancelar</Button><Button variant="destructive" onClick={remove}>Excluir documento</Button></>} />
    </div>
  )
}
