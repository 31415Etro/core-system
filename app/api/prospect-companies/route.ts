import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

const LIST_COLUMNS = "id, cnpj, company_name, trade_name, cnae_principal, municipio, uf, telefone, latitude, longitude, linked_opportunity_id"
const PAGE_SIZE = 1000

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const cnae = searchParams.get("cnae")
    const municipio = searchParams.get("municipio")
    const query = searchParams.get("query")

    const supabase = createAdminClient()

    function buildQuery(page: number) {
      // order by municipio sozinho tem muitos empates; sem um desempate único o range() paralelo
      // pode repetir e pular linhas entre páginas (paginação por OFFSET não determinística).
      let dbQuery = supabase.from("prospect_companies").select(LIST_COLUMNS).order("municipio", { ascending: true }).order("id", { ascending: true }).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
      if (cnae) dbQuery = dbQuery.eq("cnae_principal", cnae)
      if (municipio) dbQuery = dbQuery.eq("municipio", municipio)
      if (query) dbQuery = dbQuery.or(`company_name.ilike.%${query}%,trade_name.ilike.%${query}%,cnpj.ilike.%${query}%,municipio.ilike.%${query}%`)
      return dbQuery
    }

    const first = await buildQuery(0)
    if (first.error) {
      console.error("[v0] Error fetching prospect_companies:", first.error)
      return NextResponse.json({ error: first.error.message }, { status: 500 })
    }

    const companies = [...(first.data ?? [])]
    if ((first.data?.length ?? 0) === PAGE_SIZE) {
      const remainingPages = Array.from({ length: 49 }, (_, i) => i + 1) // até 50k linhas no total
      const results = await Promise.all(remainingPages.map(page => buildQuery(page)))
      for (const result of results) {
        if (result.error) {
          console.error("[v0] Error fetching prospect_companies page:", result.error)
          continue
        }
        if (result.data?.length) companies.push(...result.data)
        else break
      }
    }

    return NextResponse.json({ companies })
  } catch (error) {
    console.error("[v0] Error fetching prospect_companies:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
