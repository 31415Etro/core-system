"use client"

import { useEffect, useMemo, useState } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { Building2, Loader2, Phone, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type ProspectCompany = {
  id: string; cnpj: string; company_name: string; trade_name: string | null; cnae_principal: string
  municipio: string | null; uf: string; telefone: string | null; email: string | null
  socios: string[]; latitude: number | null; longitude: number | null; linked_opportunity_id: string | null
}

const markerIcon = L.divIcon({
  className: "",
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#2563eb;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

const defaultCenter: [number, number] = [-27.5954, -48.548] // Florianópolis

function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap()
  useEffect(() => { if (target) map.flyTo(target, 12) }, [target, map])
  return null
}

function PromoteButton({ company, onPromoted }: { company: ProspectCompany; onPromoted: (id: string) => void }) {
  const [loading, setLoading] = useState(false)
  if (company.linked_opportunity_id) return <span className="text-xs font-medium text-emerald-600">Já está no pipeline</span>
  return <Button
    size="sm"
    disabled={loading}
    onClick={async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/prospect-companies/${company.id}/promote`, { method: "POST" })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || "Erro ao criar oportunidade")
        onPromoted(company.id)
      } catch (error) {
        console.error("[v0] Error promoting company:", error)
        alert(error instanceof Error ? error.message : "Erro ao criar oportunidade")
      } finally {
        setLoading(false)
      }
    }}
  >{loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Criar oportunidade</Button>
}

export function ProspectMap() {
  const [companies, setCompanies] = useState<ProspectCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [cnaeFilter, setCnaeFilter] = useState("all")
  const [focused, setFocused] = useState<[number, number] | null>(null)

  useEffect(() => {
    fetch("/api/prospect-companies")
      .then(response => response.json())
      .then(payload => setCompanies(payload.companies ?? []))
      .catch(error => {
        console.error("[v0] Error loading prospect companies:", error)
        setErrorMsg("Não foi possível carregar as empresas prospectadas.")
      })
      .finally(() => setLoading(false))
  }, [])

  const cnaeOptions = useMemo(() => [...new Set(companies.map(c => c.cnae_principal))].sort(), [companies])

  const visible = useMemo(
    () => companies.filter(c =>
      (cnaeFilter === "all" || c.cnae_principal === cnaeFilter) &&
      `${c.company_name} ${c.trade_name ?? ""} ${c.cnpj} ${c.municipio ?? ""}`.toLowerCase().includes(query.toLowerCase()),
    ),
    [companies, query, cnaeFilter],
  )

  const groupedByLocation = useMemo(() => {
    const groups = new Map<string, { lat: number; lng: number; companies: ProspectCompany[] }>()
    for (const company of visible) {
      if (company.latitude == null || company.longitude == null) continue
      const key = `${company.latitude},${company.longitude}`
      if (!groups.has(key)) groups.set(key, { lat: company.latitude, lng: company.longitude, companies: [] })
      groups.get(key)!.companies.push(company)
    }
    return [...groups.values()]
  }, [visible])

  function markAsPromoted(id: string) {
    setCompanies(current => current.map(c => (c.id === id ? { ...c, linked_opportunity_id: "pending" } : c)))
  }

  if (loading) return <div className="grid min-h-[300px] place-items-center text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
  if (errorMsg) return <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{errorMsg}</div>
  if (!companies.length) return <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhuma empresa importada ainda. Rode o script de importação da Receita Federal para popular o mapa.</div>

  return <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
    <div className="h-[560px] overflow-hidden rounded-xl border">
      <MapContainer center={defaultCenter} zoom={7} style={{ height: "100%", width: "100%" }}>
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FlyTo target={focused} />
        {groupedByLocation.map(group => <Marker key={`${group.lat},${group.lng}`} position={[group.lat, group.lng]} icon={markerIcon}>
          <Popup maxWidth={280}>
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground">{group.companies.length} empresa(s) nesta cidade</p>
              {group.companies.map(company => <div key={company.id} className="border-t pt-2 first:border-0 first:pt-0">
                <p className="text-sm font-semibold">{company.company_name}</p>
                <p className="text-xs text-muted-foreground">{company.cnae_principal} · {company.municipio}</p>
                {company.telefone && <p className="mt-1 flex items-center gap-1 text-xs"><Phone className="h-3 w-3" />{company.telefone}</p>}
                <div className="mt-2"><PromoteButton company={company} onPromoted={markAsPromoted} /></div>
              </div>)}
            </div>
          </Popup>
        </Marker>)}
      </MapContainer>
    </div>
    <div className="flex max-h-[560px] flex-col gap-3">
      <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar empresa, CNPJ ou cidade" /></div>
      <Select value={cnaeFilter} onValueChange={setCnaeFilter}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="all">Todos os CNAEs</SelectItem>{cnaeOptions.map(cnae => <SelectItem key={cnae} value={cnae}>{cnae}</SelectItem>)}</SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{visible.length} empresas encontradas</p>
      <div className="flex-1 space-y-2 overflow-y-auto rounded-xl border p-2">
        {visible.map(company => <button
          key={company.id}
          onClick={() => company.latitude != null && company.longitude != null && setFocused([company.latitude, company.longitude])}
          className="w-full rounded-lg border p-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
        >
          <p className="text-sm font-medium leading-snug">{company.company_name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{company.cnpj} · {company.municipio}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><Building2 className="h-3 w-3" />{company.cnae_principal}</p>
        </button>)}
        {!visible.length && <div className="grid min-h-24 place-items-center text-center text-xs text-muted-foreground">Nenhuma empresa com esse filtro</div>}
      </div>
    </div>
  </div>
}
