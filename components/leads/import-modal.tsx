"use client"

import { useState } from "react"
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { notify } from "@/components/core/notify"
import { Modal } from "@/components/core/overlays"
import { invalidateApi } from "@/lib/use-api"

/** Colunas aceitas no CSV → campo do lead. Cabeçalhos são comparados sem acento e sem caixa. */
const COLUMN_MAP: Record<string, string> = {
  empresa: "company_name", nome: "company_name", company_name: "company_name", "nome fantasia": "company_name",
  contato: "contact_name", responsavel: "contact_name", email: "email", "e-mail": "email",
  telefone: "phone", fone: "phone", whatsapp: "whatsapp", celular: "whatsapp",
  cnpj: "cnpj", segmento: "segment", origem: "source", cidade: "city", valor: "estimated_value", "valor estimado": "estimated_value",
  observacoes: "notes", observacao: "notes",
}
const TEMPLATE = "empresa;contato;telefone;whatsapp;email;cnpj;segmento;origem;cidade;valor\nMineirão Climatização;Ana Paula;(47) 3333-0000;(47) 99999-0000;contato@mineirao.com.br;12.345.678/0001-10;Climatização;Indicação;Joinville;8900\n"

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase()

/** Parser CSV simples (aspas, ; ou , como separador). */
function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/)[0] ?? ""
  const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ","
  const rows: string[][] = []
  let row: string[] = [], cell = "", quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === sep) { row.push(cell); cell = "" }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++
      row.push(cell); cell = ""
      if (row.some((v) => v.trim())) rows.push(row)
      row = []
    } else cell += c
  }
  row.push(cell)
  if (row.some((v) => v.trim())) rows.push(row)
  return rows
}

export function ImportLeadsModal({ open, onOpenChange, onImported }: { open: boolean; onOpenChange: (open: boolean) => void; onImported: () => void }) {
  const [fileName, setFileName] = useState<string | null>(null)
  const [leads, setLeads] = useState<Record<string, string>[]>([])
  const [ignored, setIgnored] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function reset() { setFileName(null); setLeads([]); setIgnored([]); setError(null) }

  async function readFile(file: File) {
    reset()
    setFileName(file.name)
    const rows = parseCsv(await file.text())
    if (rows.length < 2) { setError("O arquivo precisa ter um cabeçalho e ao menos uma linha."); return }
    const header = rows[0].map((h) => COLUMN_MAP[norm(h)] ?? null)
    if (!header.includes("company_name")) { setError("Coluna “empresa” não encontrada no cabeçalho."); return }
    setIgnored(rows[0].filter((_, i) => !header[i]).map((h) => h.trim()).filter(Boolean))
    const parsed = rows.slice(1).map((r) => {
      const lead: Record<string, string> = {}
      header.forEach((field, i) => { if (field && r[i]?.trim()) lead[field] = r[i].trim() })
      if (lead.estimated_value) lead.estimated_value = String(Number(lead.estimated_value.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3})/g, "").replace(",", ".")) || 0)
      return lead
    }).filter((l) => l.company_name)
    if (!parsed.length) setError("Nenhuma linha com nome de empresa.")
    setLeads(parsed)
  }

  async function submit() {
    setSaving(true)
    try {
      const response = await fetch("/api/commercial-opportunities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leads }) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Erro ao importar")
      invalidateApi("/api/commercial-opportunities")
      notify.success("Importação concluída", `${payload.imported} leads importados como “Novo lead”`)
      onImported()
      onOpenChange(false)
      reset()
    } catch (err) {
      notify.error("Erro ao importar leads", err instanceof Error ? err.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob(["﻿" + TEMPLATE], { type: "text/csv;charset=utf-8" }))
    const a = document.createElement("a"); a.href = url; a.download = "modelo-leads.csv"; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <Modal
      size="lg"
      open={open}
      onOpenChange={(o) => { onOpenChange(o); if (!o) reset() }}
      title="Importar leads"
      description="Envie um CSV (separado por ; ou ,). Os leads entram no pipeline como “Novo lead”."
      footer={<>
        <Button variant="ghost" onClick={downloadTemplate} className="sm:mr-auto"><Download /> Baixar modelo</Button>
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
        <Button onClick={submit} disabled={!leads.length || saving}>{saving && <Loader2 className="animate-spin" />}Importar {leads.length || ""} leads</Button>
      </>}
    >
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-8 text-center transition-colors hover:border-primary/40 hover:bg-primary/[0.03]">
        {fileName ? <FileSpreadsheet className="size-6 text-primary" /> : <Upload className="size-6 text-subtle" />}
        <span className="text-sm font-medium text-foreground">{fileName ?? "Selecionar arquivo CSV"}</span>
        <span className="text-xs text-subtle">Colunas: empresa (obrigatória), contato, telefone, whatsapp, email, cnpj, segmento, origem, cidade, valor</span>
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = "" }} />
      </label>

      {error && <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3 text-sm text-red-300">{error}</p>}
      {ignored.length > 0 && <p className="text-xs text-subtle">Colunas ignoradas: {ignored.join(", ")}</p>}

      {leads.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border">
          <p className="border-b border-border bg-white/[0.02] px-3 py-2 text-xs text-muted-foreground">Prévia — {leads.length} linhas válidas</p>
          <ul className="divide-y divide-white/[0.05] text-sm">
            {leads.slice(0, 5).map((l, i) => (
              <li key={i} className="flex justify-between gap-3 px-3 py-2">
                <span className="truncate font-medium text-foreground">{l.company_name}</span>
                <span className="truncate text-xs text-subtle">{[l.contact_name, l.city, l.source].filter(Boolean).join(" · ")}</span>
              </li>
            ))}
          </ul>
          {leads.length > 5 && <p className="border-t border-border px-3 py-2 text-xs text-subtle">+ {leads.length - 5} linhas</p>}
        </div>
      )}
    </Modal>
  )
}
