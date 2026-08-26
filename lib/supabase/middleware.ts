import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const publicPaths = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/user",
  "/api/orcamento/whatsapp",
  "/api/operational-state",
  "/api/operational-files/upload",
  "/api/asaas/webhook",
  "/campo/atendimento",
  "/campo/checklist",
  "/abertura-chamado",
  "/api/public/tasks",
]

const publicPathPrefixes = ["/api/agent/"]

const publicPatterns = [
  /^\/api\/ordens-servico\/[^/]+\/eventos$/,
]

const pagePermissions = [
  { prefix: "/dashboard", permission: "dashboard" },
  { prefix: "/clientes-obras", permission: "clientes_obras" },
  { prefix: "/servicos", permission: "clientes_obras" },
  { prefix: "/ordens-servico", permission: "ordens_servico" },
  { prefix: "/campo", permission: "operacao_campo" },
  { prefix: "/frota", permission: "frota" },
  { prefix: "/estoque", permission: "estoque" },
  { prefix: "/financeiro", permission: "financeiro" },
  { prefix: "/comercial", permission: "comercial" },
  { prefix: "/pmoc", permission: "pmoc" },
  { prefix: "/orcamento", permission: "orcamento" },
  { prefix: "/contratos", permission: "contratos" },
  { prefix: "/relatorios", permission: "relatorios" },
  { prefix: "/configuracoes", permission: "configuracoes" },
  { prefix: "/users", permission: "users" },
] as const

function isPublicPath(pathname: string) {
  return publicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))
    || publicPatterns.some((pattern) => pattern.test(pathname))
    || publicPathPrefixes.some((prefix) => pathname.startsWith(prefix))
}

function redirectWithCookies(request: NextRequest, pathname: string, source: NextResponse, returnTo = false) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ""
  if (returnTo && request.nextUrl.pathname !== "/") url.searchParams.set("returnTo", `${request.nextUrl.pathname}${request.nextUrl.search}`)
  const response = NextResponse.redirect(url)
  source.cookies.getAll().forEach((cookie) => response.cookies.set(cookie))
  return response
}

export async function updateSession(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next({ request })
  }
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  if (!user && !isPublicPath(pathname)) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 })
    return redirectWithCookies(request, "/login", supabaseResponse, true)
  }

  if (!user) return supabaseResponse

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,page_permissions,active")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile || profile.active === false) {
    await supabase.auth.signOut()
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Usuario inativo ou sem perfil" }, { status: 403 })
    return redirectWithCookies(request, "/login", supabaseResponse)
  }

  const storedPermissions = Array.isArray(profile.page_permissions) ? profile.page_permissions : []
  const permissions = storedPermissions
  const firstAllowed = pagePermissions.find((page) => permissions.includes(page.permission))?.prefix || "/acesso-negado"

  if (pathname === "/" || pathname === "/login") {
    return redirectWithCookies(request, profile.role === "admin" ? "/dashboard" : firstAllowed, supabaseResponse)
  }

  const page = pagePermissions.find((item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`))
  if (page && profile.role !== "admin" && !permissions.includes(page.permission)) {
    return redirectWithCookies(request, firstAllowed, supabaseResponse)
  }

  return supabaseResponse
}
