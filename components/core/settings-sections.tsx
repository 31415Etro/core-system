"use client"

import type { LucideIcon } from "lucide-react"
import { Building, Cloud, Construction, Database, Github, HardDrive, KeyRound, Mail, Plug, Server, ShieldCheck, Sparkles, Triangle, UsersRound, Video } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CardHeader, GlassCard, IconTile } from "@/components/core/glass-card"
import { phaseLabel, PlannedButton } from "@/components/core/planned-module"
import { StatusBadge } from "@/components/core/status-badge"
import { EmptyState } from "@/components/core/states"

export const SETTINGS_TABS = ["geral", "empresa", "usuarios", "integracoes", "infraestrutura", "seguranca"] as const
export type SettingsTab = (typeof SETTINGS_TABS)[number]

function Planned({ icon, title, phase, text }: { icon: LucideIcon; title: string; phase: number | null; text: string }) {
  return <EmptyState icon={icon} title={`${title} — ${phaseLabel(phase)}`} description={text} className="border-white/[0.06] py-12" />
}

/** Geral: visão do que está configurado em cada área. */
export function GeneralSettings({ users, onGo }: { users: number; onGo: (tab: SettingsTab) => void }) {
  const supabaseOn = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const items: { tab: SettingsTab; icon: LucideIcon; title: string; text: string; status: React.ReactNode }[] = [
    { tab: "empresa", icon: Building, title: "Empresa", text: "Dados usados em propostas e contratos.", status: <StatusBadge tone="neutral">{phaseLabel(4)}</StatusBadge> },
    { tab: "usuarios", icon: UsersRound, title: "Usuários", text: `${users} usuários com acesso.`, status: <StatusBadge tone="success">Ativo</StatusBadge> },
    { tab: "integracoes", icon: Plug, title: "Integrações", text: "Chaves de API, Supabase, GitHub, Vercel, Anthropic...", status: <StatusBadge tone={supabaseOn ? "success" : "warning"}>{supabaseOn ? "Supabase conectado" : "Supabase não configurado"}</StatusBadge> },
    { tab: "infraestrutura", icon: Server, title: "Infraestrutura", text: "Servidores, credenciais SSH, deploy padrão e backups.", status: <StatusBadge tone="neutral">{phaseLabel(5)}</StatusBadge> },
    { tab: "seguranca", icon: ShieldCheck, title: "Segurança", text: "Auditoria de ações críticas e políticas de acesso.", status: <StatusBadge tone="neutral">{phaseLabel(5)}</StatusBadge> },
  ]
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((i) => (
        <button key={i.tab} type="button" onClick={() => onGo(i.tab)} className="glass interactive-lift flex flex-col gap-3 rounded-[20px] p-5 text-left focus-visible:outline-2 focus-visible:outline-ring">
          <div className="flex items-start justify-between gap-3"><IconTile icon={i.icon} />{i.status}</div>
          <div><p className="font-semibold tracking-tight text-foreground">{i.title}</p><p className="mt-1 text-sm text-muted-foreground">{i.text}</p></div>
        </button>
      ))}
    </div>
  )
}

export function CompanySettings() {
  return (
    <GlassCard>
      <Planned icon={Building} title="Dados da empresa" phase={4} text="Razão social, CNPJ, endereço, logo e assinatura usados automaticamente nas propostas e nos contratos." />
    </GlassCard>
  )
}

const INTEGRATIONS: { icon: LucideIcon; name: string; use: string; phase: number }[] = [
  { icon: Github, name: "GitHub", use: "Criar repositórios das demos a partir dos modelos", phase: 3 },
  { icon: Triangle, name: "Vercel", use: "Publicar demos e acompanhar builds", phase: 3 },
  { icon: Sparkles, name: "Anthropic (Claude)", use: "Resumo de reuniões, tarefas, propostas e conteúdo", phase: 2 },
  { icon: Video, name: "Google Meet", use: "Reuniões gravadas pela extensão CORE Meet", phase: 2 },
  { icon: Mail, name: "E-mail", use: "Envio de propostas, contratos e notificações", phase: 4 },
]

/** Catálogo de integrações da CORE (acima das chaves de API já existentes). */
export function IntegrationsCatalog() {
  const supabaseOn = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <GlassCard className="flex items-start gap-3 p-4">
        <IconTile icon={Database} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2"><p className="font-medium text-foreground">Supabase</p><StatusBadge tone={supabaseOn ? "success" : "warning"}>{supabaseOn ? "Conectado" : "Não configurado"}</StatusBadge></div>
          <p className="mt-1 text-xs text-muted-foreground">Banco, autenticação e storage da CORE. Configurado por variáveis de ambiente do servidor.</p>
        </div>
      </GlassCard>
      {INTEGRATIONS.map((i) => (
        <GlassCard key={i.name} className="flex items-start gap-3 p-4">
          <IconTile icon={i.icon} tone="neutral" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2"><p className="font-medium text-foreground">{i.name}</p><StatusBadge tone="neutral">{phaseLabel(i.phase)}</StatusBadge></div>
            <p className="mt-1 text-xs text-muted-foreground">{i.use}</p>
          </div>
        </GlassCard>
      ))}
    </div>
  )
}

/** Infraestrutura: servidores/VPS ficam aqui (não na sidebar). */
export function InfrastructureSettings() {
  const tabs = [
    { id: "servidores", label: "Servidores", icon: Server, text: "Nome, cliente, provider, IP, hostname, porta e usuário SSH, com “Testar conexão” (SO, CPU, RAM, disco, Docker, Git, portas)." },
    { id: "credenciais", label: "Credenciais", icon: KeyRound, text: "Chave SSH como método preferencial. Senhas e chaves criptografadas em cofre de segredos, nunca em texto puro nem em logs; permitir revogar e rotacionar." },
    { id: "deploy", label: "Deploy padrão", icon: Cloud, text: "Configuração padrão de produção: Docker, Supabase self-hosted, proxy, domínio e SSL. Jobs executados por um runner no backend — nunca SSH pelo navegador." },
    { id: "backups", label: "Backups", icon: HardDrive, text: "Backup diário do banco e de arquivos com retenção de 7, 15, 30 ou 90 dias, e snapshots para rollback." },
  ]
  return (
    <Tabs defaultValue="servidores" className="gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList aria-label="Infraestrutura">{tabs.map((t) => <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>)}</TabsList>
        <PlannedButton label="Cadastrar servidor" phase={5} />
      </div>
      {tabs.map((t) => (
        <TabsContent key={t.id} value={t.id}>
          <GlassCard><Planned icon={t.icon} title={t.label} phase={5} text={t.text} /></GlassCard>
        </TabsContent>
      ))}
    </Tabs>
  )
}

export function SecuritySettings() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <GlassCard className="space-y-3">
        <CardHeader icon={ShieldCheck} title="Permissões por página" description="Já ativo: cada usuário acessa só as páginas liberadas em Usuários." />
        <StatusBadge tone="success">Ativo</StatusBadge>
      </GlassCard>
      <GlassCard>
        <Planned icon={Construction} title="Auditoria" phase={5} text="Registro de usuário, IP, data, ação e objeto para deploys, servidores, contratos, financeiro, exclusões e mudanças de permissão." />
      </GlassCard>
    </div>
  )
}
