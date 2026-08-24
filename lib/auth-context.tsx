"use client"

import { createContext, useContext, useState, useEffect, useMemo, useCallback, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { systemPagePermissions, type PagePermission } from "@/lib/types"
import { authenticateLocalUser, getLocalUsers } from "@/lib/local-users"

export type UserRole = "admin" | "sdr" | "closer" | "representative" | "manager" | "support" | "finance" | "commercial" | "sd" | "client" | "user"

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  permissions: PagePermission[]
  clientId?: string | null
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const adminPermissions: PagePermission[] = systemPagePermissions
const LOCAL_SESSION_KEY = "genes-local-session"
const localAdmin = (email = "admin@genes.local"): User => ({
  id: "local-admin",
  name: "Administrador local",
  email,
  role: "admin",
  permissions: adminPermissions,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    document.documentElement.dataset.userRole = user?.role || "guest"
    return () => {
      delete document.documentElement.dataset.userRole
    }
  }, [user?.role])

  useEffect(() => {
    const localSession = window.localStorage.getItem(LOCAL_SESSION_KEY)
    if (localSession) {
      try {
        const saved = JSON.parse(localSession)
        setUser(saved.user || localAdmin(saved.email))
      } catch {
        window.localStorage.removeItem(LOCAL_SESSION_KEY)
      }
      setIsLoading(false)
      return
    }
    fetch("/api/auth/user", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (payload?.user) {
          setUser({
            ...payload.user,
            permissions: payload.user.role === "admin" ? adminPermissions : (payload.user.permissions || []),
          })
        } else {
          setUser(null)
        }
      })
      .catch((err) => {
        console.error("Erro ao carregar sessao:", err)
        setUser(null)
      })
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const trimmedEmail = email.trim()
    const trimmedPassword = password.trim()
    if (!trimmedEmail || !trimmedPassword) return { success: false, error: "Informe e-mail e senha" }

    // Tenta primeiro a sessão real do Supabase Auth (necessária para as rotas /api/* protegidas pelo proxy).
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, password: trimmedPassword }),
      })
      const payload = await response.json()
      if (response.ok && payload.success) {
        const userResponse = await fetch("/api/auth/user", { cache: "no-store" })
        const userPayload = await userResponse.json()
        if (userPayload.user) {
          window.localStorage.removeItem(LOCAL_SESSION_KEY)
          setUser({
            ...userPayload.user,
            permissions: userPayload.user.role === "admin" ? adminPermissions : (userPayload.user.permissions || []),
          })
          return { success: true }
        }
      }
    } catch (err) {
      console.error("Erro ao tentar sessao real do Supabase:", err)
    }

    // Sem conta real do Supabase para este e-mail: mantém o fluxo local (protótipo de Configurações > Usuários e o bypass de admin local).
    const exists = getLocalUsers().some(item => item.email === trimmedEmail.toLowerCase())
    if (exists) {
      const managed = await authenticateLocalUser(trimmedEmail, trimmedPassword)
      if (!managed) return { success: false, error: "E-mail, senha ou acesso inválido" }
      const localUser: User = { id: managed.id, name: managed.name, email: managed.email, role: managed.role as UserRole, permissions: managed.permissions }
      window.localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ user: localUser }))
      setUser(localUser)
      return { success: true }
    }
    const localUser = localAdmin(trimmedEmail)
    window.localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ user: localUser }))
    setUser(localUser)
    return { success: true }
  }, [])

  const logout = useCallback(async () => {
    window.localStorage.removeItem(LOCAL_SESSION_KEY)
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {})
    setUser(null)
    router.push("/login")
  }, [router])

  const value = useMemo(() => ({ user, login, logout, isLoading }), [user, login, logout, isLoading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
