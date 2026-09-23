import { Banknote, CalendarDays, CheckCircle2, WalletCards } from "lucide-react";
import { TeamActivity } from "@/features/dashboard/components/team-activity";
import type { AwaitedReturn } from "@/features/dashboard/components/types";

function money(value:number){return new Intl.NumberFormat("fr-MA",{style:"currency",currency:"MAD",maximumFractionDigits:0}).format(value)}

export function Dashboard({data}:{data:AwaitedReturn}){
  const {operational,finance}=data;
  const cards=[
    {label:"Rendez-vous",value:operational.appointmentCount,helper:"aujourd’hui",icon:CalendarDays},
    {label:"Terminés",value:operational.completedCount,helper:"rendez-vous finalisés",icon:CheckCircle2},
    {label:"Encaissé",value:finance?money(finance.today):"—",helper:"aujourd’hui",icon:WalletCards},
  ];
  return <div className="space-y-6">
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {cards.map(({label,value,helper,icon:Icon})=><div key={label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</p><Icon className="h-4 w-4 text-violet-600" strokeWidth={1.8}/></div><p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{helper}</p></div>)}
    </section>
    {finance?<section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-2"><Banknote className="h-5 w-5 text-violet-700"/><div><h2 className="text-xl font-semibold text-slate-950">Encaissements</h2><p className="mt-1 text-sm text-slate-500">Une lecture simple des montants réellement encaissés.</p></div></div><div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3"><Money label="Aujourd’hui" value={finance.today} emphasis/><Money label="Cette semaine" value={finance.week}/><Money label="Ce mois" value={finance.month}/></div></section>:null}
    <TeamActivity activity={operational.teamActivity}/>
  </div>
}
function Money({label,value,emphasis=false}:{label:string;value:number;emphasis?:boolean}){return <div className={`rounded-2xl p-4 ${emphasis?"bg-violet-50 ring-1 ring-violet-100":"bg-slate-50"}`}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{money(value)}</p></div>}
