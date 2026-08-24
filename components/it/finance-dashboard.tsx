"use client"
import { FormEvent,useEffect,useMemo,useState } from "react"
import { ArrowDownLeft,ArrowUpRight,Download,Landmark,Loader2,Plus,Search,WalletCards } from "lucide-react"
import { Bar,BarChart,CartesianGrid,Legend,ResponsiveContainer,Tooltip,XAxis,YAxis } from "recharts"
import { PageLayout } from "@/components/page-layout"
import { Button } from "@/components/ui/button"
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select"
import { Table,TableBody,TableCell,TableHead,TableHeader,TableRow } from "@/components/ui/table"
import { Tabs,TabsContent,TabsList,TabsTrigger } from "@/components/ui/tabs"
import { brl,supportClients } from "@/lib/it-service-data"
import { createClient } from "@/lib/supabase/client"
import { AsaasPanel } from "@/components/finance/asaas-panel"

type EntryType="income"|"expense"
type Entry={id:string;date:string;description:string;party:string;account:"Asaas"|"Ailos";category:string;type:EntryType;amount:number;status:"Pago"|"Pendente";client?:string}

const isoToday=()=>new Date().toISOString().slice(0,10)
const monthStart=()=>{const d=new Date();return new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10)}

const asaasTypeLabel=(type:string)=>({
 PAYMENT_RECEIVED:"Cobrança recebida",PAYMENT_CONFIRMED:"Cobrança confirmada",PAYMENT_FEE:"Taxa de cobrança",
 TRANSFER:"Transferência",TRANSFER_FEE:"Taxa de transferência",PIX_TRANSACTION_CREDIT:"Pix recebido",
 PIX_TRANSACTION_FEE:"Taxa de Pix",INVOICE_FEE:"Taxa de nota fiscal",
}[type] || type.replaceAll("_"," ").toLowerCase().replace(/^./,c=>c.toUpperCase()))

function EntryForm({onSave}:{onSave:(entry:Entry)=>void}){
 const [open,setOpen]=useState(false);const [type,setType]=useState<EntryType>("income")
 function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const data=new FormData(e.currentTarget);onSave({id:crypto.randomUUID(),date:String(data.get("date")),description:String(data.get("description")),party:String(data.get("party")),account:String(data.get("account")) as Entry["account"],category:String(data.get("category")),type,amount:Number(String(data.get("amount")).replace(",",".")),status:String(data.get("status")) as Entry["status"],client:String(data.get("client")||"")||undefined});setOpen(false)}
 return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Plus className="h-4 w-4"/>Nova movimentação</Button></DialogTrigger><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Cadastrar entrada ou saída</DialogTitle></DialogHeader><form onSubmit={submit} className="grid gap-4 md:grid-cols-2"><div><Label>Tipo</Label><Select value={type} onValueChange={v=>setType(v as EntryType)}><SelectTrigger className="mt-1"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="income">Entrada</SelectItem><SelectItem value="expense">Saída</SelectItem></SelectContent></Select></div><div><Label>Conta</Label><Select name="account" defaultValue={type==="income"?"Asaas":"Ailos"}><SelectTrigger className="mt-1"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Asaas">Asaas · Entradas</SelectItem><SelectItem value="Ailos">Ailos · Saídas</SelectItem></SelectContent></Select></div><div><Label>Data</Label><Input name="date" type="date" defaultValue={isoToday()} required className="mt-1"/></div><div><Label>Valor</Label><Input name="amount" inputMode="decimal" placeholder="0,00" required className="mt-1"/></div><div className="md:col-span-2"><Label>Descrição</Label><Input name="description" placeholder="Ex.: Mensalidade de suporte" required className="mt-1"/></div><div><Label>Cliente ou fornecedor</Label><Input name="party" placeholder="Nome da contraparte" required className="mt-1"/></div><div><Label>Categoria</Label><Input name="category" placeholder="Contratos, software, pessoal..." required className="mt-1"/></div><div><Label>Vincular cliente</Label><Select name="client"><SelectTrigger className="mt-1"><SelectValue placeholder="Opcional"/></SelectTrigger><SelectContent>{supportClients.map(c=><SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent></Select></div><div><Label>Status</Label><Select name="status" defaultValue="Pago"><SelectTrigger className="mt-1"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Pago">Pago</SelectItem><SelectItem value="Pendente">Pendente</SelectItem></SelectContent></Select></div><div className="md:col-span-2 flex justify-end gap-2"><Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancelar</Button><Button type="submit">Salvar movimentação</Button></div></form></DialogContent></Dialog>
}

