"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, ChevronRight, Clock3, Search } from "lucide-react";
import { updateServiceDefaultsAction } from "@/features/services/server/actions";

type ServiceItem = {
  id: string;
  name: string;
  defaultDurationMinutes: number | null;
  defaultPrice: number;
  isStartingPrice: boolean;
  requiredRoomType: "HAMAM" | "TREATMENT_ROOM" | null;
};
type CategoryItem = { id: string; name: string; services: ServiceItem[] };

const field =
  "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100";

function durationLabel(minutes:number|null) {
  if (!minutes) return "Durée à compléter";
  const h=Math.floor(minutes/60), m=minutes%60;
  return [h?`${h} h`:"",m?`${m} min`:""].filter(Boolean).join(" ");
}
function money(v:number){return `${new Intl.NumberFormat("fr-MA",{maximumFractionDigits:2}).format(v)} DH`}

export function ServiceCatalogForm({categories}:{categories:CategoryItem[]}) {
  const [query,setQuery]=useState("");
  const [categoryId,setCategoryId]=useState("all");
  const [selectedId,setSelectedId]=useState<string|null>(null);

  const all=useMemo(()=>categories.flatMap(c=>c.services.map(s=>({...s,categoryId:c.id,categoryName:c.name}))),[categories]);
  const selected=all.find(s=>s.id===selectedId)??null;
  const filtered=all.filter(s=>{
    const categoryOk=categoryId==="all"||s.categoryId===categoryId;
    const q=query.trim().toLocaleLowerCase("fr");
    return categoryOk&&(!q||`${s.name} ${s.categoryName}`.toLocaleLowerCase("fr").includes(q));
  });

  if(selected) return <ServiceEditor service={selected} onBack={()=>setSelectedId(null)}/>;

  return <div className="space-y-5">
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
      <input className={`${field} pl-10`} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher une prestation…"/>
    </div>

    <div className="flex gap-2 overflow-x-auto pb-1">
      <button onClick={()=>setCategoryId("all")} className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold ${categoryId==="all"?"border-rose-300 bg-rose-50 text-rose-800":"border-slate-200 bg-white text-slate-600"}`}>Toutes</button>
      {categories.map(c=><button key={c.id} onClick={()=>setCategoryId(c.id)} className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold ${categoryId===c.id?"border-rose-300 bg-rose-50 text-rose-800":"border-slate-200 bg-white text-slate-600"}`}>{c.name}</button>)}
    </div>

    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      {filtered.length===0?<p className="p-10 text-center text-sm text-slate-500">Aucune prestation trouvée.</p>:
      filtered.map((s,i)=><button key={s.id} onClick={()=>setSelectedId(s.id)} className={`group flex w-full items-center gap-4 p-4 text-left hover:bg-rose-50/40 sm:p-5 ${i?"border-t border-slate-100":""}`}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-950">{s.name}</h3>
            {s.requiredRoomType?<span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{s.requiredRoomType==="HAMAM"?"Hamam":"Salle de soins"}</span>:null}
          </div>
          <p className="mt-1 text-xs text-slate-500">{s.categoryName} · {durationLabel(s.defaultDurationMinutes)}</p>
        </div>
        <p className="shrink-0 font-bold text-slate-950">{money(s.defaultPrice)}</p>
        <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 group-hover:text-rose-600"/>
      </button>)}
    </div>
  </div>;
}

function ServiceEditor({service,onBack}:{service:ServiceItem&{categoryName:string};onBack:()=>void}) {
  const [duration,setDuration]=useState(service.defaultDurationMinutes?.toString()??"");
  const [price,setPrice]=useState(String(service.defaultPrice));
  const [pending,startTransition]=useTransition();
  const [message,setMessage]=useState<string|null>(null);

  const save=()=>{
    const d=Number(duration), p=Number(price);
    if(!Number.isInteger(d)||d<=0||!Number.isFinite(p)||p<0){setMessage("Vérifiez la durée et le prix.");return;}
    startTransition(async()=>{
      const r=await updateServiceDefaultsAction({serviceId:service.id,defaultDurationMinutes:d,defaultPrice:p,isStartingPrice:false});
      setMessage(r.ok?"Prestation enregistrée.":r.message);
    });
  };

  return <div className="space-y-5">
    <button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-950"><ArrowLeft className="h-4 w-4"/>Prestations</button>
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div>
        <p className="text-sm font-semibold text-rose-700">{service.categoryName}</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-950">{service.name}</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <div className="rounded-2xl bg-slate-50 px-4 py-3"><p className="text-xs text-slate-500">Prix de base</p><p className="mt-1 text-xl font-bold">{money(Number(price)||0)}</p></div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3"><p className="text-xs text-slate-500">Durée habituelle</p><p className="mt-1 flex items-center gap-1 text-xl font-bold"><Clock3 className="h-4 w-4"/>{durationLabel(Number(duration)||null)}</p></div>
        </div>
      </div>
      <div className="mt-6 border-t border-slate-100 pt-6">
        <h3 className="font-bold text-slate-950">Informations</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">Durée en minutes<input className={`${field} mt-1`} type="number" min="1" value={duration} onChange={e=>setDuration(e.target.value)}/></label>
          <label className="text-sm font-semibold text-slate-700">Prix de base (DH)<input className={`${field} mt-1`} type="number" min="0" step="0.01" value={price} onChange={e=>setPrice(e.target.value)}/></label>
        </div>
        <div className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm leading-6 text-rose-950">
          Ce prix est proposé automatiquement au rendez-vous. Si une prestation nécessite exceptionnellement un autre montant, la gérante l’ajuste uniquement sur ce rendez-vous : le catalogue ne change pas.
        </div>
        {message?<p className="mt-4 text-sm font-semibold text-slate-700">{message}</p>:null}
        <button disabled={pending} onClick={save} className="mt-4 min-h-11 rounded-xl bg-rose-700 px-5 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50">Enregistrer</button>
      </div>
    </section>
  </div>;
}
