import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// Acompanhamento público de chamados: nunca lista tudo. Só devolve resultados quando o
// visitante informa o próprio nome E as duas primeiras letras da empresa — as duas coisas
// juntas funcionam como uma checagem leve, sem exigir login, pra ninguém enxergar chamado alheio.
const MAX_SEARCHES_PER_HOUR = 30

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) return forwardedFor.split(",")[0].trim()
  return request.headers.get("x-real-ip") || "unknown"
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const requesterName = normalize(String(body.requester_name || ""))
    const companyPrefix = normalize(String(body.company_prefix || ""))

    if (requesterName.length < 2) return NextResponse.json({ error: "Informe seu nome" }, { status: 400 })
    if (companyPrefix.length < 2) return NextResponse.json({ error: "Informe pelo menos as 2 primeiras letras da empresa" }, { status: 400 })

    const supabase = createAdminClient()

    const ip = getClientIp(request)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count: recentSearches } = await supabase
      .from("public_search_log")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", oneHourAgo)
    if ((recentSearches ?? 0) >= MAX_SEARCHES_PER_HOUR) {
      return NextResponse.json({ error: "Muitas consultas. Tente novamente mais tarde." }, { status: 429 })
    }
    await supabase.from("public_search_log").insert({ ip })

    const { data, error } = await supabase
      .from("tasks")
      .select("os_number, title, description, status, priority, request_type, estimated_window, requester_name, company_name, created_at")
      .eq("kind", "chamado")
      .order("created_at", { ascending: false })
      .limit(5000)

    if (error) {
      console.error("[v0] Error searching public tickets:", error)
      return NextResponse.json({ error: "Não foi possível consultar os chamados" }, { status: 500 })
    }

    const tickets = (data ?? []).filter(task => {
      const normalizedRequester = normalize(task.requester_name || "")
      const normalizedCompany = normalize(task.company_name || "")
      return normalizedRequester.includes(requesterName) && normalizedCompany.startsWith(companyPrefix)
    }).map(({ requester_name, company_name, ...rest }) => rest)

    return NextResponse.json({ tickets })
  } catch (error) {
    console.error("[v0] Error searching public tickets:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