export function FinanceDashboard(){
 const [entries,setEntries]=useState<Entry[]>([]),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState<string|null>(null)
 const [asaasBalance,setAsaasBalance]=useState<number|null>(null),[asaasEnv,setAsaasEnv]=useState<string|null>(null)
 const [account,setAccount]=useState("all"),[type,setType]=useState("all"),[query,setQuery]=useState(""),[from,setFrom]=useState(monthStart()),[to,setTo]=useState(isoToday())

 useEffect(()=>{
  let cancelled=false
  setLoading(true)
  async function load(){
   const supabase=createClient()
   const [asaasBalancePayload,asaasStatementPayload,ailosResult]=await Promise.all([
    fetch("/api/asaas/balance").then(r=>r.json()).catch(()=>({error:"offline"})),
    fetch(`/api/asaas/statement?startDate=${from}&finishDate=${to}`).then(r=>r.json()).catch(()=>({error:"offline"})),
    supabase.from("financial_transactions").select("*").eq("account_name","AILOS").gte("transaction_date",from).lte("transaction_date",to).order("transaction_date",{ascending:false}),
   ])
   if(cancelled)return
   if(!asaasBalancePayload.error){setAsaasBalance(asaasBalancePayload.balance);setAsaasEnv(asaasBalancePayload.environment)}
   const asaasEntries:Entry[]=!asaasStatementPayload.error?(asaasStatementPayload.data||[]).map((t:any)=>({
    id:t.id,date:t.date,description:t.description||asaasTypeLabel(t.type),party:"",account:"Asaas" as const,
    category:asaasTypeLabel(t.type),type:(t.value>=0?"income":"expense") as EntryType,amount:Math.abs(t.value),status:"Pago" as const,
   })):[]
   const ailosEntries:Entry[]=(ailosResult.data||[]).map((t:any)=>({
    id:t.id,date:t.transaction_date,description:t.description,party:"",account:"Ailos" as const,
    category:t.category||"Outros",type:t.type as EntryType,amount:Number(t.amount),status:t.status==="paid"?"Pago" as const:"Pendente" as const,
   }))
   if(asaasStatementPayload.error&&ailosResult.error)setLoadError("Não foi possível carregar os dados financeiros.")
   setEntries([...asaasEntries,...ailosEntries].sort((a,b)=>b.date.localeCompare(a.date)))
   setLoading(false)
  }
  load()
  return ()=>{cancelled=true}
 },[from,to])

 const filtered=useMemo(()=>entries.filter(e=>(account==="all"||e.account===account)&&(type==="all"||e.type===type)&&`${e.description} ${e.party} ${e.category} ${e.client||""}`.toLowerCase().includes(query.toLowerCase())),[entries,account,type,query])
 const income=filtered.filter(e=>e.type==="income").reduce((s,e)=>s+e.amount,0),expense=filtered.filter(e=>e.type==="expense").reduce((s,e)=>s+e.amount,0)
 const ailosNet=useMemo(()=>{const rows=entries.filter(e=>e.account==="Ailos");return rows.reduce((s,e)=>s+(e.type==="income"?e.amount:-e.amount),0)},[entries])
 const accounts=[
  {name:"Asaas" as const,kind:"Conta de entradas",balance:asaasBalance,note:asaasEnv==="sandbox"?"Saldo em tempo real (sandbox)":"Saldo em tempo real"},
  {name:"Ailos" as const,kind:"Conta de saídas",balance:ailosNet,note:"Movimentação líquida no período (extratos importados)"},
 ]
 const chartData=useMemo(()=>{
  const daily=new Map<string,{date:string;label:string;Entradas:number;Saídas:number}>()
  for(const entry of filtered){const current=daily.get(entry.date)??{date:entry.date,label:new Date(`${entry.date}T12:00:00`).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"}),Entradas:0,Saídas:0};if(entry.type==="income")current.Entradas+=entry.amount;else current.Saídas+=entry.amount;daily.set(entry.date,current)}
  return [...daily.values()].sort((a,b)=>a.date.localeCompare(b.date))
 },[filtered])

 return <PageLayout><div className="mx-auto max-w-[1440px] space-y-6"><header className="flex flex-col justify-between gap-4 border-b pb-5 md:flex-row md:items-end"><div><h1 className="text-3xl font-semibold tracking-tight">Financeiro</h1><p className="mt-1 text-sm text-muted-foreground">Contas, entradas e saídas detalhadas por período — saldo e extrato ao vivo do ASAAS.</p></div><div className="flex gap-2"><Button variant="outline"><Download className="h-4 w-4"/>Exportar</Button><EntryForm onSave={entry=>setEntries(current=>[entry,...current])}/></div></header>
  <Tabs defaultValue="overview"><TabsList><TabsTrigger value="overview">Visão geral</TabsTrigger><TabsTrigger value="cobranca">Cobrança</TabsTrigger></TabsList>
  <TabsContent value="overview" className="space-y-6">
  {loading?<div className="grid min-h-[300px] place-items-center text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin"/></div>:<>
  {loadError&&<p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{loadError}</p>}
  <div className="grid gap-4 lg:grid-cols-[.72fr_1.28fr]"><section className="space-y-3">{accounts.map(a=><button key={a.name} onClick={()=>setAccount(account===a.name?"all":a.name)} className={`w-full rounded-xl border p-5 text-left transition ${account===a.name?"border-primary bg-primary/5 ring-2 ring-primary/10":"bg-card hover:bg-muted/30"}`}><div className="flex items-start justify-between"><div className="flex gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">{a.name==="Asaas"?<WalletCards className="h-5 w-5"/>:<Landmark className="h-5 w-5"/>}</span><div><p className="font-semibold">{a.name}</p><p className="text-xs text-muted-foreground">{a.kind}</p></div></div></div><p className="mt-5 text-2xl font-semibold tabular-nums">{a.balance!==null?brl(a.balance):"—"}</p><p className="mt-1 text-xs text-muted-foreground">{a.note}</p></button>)}</section>
   <section className="grid grid-cols-3 overflow-hidden rounded-xl border bg-card"><div className="p-5"><p className="text-xs text-muted-foreground">Entradas no período</p><p className="mt-2 text-xl font-semibold text-emerald-700 tabular-nums">{brl(income)}</p></div><div className="border-x p-5"><p className="text-xs text-muted-foreground">Saídas no período</p><p className="mt-2 text-xl font-semibold text-red-700 tabular-nums">{brl(expense)}</p></div><div className="p-5"><p className="text-xs text-muted-foreground">Resultado</p><p className={`mt-2 text-xl font-semibold tabular-nums ${income-expense<0?"text-red-700":"text-emerald-700"}`}>{brl(income-expense)}</p></div><div className="col-span-3 border-t p-5"><div><p className="text-sm font-medium">Visão do período selecionado</p><p className="mt-1 text-xs text-muted-foreground">Valores agrupados por dia conforme os filtros do extrato</p></div>{chartData.length?<div className="mt-4 h-[210px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{top:8,right:8,left:2,bottom:0}}><CartesianGrid vertical={false} strokeDasharray="3 3"/><XAxis dataKey="label" tick={{fontSize:11}} tickLine={false} axisLine={false}/><YAxis tick={{fontSize:10}} tickLine={false} axisLine={false} width={58} tickFormatter={value=>Number(value)>=1000?`${Math.round(Number(value)/1000)} mil`:String(value)}/><Tooltip cursor={{fill:"hsl(var(--muted))",opacity:.45}} formatter={value=>brl(Number(value))} labelFormatter={label=>`Dia ${label}`}/><Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize:12}}/><Bar dataKey="Entradas" fill="#059669" radius={[4,4,0,0]} maxBarSize={36}/><Bar dataKey="Saídas" fill="#dc2626" radius={[4,4,0,0]} maxBarSize={36}/></BarChart></ResponsiveContainer></div>:<div className="mt-4 grid h-[210px] place-items-center rounded-lg border border-dashed text-sm text-muted-foreground">Nenhuma movimentação para gerar o gráfico neste período.</div>}</div></section></div>
  <section className="rounded-xl border bg-card"><div className="grid gap-3 border-b p-4 md:grid-cols-[1fr_150px_150px_150px_150px]"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input className="pl-9" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar descrição, cliente ou categoria"/></div><Select value={account} onValueChange={setAccount}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Todas as contas</SelectItem><SelectItem value="Asaas">Asaas</SelectItem><SelectItem value="Ailos">Ailos</SelectItem></SelectContent></Select><Select value={type} onValueChange={setType}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Entradas e saídas</SelectItem><SelectItem value="income">Somente entradas</SelectItem><SelectItem value="expense">Somente saídas</SelectItem></SelectContent></Select><Input aria-label="Data inicial" type="date" value={from} onChange={e=>setFrom(e.target.value)}/><Input aria-label="Data final" type="date" value={to} onChange={e=>setTo(e.target.value)}/></div>
   <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Movimentação</TableHead><TableHead>Conta</TableHead><TableHead>Categoria</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader><TableBody>{filtered.map(e=><TableRow key={e.id}><TableCell className="whitespace-nowrap">{new Date(`${e.date}T12:00:00`).toLocaleDateString("pt-BR")}</TableCell><TableCell><div className="flex items-start gap-2"><span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md ${e.type==="income"?"bg-emerald-50 text-emerald-700":"bg-red-50 text-red-700"}`}>{e.type==="income"?<ArrowDownLeft className="h-4 w-4"/>:<ArrowUpRight className="h-4 w-4"/>}</span><div><p className="font-medium">{e.description}</p><p className="text-xs text-muted-foreground">{e.party}{e.client?` · ${e.client}`:""}</p></div></div></TableCell><TableCell>{e.account}</TableCell><TableCell>{e.category}</TableCell><TableCell><span className={`text-xs font-medium ${e.status==="Pago"?"text-emerald-700":"text-amber-700"}`}>{e.status}</span></TableCell><TableCell className={`text-right font-semibold tabular-nums ${e.type==="income"?"text-emerald-700":"text-red-700"}`}>{e.type==="income"?"+":"−"} {brl(e.amount)}</TableCell></TableRow>)}{filtered.length===0&&<TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">Nenhuma movimentação encontrada neste período.</TableCell></TableRow>}</TableBody></Table></div><div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground"><span>{filtered.length} movimentações exibidas</span><span>Período: {from?new Date(`${from}T12:00:00`).toLocaleDateString("pt-BR"):"início"} até {to?new Date(`${to}T12:00:00`).toLocaleDateString("pt-BR"):"hoje"}</span></div></section>
  </>}
  </TabsContent>
  <TabsContent value="cobranca"><AsaasPanel/></TabsContent>
  </Tabs>
 </div></PageLayout>
}
