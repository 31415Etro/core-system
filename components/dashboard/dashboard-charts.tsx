"use client"

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { brl } from "@/lib/it-service-data"

export type MonthlyFinance = { label: string; Receita: number; Despesas: number; Saldo: number }
export type MonthlyCount = { label: string; total: number }
export type DonutSlice = { name: string; value: number; color: string }

const axis = { fontSize: 11, fill: "var(--core-text-subtle)" }
const compact = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k` : String(v))

type TooltipEntry = { name?: string; value?: number; color?: string; dataKey?: string }

function GlassTooltip({ active, payload, label, money }: { active?: boolean; payload?: TooltipEntry[]; label?: string; money?: boolean }) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-strong min-w-40 rounded-xl px-3 py-2.5 text-xs">
      <p className="mb-1.5 font-medium text-muted-foreground">{label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground"><span className="size-2 rounded-full" style={{ background: p.color }} />{p.name}</span>
          <span className="font-semibold tabular-nums text-foreground">{money ? brl(Number(p.value)) : p.value}</span>
        </p>
      ))}
    </div>
  )
}

const SERIES = [
  { key: "Receita", color: "var(--core-yellow)" },
  { key: "Despesas", color: "#71717a" },
  { key: "Saldo", color: "#e4e4e7" },
] as const

export function PerformanceChart({ data }: { data: MonthlyFinance[] }) {
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="fill-receita" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffc400" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#ffc400" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fill-despesas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a1a1aa" stopOpacity={0.12} />
                <stop offset="100%" stopColor="#a1a1aa" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} dy={6} />
            <YAxis tick={axis} tickLine={false} axisLine={false} width={44} tickFormatter={compact} />
            <Tooltip cursor={{ stroke: "rgba(255,196,0,0.35)", strokeDasharray: "4 4" }} content={<GlassTooltip money />} />
            <Area type="monotone" dataKey="Despesas" stroke="#71717a" strokeWidth={1.75} fill="url(#fill-despesas)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
            <Area type="monotone" dataKey="Saldo" stroke="#e4e4e7" strokeWidth={1.5} strokeDasharray="4 4" fill="transparent" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
            <Area type="monotone" dataKey="Receita" stroke="#ffc400" strokeWidth={2.5} fill="url(#fill-receita)" dot={{ r: 2.5, fill: "#ffc400", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#ffc400", stroke: "#070707", strokeWidth: 2 }} style={{ filter: "drop-shadow(0 0 6px rgba(255,196,0,0.35))" }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-5 text-xs text-muted-foreground">
        {SERIES.map((s) => <span key={s.key} className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: s.color }} />{s.key}</span>)}
      </div>
    </div>
  )
}

export function MonthlyBarsChart({ data, name }: { data: MonthlyCount[]; name: string }) {
  const last = data.length - 1
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 12, right: 4, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="bar-core" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffe259" />
            <stop offset="100%" stopColor="#ff9800" />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} dy={6} interval={0} />
        <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
        <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={<GlassTooltip />} />
        <Bar dataKey="total" name={name} radius={[6, 6, 2, 2]} maxBarSize={22}>
          {data.map((_, i) => <Cell key={i} fill="url(#bar-core)" fillOpacity={i === last ? 1 : 0.78} style={i === last ? { filter: "drop-shadow(0 0 8px rgba(255,196,0,0.45))" } : undefined} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function ProgressDonut({ data, percent, label }: { data: DonutSlice[]; percent: number; label: string }) {
  const hasData = data.some((d) => d.value > 0)
  return (
    <div className="relative size-[148px] shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={hasData ? data : [{ name: "vazio", value: 1, color: "rgba(255,255,255,0.08)" }]} dataKey="value" innerRadius={54} outerRadius={70} paddingAngle={hasData ? 2 : 0} stroke="none" startAngle={90} endAngle={-270} isAnimationActive={false}>
            {(hasData ? data : [{ color: "rgba(255,255,255,0.08)" }]).map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-2xl font-semibold tabular-nums text-foreground">{percent}%</p>
          <p className="text-[11px] text-subtle">{label}</p>
        </div>
      </div>
    </div>
  )
}
