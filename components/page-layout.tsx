"use client"
import type React from "react"
import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { AppShell } from "@/components/core/app-shell"
import { CoreMark } from "@/components/core/logo"
import { permissionForPath } from "@/components/core/navigation"
import { useAuth } from "@/lib/auth-context"

// Mantém a mesma API (PageLayout) e as mesmas regras de acesso; só a casca visual mudou para o AppShell CORE.
export function PageLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth(); const router = useRouter(); const pathname = usePathname()
  // A sessão vem do localStorage/cookie no cliente: até montar, servidor e cliente renderizam o mesmo placeholder (evita hydration mismatch).
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useEffect(() => { if (!isLoading && !user && pathname !== "/login") router.push("/login") }, [isLoading, pathname, router, user])
  useEffect(() => { const required=permissionForPath(pathname);if(!isLoading&&user&&user.role!=="admin"&&required&&!user.permissions?.includes(required as never))router.replace("/acesso-negado") }, [isLoading,pathname,router,user])
  if (!mounted || isLoading) return <div className="grid min-h-[100dvh] place-items-center"><CoreMark className="size-10 animate-pulse" /></div>
  if (!user) return null
  const requiredPermission=permissionForPath(pathname)
  if(user.role!=="admin"&&requiredPermission&&!user.permissions?.includes(requiredPermission as never))return null
  return <AppShell>{children}</AppShell>
}
