import { PageLayout } from "@/components/page-layout"
import { TicketUsageDashboard } from "@/components/it/ticket-usage-dashboard"

export default function Page(){return <PageLayout><div className="mx-auto max-w-[1440px] space-y-6"><header className="border-b pb-5"><h1 className="text-3xl font-semibold tracking-tight">Operação de suporte</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Franquias por cliente, consumo de tickets e renovações mensais em uma visão única.</p></header><TicketUsageDashboard/></div></PageLayout>}
