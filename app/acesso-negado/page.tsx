"use client"

import { LockKeyhole, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"

export default function AccessDeniedPage() {
  const { logout } = useAuth()
  return (
    <main className="grid min-h-[100dvh] place-items-center p-6">
      <section className="glass w-full max-w-md rounded-[24px] p-8 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
          <LockKeyhole className="size-6" strokeWidth={1.75} />
        </span>
        <h1 className="mt-5 text-xl font-semibold tracking-tight">Acesso ainda não liberado</h1>
        <p className="mt-2 text-sm text-muted-foreground">Este usuário não tem permissão para esta página. Peça a um administrador que ajuste as permissões.</p>
        <Button className="mt-6" variant="outline" onClick={logout}><LogOut /> Sair</Button>
      </section>
    </main>
  )
}
