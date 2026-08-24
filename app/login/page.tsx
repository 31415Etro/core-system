"use client"

import { Suspense, useEffect } from "react"
import type React from "react"
import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Mail, Lock, ServerCog } from "lucide-react"
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
      description: "Sessão local iniciada.",
    })

    router.replace(returnTo)
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-blue-50 via-white to-blue-100">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-300/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-100/30 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md px-4 md:px-6">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl p-6 md:p-8 lg:p-10">
          <div className="mb-6 md:mb-8 text-center">
            <div className="flex justify-center mb-4 md:mb-6">
              <div className="flex items-center gap-3 text-2xl font-semibold tracking-tight"><span className="grid h-12 w-12 place-items-center rounded-xl bg-blue-600 text-white"><ServerCog className="h-7 w-7"/></span><span>Gênes Group</span></div>
            </div>
            <p className="text-sm text-gray-600">Entre com sua conta para acessar o sistema.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="pl-10 h-11"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                <Input
                  id="password"
                  type="password"
                  placeholder="sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="pl-10 h-11"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-lg mt-6"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Entrando...
                </span>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-600 mt-4 md:mt-6">Acesso restrito à equipe Gênes Group.</p>
      </div>
    </div>
  )
}
