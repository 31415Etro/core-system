"use client"

import Link from "next/link"
import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, Building2, FileText, Mail, Phone, ShieldCheck, WalletCards } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CardHeader, GlassCard, IconTile } from "@/components/core/glass-card"
import { DetailItem } from "@/components/core/overlays"
import { PageContainer } from "@/components/core/page-header"
import { StatusBadge } from "@/components/core/status-badge"
import { ErrorState, Skeleton } from "@/components/core/states"
import { DocumentsTab } from "@/components/clients/documents-tab"
import { VaultTab } from "@/components/clients/vault-tab"
import { LinkedMeetings } from "@/components/meetings/linked-meetings"
import { FinancialsTab } from "@/components/it/clients-vault"
import { PageLayout } from "@/components/page-layout"
import { brl } from "@/lib/it-service-data"
import { useApi } from "@/lib/use-api"
import { useQueryParam } from "@/lib/use-query-param"

type ClientDetail = {
  id: string; name: string; legal_name: string | null; document: string | null; email: string | null; phone: string | null
  contact_name: string | null; contact_phone: string | null; contact_email: string | null; notes: string | null; status: string; created_at: string
  support_contracts?: { plan_name: string | null; monthly_value: number | null; due_day: number | null }[]
}

const TABS = ["visao", "cofre", "documentos", "reunioes", "financeiro"] as const
type Tab = (typeof TABS)[number]

