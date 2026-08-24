import { PageLayout } from "@/components/page-layout"
import { TicketUsageDashboard } from "@/components/it/ticket-usage-dashboard"

export default function Page(){return <PageLayout><div className="mx-auto max-w-[1440px] space-y-6"><header className="border-b pb-5"><h1 className="text-3xl font-semibold tracking-tight">Visão geral</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Clientes, tarefas, chamados e receita recorrente em uma visão única.</p></header><TicketUsageDashboard/></div></PageLayout>}
