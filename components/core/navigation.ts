import type { LucideIcon } from "lucide-react"
import {
  BarChart3, Building2, CalendarDays, CircleDollarSign, FileText, FolderKanban, LayoutDashboard, MonitorPlay, Plus,
  Settings, Target, TicketCheck, UserCog, UsersRound, Video, WandSparkles,
} from "lucide-react"
import type { PagePermission } from "@/lib/types"
import type { User } from "@/lib/auth-context"
import { moduleBySlug } from "@/lib/modules"

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  /** Sem permissão = qualquer usuário logado. */
  permission?: PagePermission
  keywords?: string
  /** Módulo ainda em construção: fase prevista (null = sem fase definida). */
  phase?: number | null
}
export type NavGroup = { label: string; items: NavItem[] }

const planned = (slug: string, icon: LucideIcon, permission?: PagePermission): NavItem => {
  const m = moduleBySlug(slug)!
  return { label: m.title, href: m.href, icon, permission, phase: m.phase }
}

/**
 * Sidebar: somente módulos principais. Funções internas (pipeline, prospecção, contratos,
 * GitHub, VPS, receitas...) vivem em abas, drawers e wizards dentro de cada módulo.
 */
export const navGroups: NavGroup[] = [
  {
    label: "Principal",
    items: [
      { label: "Dashboard", href: "/dashboard", permission: "dashboard", icon: LayoutDashboard, keywords: "visão geral início home" },
      { label: "Leads", href: "/leads", permission: "comercial", icon: Target, keywords: "pipeline funil prospecção oportunidades kanban" },
      { label: "Clientes", href: "/clientes-obras", permission: "clientes_obras", icon: Building2, keywords: "fornecedores cofre acessos contratos" },
      planned("projetos", FolderKanban),
      { label: "Tarefas", href: "/tickets", permission: "ordens_servico", icon: TicketCheck, keywords: "chamados kanban ordens de serviço tickets suporte" },
      planned("agenda", CalendarDays),
    ],
  },
  {
    label: "Comercial",
    items: [
      { label: "Reuniões", href: "/reunioes", icon: Video, keywords: "meet ata gravação ia transcrição pendências" },
      planned("demos", MonitorPlay, "comercial"),
      planned("propostas", FileText, "comercial"),
    ],
  },
  {
    label: "Conteúdo",
    items: [planned("conteudo-ia", WandSparkles)],
  },
  {
    label: "Financeiro",
    items: [{ label: "Financeiro", href: "/financeiro", permission: "financeiro", icon: CircleDollarSign, keywords: "receitas despesas contas a receber recorrências extrato" }],
  },
  {
    label: "Gestão",
    items: [planned("equipe", UsersRound), planned("relatorios", BarChart3)],
  },
  {
    label: "Sistema",
    items: [
      { label: "Usuários", href: "/configuracoes?aba=usuarios", permission: "configuracoes", icon: UserCog, keywords: "permissões acessos" },
      { label: "Configurações", href: "/configuracoes", permission: "configuracoes", icon: Settings, keywords: "integrações infraestrutura servidores segurança empresa" },
    ],
  },
]

export const allNavItems = navGroups.flatMap((g) => g.items)
export const liveNavItems = allNavItems

/** Permissão por prefixo de rota (inclui subrotas como /leads/[id]). */
const routePrefixes: { prefix: string; permission: PagePermission }[] = [
  { prefix: "/dashboard", permission: "dashboard" },
  { prefix: "/leads", permission: "comercial" },
  { prefix: "/demos", permission: "comercial" },
  { prefix: "/propostas", permission: "comercial" },
  { prefix: "/clientes-obras", permission: "clientes_obras" },
  { prefix: "/tickets", permission: "ordens_servico" },
  { prefix: "/financeiro", permission: "financeiro" },
  { prefix: "/configuracoes", permission: "configuracoes" },
]

export function permissionForPath(pathname: string): PagePermission | undefined {
  return routePrefixes.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`))?.permission
}

export type QuickAction = { label: string; href: string; permission: PagePermission; icon: LucideIcon }

/** Ações do botão "+ Novo" e da command palette. Abrem o formulário existente via ?novo=1. */
export const quickActions: QuickAction[] = [
  { label: "Novo lead", href: "/leads?novo=1", permission: "comercial", icon: Plus },
  { label: "Novo cliente", href: "/clientes-obras?novo=1", permission: "clientes_obras", icon: Plus },
  { label: "Nova tarefa", href: "/tickets?novo=1", permission: "ordens_servico", icon: Plus },
  { label: "Nova movimentação", href: "/financeiro?novo=1", permission: "financeiro", icon: Plus },
]

/** Atalhos da command palette para abas internas (não aparecem na sidebar). */
export const internalShortcuts: { label: string; href: string; permission?: PagePermission; keywords: string }[] = [
  { label: "Leads › Pipeline", href: "/leads?aba=pipeline", permission: "comercial", keywords: "kanban funil etapas" },
  { label: "Leads › Prospecção", href: "/leads?aba=prospeccao", permission: "comercial", keywords: "mapa cnae abordagem follow-up" },
  { label: "Leads › Atividades", href: "/leads?aba=atividades", permission: "comercial", keywords: "histórico ligações" },
  { label: "Financeiro › Receitas", href: "/financeiro?aba=receitas", permission: "financeiro", keywords: "entradas" },
  { label: "Financeiro › Despesas", href: "/financeiro?aba=despesas", permission: "financeiro", keywords: "saídas" },
  { label: "Financeiro › Contas a receber", href: "/financeiro?aba=receber", permission: "financeiro", keywords: "pendentes atrasados" },
  { label: "Financeiro › Recorrências", href: "/financeiro?aba=recorrencias", permission: "financeiro", keywords: "mensalidades contratos" },
  { label: "Configurações › Integrações", href: "/configuracoes?aba=integracoes", permission: "configuracoes", keywords: "api github vercel supabase anthropic" },
  { label: "Configurações › Infraestrutura", href: "/configuracoes?aba=infraestrutura", permission: "configuracoes", keywords: "servidores vps ssh deploy backups" },
]

export function canAccess(user: User | null, permission?: PagePermission) {
  if (!user) return false
  if (!permission) return true
  return user.role === "admin" || Boolean(user.permissions?.includes(permission))
}

export const roleLabels: Record<string, string> = {
  admin: "Administrador",
  manager: "Gestor",
  finance: "Financeiro",
  support: "Suporte",
  commercial: "Comercial",
  sdr: "SDR",
  closer: "Closer",
  representative: "Representante",
  sd: "Operacional",
  client: "Cliente",
  user: "Usuário",
}
