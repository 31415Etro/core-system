/**
 * Módulos principais ainda em construção. Cada um já tem sua rota na sidebar e a estrutura de abas definida;
 * as funcionalidades entram nas fases indicadas. Fonte única para sidebar e páginas.
 */
export type ModuleTab = { id: string; label: string; description: string }
export type PlannedModule = {
  slug: string
  href: string
  title: string
  description: string
  /** Fase do roadmap; null = ainda sem fase definida. */
  phase: number | null
  action?: string
  tabs: ModuleTab[]
}

export const PHASES: Record<number, string> = {
  1: "Design System, navegação, Dashboard e Leads",
  2: "Reuniões, CORE Meet, IA de reuniões, tarefas e pendências do lead",
  3: "Demos: modelos, GitHub, Supabase e Vercel",
  4: "Propostas, contratos, finalização de venda e financeiro automático",
  5: "Infraestrutura: servidores, SSH, deploy em produção, backup e rollback",
  6: "Conteúdo IA",
}

export const PLANNED_MODULES: PlannedModule[] = [
  {
    slug: "projetos", href: "/projetos", title: "Projetos", phase: 4,
    description: "Projetos criados automaticamente quando uma venda é finalizada.",
    tabs: [
      { id: "todos", label: "Todos", description: "Todos os projetos, com cliente, responsável, prazo, progresso e valor." },
      { id: "andamento", label: "Em andamento", description: "Projetos em implantação, com progresso e próximas entregas." },
      { id: "concluidos", label: "Concluídos", description: "Projetos entregues ao cliente." },
      { id: "arquivados", label: "Arquivados", description: "Projetos encerrados ou cancelados." },
    ],
  },
  {
    slug: "agenda", href: "/agenda", title: "Agenda", phase: 2,
    description: "Reuniões, tarefas e prazos em um só calendário.",
    tabs: [
      { id: "dia", label: "Dia", description: "Compromissos do dia, com reuniões, tarefas e prazos." },
      { id: "semana", label: "Semana", description: "Visão semanal com cores discretas por categoria." },
      { id: "mes", label: "Mês", description: "Visão mensal; clique em um evento para abrir os detalhes." },
    ],
  },
  {
    slug: "reunioes", href: "/reunioes", title: "Reuniões", phase: 2, action: "Nova reunião",
    description: "Todas as reuniões, gravadas pelo CORE Meet e organizadas pela IA.",
    tabs: [
      { id: "proximas", label: "Próximas", description: "Data, hora, lead/cliente, participantes, link do Meet e responsável." },
      { id: "realizadas", label: "Realizadas", description: "Resumo da IA, tarefas geradas e pendências de cada reunião." },
      { id: "gravacoes", label: "Gravações", description: "Gravações da extensão CORE Meet com status de transcrição e resumo." },
      { id: "pendencias", label: "Pendências", description: "Pendências nossas e do cliente extraídas das reuniões." },
    ],
  },
  {
    slug: "demos", href: "/demos", title: "Demos", phase: 3, action: "Criar demo",
    description: "Versões funcionais do sistema para apresentar ao cliente.",
    tabs: [
      { id: "instancias", label: "Instâncias", description: "Demos criadas: empresa, modelo, status, URL, expiração, lead e responsável. Cada demo tem Visão geral, Aplicação, Banco, Deploy (GitHub, Vercel, produção) e Logs." },
      { id: "modelos", label: "Modelos", description: "Biblioteca de modelos (CRM, ERP, Clínica, Jurídico, OS...) com preview, stack, versão, repositório e banco." },
    ],
  },
  {
    slug: "propostas", href: "/propostas", title: "Propostas", phase: 4, action: "Nova proposta",
    description: "Propostas comerciais personalizadas; o contrato nasce da proposta aceita.",
    tabs: [
      { id: "todas", label: "Todas", description: "Todas as propostas, independentemente do lead." },
      { id: "rascunho", label: "Rascunho", description: "Propostas em elaboração." },
      { id: "enviadas", label: "Enviadas", description: "Enviadas ao cliente por link público." },
      { id: "visualizadas", label: "Visualizadas", description: "Abertas pelo cliente, com data e tempo de visualização." },
      { id: "aceitas", label: "Aceitas", description: "Prontas para gerar o contrato sem redigitar valores." },
      { id: "recusadas", label: "Recusadas", description: "Propostas recusadas, com motivo." },
    ],
  },
  {
    slug: "conteudo-ia", href: "/conteudo-ia", title: "Conteúdo IA", phase: 6,
    description: "Roteiros, posts e anúncios criados com Claude a partir de referências.",
    tabs: [
      { id: "criar", label: "Criar conteúdo", description: "Empresa, produto, objetivo, público, plataforma, formato, tom e duração." },
      { id: "roteiros", label: "Roteiros", description: "Hook, cenas, falas, texto na tela, B-roll, transições e CTA." },
      { id: "ideias", label: "Ideias", description: "Ideias de pauta sugeridas pela IA." },
      { id: "referencias", label: "Referências", description: "URLs de TikTok, Instagram, YouTube e LinkedIn analisadas pela IA (estrutura, ritmo, hook), sem copiar." },
      { id: "biblioteca", label: "Biblioteca", description: "Conteúdos aprovados e publicados." },
    ],
  },
  {
    slug: "equipe", href: "/equipe", title: "Equipe", phase: null,
    description: "Pessoas, cargos, projetos, tarefas e produtividade.",
    tabs: [
      { id: "pessoas", label: "Pessoas", description: "Avatar, cargo, status, projetos, tarefas e última atividade." },
      { id: "produtividade", label: "Produtividade", description: "Entregas e tarefas por pessoa." },
    ],
  },
  {
    slug: "relatorios", href: "/relatorios", title: "Relatórios", phase: null,
    description: "Relatórios por área com filtros de período e exportação.",
    tabs: [
      { id: "comercial", label: "Comercial", description: "Funil, conversão e origem dos leads." },
      { id: "financeiro", label: "Financeiro", description: "Receitas, despesas, recorrência e inadimplência." },
      { id: "projetos", label: "Projetos", description: "Prazos e entregas." },
      { id: "equipe", label: "Equipe", description: "Tarefas e produtividade." },
    ],
  },
]

export const moduleBySlug = (slug: string) => PLANNED_MODULES.find((m) => m.slug === slug)
