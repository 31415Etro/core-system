"use client"
import type React from "react"
import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { BriefcaseBusiness, Building2, LayoutDashboard, Landmark, LogOut, Settings, TicketCheck } from "lucide-react"
import { Topbar } from "@/components/topbar"
import { Sidebar as SidebarContainer, SidebarBody, SidebarLink, useSidebar } from "@/components/ui/sidebar-animated"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"

const navigation = [
  { label: "Visão geral", href: "/dashboard", permission: "dashboard", icon: LayoutDashboard },
  { label: "Clientes e fornecedores", href: "/clientes-obras", permission: "clientes_obras", icon: Building2 },
  { label: "Tarefas e chamados", href: "/tickets", permission: "ordens_servico", icon: TicketCheck },
  { label: "Financeiro", href: "/financeiro", permission: "financeiro", icon: Landmark },
  { label: "Comercial", href: "/comercial", permission: "comercial", icon: BriefcaseBusiness },
  { label: "Configurações", href: "/configuracoes", permission: "configuracoes", icon: Settings },
] as const

const routePermissions: Record<string, string> = {"/dashboard":"dashboard","/clientes-obras":"clientes_obras","/tickets":"ordens_servico","/financeiro":"financeiro","/comercial":"comercial","/configuracoes":"configuracoes"}

function MainContent({ children }: { children: React.ReactNode }) {
  const { open } = useSidebar()
  return <motion.main animate={{ marginLeft: open ? "280px" : "80px" }} transition={{ duration: 0.2 }} className="p-4 md:p-8 md:ml-0">{children}</motion.main>
}
function SidebarContent() {
  const { logout, user } = useAuth(); const { open } = useSidebar()
  const links = user?.role === "admin" ? navigation : navigation.filter((item) => user?.permissions?.includes(item.permission as never))
  return <div className="fixed left-0 top-16 z-40 h-[calc(100vh-4rem)]"><SidebarBody className="justify-between gap-6">
    <div className="mt-4 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">{links.map(({ icon: Icon, ...link }) => <SidebarLink key={link.href} link={{ ...link, icon: <Icon className="h-5 w-5 flex-shrink-0 text-sidebar-foreground" /> }} />)}</div>
    <div className="border-t border-border pt-3">{open && <div className="mb-2 px-2"><p className="text-sm font-medium">{user?.name}</p><p className="text-xs text-muted-foreground">{user?.email}</p></div>}<Button onClick={logout} variant="ghost" className="w-full justify-start gap-2 text-destructive"><LogOut className="h-5 w-5" />{open && "Sair"}</Button></div>
  </SidebarBody></div>
}
export function PageLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false); const { user, isLoading } = useAuth(); const router = useRouter(); const pathname = usePathname()
  useEffect(() => { if (!isLoading && !user && pathname !== "/login") router.push("/login") }, [isLoading, pathname, router, user])
  useEffect(() => { const required=routePermissions[pathname];if(!isLoading&&user&&user.role!=="admin"&&required&&!user.permissions?.includes(required as never))router.replace("/acesso-negado") }, [isLoading,pathname,router,user])
  if (isLoading) return <div className="min-h-[100dvh] bg-background p-12"><div className="mx-auto h-8 w-48 animate-pulse rounded-md bg-muted" /></div>
  if (!user) return null
  const requiredPermission=routePermissions[pathname]
  if(user.role!=="admin"&&requiredPermission&&!user.permissions?.includes(requiredPermission as never))return null
  return <div className="min-h-[100dvh]"><Topbar /><SidebarContainer open={open} setOpen={setOpen}><SidebarContent /><MainContent>{children}</MainContent></SidebarContainer></div>
}
