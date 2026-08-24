"use client"
import Link from "next/link"
import { CalendarClock,TicketCheck } from "lucide-react"
import { finiteTicketTotals,nextRenewal,supportClients } from "@/lib/it-service-data"

export function TopbarTicketIndicator(){
 const next=[...supportClients].sort((a,b)=>nextRenewal(a.dueDay).getTime()-nextRenewal(b.dueDay).getTime())[0]
 const remaining=finiteTicketTotals.total-finiteTicketTotals.used
 return <Link href="/tickets" aria-label={`${remaining} tickets disponíveis; próxima renovação dia ${next.dueDay}`} className="hidden items-center gap-3 rounded-lg border bg-card px-3 py-1.5 transition-colors hover:bg-muted/50 sm:flex">
  <span className="flex items-center gap-1.5 text-xs"><TicketCheck className="h-4 w-4 text-primary"/><strong className="tabular-nums">{remaining}</strong><span className="hidden text-muted-foreground lg:inline">tickets restantes</span></span>
  <span className="h-5 w-px bg-border"/>
  <span className="flex items-center gap-1.5 text-xs"><CalendarClock className="h-4 w-4 text-primary"/><span className="hidden text-muted-foreground md:inline">próxima:</span><strong>{next.name} · dia {next.dueDay}</strong></span>
 </Link>
}
