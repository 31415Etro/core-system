export type TicketLevel = "N1" | "N2" | "N3" | "SERV"
export type TicketAllowance = Partial<Record<TicketLevel, number | null>>
export type SupportClient = { id:string;name:string;legalName:string;document:string;dueDay:number;plan:string;credits:number|null;used:number;monthly:number;payment:string;whatsappGroup:string;status:"Ativo"|"Atenção";allowance:TicketAllowance;usage:TicketAllowance }

// Dados de exemplo (placeholder) para telas ainda não conectadas ao Supabase.
// Substitua por clientes reais da Gênes Technology conforme forem cadastrados.
const rows: Array<[string,string,string,string,number,string,number|null,number,number,TicketAllowance,TicketAllowance]> = [
  ["cliente-1","Cliente Exemplo 1","Empresa Exemplo 1 LTDA","00.000.001/0001-01",10,"SaaS + 2 chamados",2,1,600,{SERV:null,N1:2},{SERV:3,N1:1}],
  ["cliente-2","Cliente Exemplo 2","Empresa Exemplo 2 LTDA","00.000.002/0001-02",10,"Automação",0,0,250,{SERV:null},{SERV:2}],
  ["cliente-3","Cliente Exemplo 3","Empresa Exemplo 3 LTDA","00.000.003/0001-03",15,"Site institucional",0,0,840,{SERV:null},{SERV:5}],
  ["cliente-4","Cliente Exemplo 4","Empresa Exemplo 4 LTDA","00.000.004/0001-04",10,"Agente de IA",7,4,1330,{SERV:null,N1:5,N2:1,N3:1},{SERV:2,N1:3,N2:1,N3:0}],
  ["cliente-5","Cliente Exemplo 5","Empresa Exemplo 5 LTDA","00.000.005/0001-05",15,"SaaS",4,3,1050,{N1:3,N3:1},{N1:2,N3:1}],
]

export const supportClients: SupportClient[] = rows.map(([id,name,legalName,document,dueDay,plan,credits,used,monthly,allowance,usage]) => ({id,name,legalName,document,dueDay,plan,credits,used,monthly,allowance,usage,payment:"ASAAS",whatsappGroup:`Gênes | ${name}`,status:credits!==null&&used>=credits?"Atenção":"Ativo"}))
export const brl=(value:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(value)
export function nextRenewal(dueDay:number,from=new Date()){const y=from.getFullYear(),m=from.getMonth();let date=new Date(y,m,Math.min(dueDay,new Date(y,m+1,0).getDate()));if(date.getTime()<=from.getTime())date=new Date(y,m+1,Math.min(dueDay,new Date(y,m+2,0).getDate()));return date}
export function daysUntilRenewal(client:SupportClient,now=new Date()){return Math.max(0,Math.ceil((nextRenewal(client.dueDay,now).getTime()-now.getTime())/86400000))}
export function clientTicketBalance(client:SupportClient){return client.credits===null?null:Math.max(client.credits-client.used,0)}
export const finiteTicketTotals=supportClients.reduce((a,c)=>{if(c.credits!==null){a.total+=c.credits;a.used+=c.used}return a},{total:0,used:0})
