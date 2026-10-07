"use client"

import { Suspense, useEffect } from "react"
import type React from "react"
import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Mail, Lock } from "lucide-react"
import { CoreMark } from "@/components/core/logo"
import { useAuth } from "@/lib/auth-context"

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { login, user, isLoading: authLoading } = useAuth()
  const requestedReturnTo = searchParams.get("returnTo") || "/dashboard"
  const returnTo = requestedReturnTo.startsWith("/") && !requestedReturnTo.startsWith("//") ? requestedReturnTo : "/dashboard"

  useEffect(() => {
    if (!authLoading && user) {
      router.replace(returnTo)
    }
  }, [user, authLoading, router, returnTo])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const result = await login(email, password)

    if (!result.success) {
      toast({
        title: "Falha no login",
        description: result.error || "Nao foi possivel entrar",
        variant: "destructive",
      })
      setIsLoading(false)
      return
    }

    toast({
      title: "Login realizado",
      description: "Bem-vindo ao Core.",
      variant: "success",
    })

    router.replace(returnTo)
  }

  return (
    <main className="relative grid min-h-[100dvh] place-items-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute left-1/2 top-[18%] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,190,0,0.14),transparent_65%)] blur-2xl" aria-hidden="true" />

      <div className="relative z-10 w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <CoreMark className="size-14 drop-shadow-[0_0_24px_rgba(255,190,0,0.35)]" />
          <h1 className="mt-5 text-[26px] font-semibold tracking-tight text-foreground">Entrar no Core</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Acesse sua conta para continuar.</p>
        </div>

        <div className="glass rounded-[24px] p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[13px] font-medium text-zinc-300">E-mail</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
                <Input id="email" type="email" autoComplete="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} className="pl-10" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[13px] font-medium text-zinc-300">Senha</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
                <Input id="password" type="password" autoComplete="current-password" placeholder="Sua senha" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading} className="pl-10" />
              </div>
            </div>

            <Button type="submit" size="lg" className="mt-2 w-full" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-black/25 border-t-black" />
                  Entrando...
                </span>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-subtle">Acesso restrito à equipe autorizada.</p>
      </div>
    </main>
  )
}