export function ClientPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data, error, reload } = useApi<{ client: ClientDetail }>(`/api/clients/${id}`)
  const [tab, setTab] = useState<Tab>("visao")
  useQueryParam("aba", (v) => setTab((TABS as readonly string[]).includes(v) ? (v as Tab) : "visao"), { keep: true })

  function go(next: string) {
    setTab(next as Tab)
    router.replace(next === "visao" ? `/clientes-obras/${id}` : `/clientes-obras/${id}?aba=${next}`, { scroll: false })
  }

  if (error) {
    return <PageLayout><PageContainer><ErrorState message={error.includes("não encontrado") ? "Cliente não encontrado." : "Não foi possível carregar o cliente."} onRetry={reload} /><Button variant="ghost" asChild><Link href="/clientes-obras"><ArrowLeft /> Voltar para clientes</Link></Button></PageContainer></PageLayout>
  }
  const client = data?.client
  if (!client) {
    return <PageLayout><PageContainer><Skeleton className="h-28 rounded-[20px]" /><Skeleton className="h-64 rounded-[20px]" /></PageContainer></PageLayout>
  }

  const plan = client.support_contracts?.[0]
  const initials = client.name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()

  return (
    <PageLayout>
      <PageContainer>
        <Link href="/clientes-obras" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="size-4" /> Clientes</Link>

        <GlassCard className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-base font-semibold text-primary">{initials}</span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-[26px] font-semibold leading-tight tracking-tight">{client.name}</h1>
                <StatusBadge tone={client.status === "active" ? "success" : "neutral"}>{client.status === "active" ? "Ativo" : client.status === "prospect" ? "Prospect" : "Inativo"}</StatusBadge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{[client.legal_name, client.document].filter(Boolean).join(" · ") || "Sem razão social cadastrada"}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {client.email && <Button variant="outline" size="icon" asChild><a href={`mailto:${client.email}`} aria-label="Enviar e-mail"><Mail /></a></Button>}
            {client.phone && <Button variant="outline" size="icon" asChild><a href={`tel:${client.phone.replace(/\D/g, "")}`} aria-label="Ligar"><Phone /></a></Button>}
            <Button variant="outline" onClick={() => go("documentos")}><FileText /> Contratos</Button>
            <Button onClick={() => go("cofre")}><ShieldCheck /> Cofre de senhas</Button>
          </div>
        </GlassCard>

        <Tabs value={tab} onValueChange={go}>
          <TabsList aria-label="Seções do cliente">
            <TabsTrigger value="visao">Visão geral</TabsTrigger>
            <TabsTrigger value="cofre">Cofre de senhas</TabsTrigger>
            <TabsTrigger value="documentos">Contratos e documentos</TabsTrigger>
            <TabsTrigger value="reunioes">Reuniões</TabsTrigger>
            <TabsTrigger value="financeiro">Financeiro do projeto</TabsTrigger>
          </TabsList>

          <TabsContent value="visao" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div className="space-y-4">
                <GlassCard className="space-y-5">
                  <CardHeader icon={Building2} title="Dados cadastrais" />
                  <dl className="grid gap-5 sm:grid-cols-2">
                    <DetailItem label="Nome fantasia">{client.name}</DetailItem>
                    <DetailItem label="Razão social">{client.legal_name || "—"}</DetailItem>
                    <DetailItem label="CNPJ">{client.document || "—"}</DetailItem>
                    <DetailItem label="Cliente desde">{new Date(client.created_at).toLocaleDateString("pt-BR")}</DetailItem>
                    <DetailItem label="E-mail">{client.email ? <a href={`mailto:${client.email}`} className="text-primary hover:underline">{client.email}</a> : "—"}</DetailItem>
                    <DetailItem label="Telefone">{client.phone || "—"}</DetailItem>
                  </dl>
                  {(client.contact_name || client.contact_phone || client.contact_email) && (
                    <div className="border-t border-white/[0.06] pt-4">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-subtle">Contato principal</p>
                      <dl className="grid gap-5 sm:grid-cols-3">
                        <DetailItem label="Nome">{client.contact_name || "—"}</DetailItem>
                        <DetailItem label="Telefone">{client.contact_phone || "—"}</DetailItem>
                        <DetailItem label="E-mail">{client.contact_email || "—"}</DetailItem>
                      </dl>
                    </div>
                  )}
                  {client.notes && <div className="border-t border-white/[0.06] pt-4"><p className="mb-1.5 text-xs text-subtle">Observações</p><p className="whitespace-pre-wrap text-sm text-zinc-300">{client.notes}</p></div>}
                </GlassCard>
              </div>

              <div className="space-y-4">
                <GlassCard className="space-y-4">
                  <CardHeader icon={WalletCards} title="Plano de suporte" />
                  <dl className="grid grid-cols-2 gap-4">
                    <div className="col-span-2"><DetailItem label="Plano">{plan?.plan_name ?? "Sem plano recorrente"}</DetailItem></div>
                    <DetailItem label="Mensalidade">{plan?.monthly_value ? brl(plan.monthly_value) : "—"}</DetailItem>
                    <DetailItem label="Vencimento">{plan?.due_day ? `Dia ${plan.due_day}` : "—"}</DetailItem>
                  </dl>
                </GlassCard>
                {[
                  { tab: "cofre", icon: ShieldCheck, title: "Cofre de senhas", text: "Computadores, servidores, redes, e-mails e sistemas." },
                  { tab: "documentos", icon: FileText, title: "Contratos e documentos", text: "Contrato assinado, aditivos e outros PDFs." },
                ].map((s) => (
                  <button key={s.tab} type="button" onClick={() => go(s.tab)} className="glass interactive-lift flex w-full items-center gap-3 rounded-[20px] p-4 text-left focus-visible:outline-2 focus-visible:outline-ring">
                    <IconTile icon={s.icon} />
                    <span className="min-w-0 flex-1"><span className="block font-medium text-foreground">{s.title}</span><span className="block text-xs text-muted-foreground">{s.text}</span></span>
                    <ArrowRight className="size-4 text-subtle" />
                  </button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="cofre" className="mt-4"><VaultTab clientId={client.id} clientName={client.name} /></TabsContent>
          <TabsContent value="documentos" className="mt-4"><DocumentsTab clientId={client.id} clientName={client.name} /></TabsContent>
          <TabsContent value="reunioes" className="mt-4 space-y-4"><LinkedMeetings clientId={client.id} view="reunioes" /><LinkedMeetings clientId={client.id} view="pendencias" /></TabsContent>
          <TabsContent value="financeiro" className="mt-4"><GlassCard><FinancialsTab client={client} /></GlassCard></TabsContent>
        </Tabs>
      </PageContainer>
    </PageLayout>
  )
}
