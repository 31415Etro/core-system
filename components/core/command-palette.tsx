"use client"

import { useRouter } from "next/navigation"
import { Building2, LogOut, Ticket } from "lucide-react"
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command"
import { CornerDownRight } from "lucide-react"
import { canAccess, internalShortcuts, liveNavItems, quickActions } from "@/components/core/navigation"
import { taskLabel, type ApiClient, type ApiTask } from "@/components/core/api-types"
import { useAuth } from "@/lib/auth-context"
import { useApi } from "@/lib/use-api"

/** Ctrl/⌘ + K — páginas, ações rápidas, clientes e chamados. */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter()
  const { user, logout } = useAuth()
  // Só busca dados quando a palette é aberta pela primeira vez.
  const clients = useApi<{ clients: ApiClient[] }>(open && canAccess(user, "clientes_obras") ? "/api/clients" : null)
  const tasks = useApi<{ tasks: ApiTask[] }>(open && canAccess(user, "ordens_servico") ? "/api/tasks" : null)

  const go = (href: string) => {
    onOpenChange(false)
    router.push(href)
  }

  const pages = liveNavItems.filter((i) => canAccess(user, i.permission))
  const actions = quickActions.filter((a) => canAccess(user, a.permission))

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Busca global" description="Busque páginas, clientes, chamados e ações" className="glass-strong top-[18%] translate-y-0 rounded-[22px] sm:max-w-xl">
      <CommandInput placeholder="Buscar clientes, chamados, páginas ou ações..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
        <CommandGroup heading="Ações rápidas">
          {actions.map((a) => (
            <CommandItem key={a.href} value={`acao ${a.label}`} onSelect={() => go(a.href)}>
              <a.icon /> {a.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Ir para">
          {pages.map((p) => (
            <CommandItem key={p.href} value={`pagina ${p.label} ${p.keywords ?? ""}`} onSelect={() => go(p.href)}>
              <p.icon /> {p.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Atalhos">
          {internalShortcuts.filter((s) => canAccess(user, s.permission)).map((s) => (
            <CommandItem key={s.href} value={`atalho ${s.label} ${s.keywords}`} onSelect={() => go(s.href)}>
              <CornerDownRight /> {s.label}
            </CommandItem>
          ))}
        </CommandGroup>
        {Boolean(clients.data?.clients?.length) && (
          <CommandGroup heading="Clientes">
            {clients.data!.clients.slice(0, 50).map((c) => (
              <CommandItem key={c.id} value={`cliente ${c.name} ${c.legal_name ?? ""} ${c.document ?? ""}`} onSelect={() => go(`/clientes-obras/${c.id}`)}>
                <Building2 />
                <span className="truncate">{c.name}</span>
                {c.document && <span className="ml-auto truncate text-xs text-subtle">{c.document}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {Boolean(tasks.data?.tasks?.length) && (
          <CommandGroup heading="Tarefas e chamados">
            {tasks.data!.tasks.slice(0, 60).map((t) => (
              <CommandItem key={t.id} value={`chamado ${t.os_number ?? ""} ${t.title} ${t.company_name ?? ""}`} onSelect={() => go(`/tickets?tarefa=${t.id}`)}>
                <Ticket />
                <span className="truncate">{taskLabel(t)}</span>
                {t.company_name && <span className="ml-auto truncate text-xs text-subtle">{t.company_name}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandSeparator />
        <CommandGroup heading="Conta">
          <CommandItem value="sair logout" onSelect={() => { onOpenChange(false); logout() }}>
            <LogOut /> Sair
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
