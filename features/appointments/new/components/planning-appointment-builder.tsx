"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CheckCircle2, Clock3, Plus, Trash2, UserRound, DoorOpen } from "lucide-react";
import { searchClientsAction } from "@/features/clients/server/actions";
import { createPlannedAppointmentAction } from "@/features/appointments/server/actions/appointment-actions";
import {
  casablancaLocalDateTimeToIso,
  getMinimumBookableCasablancaDateTime,
} from "@/features/appointments/lib/casablanca-local-datetime";
import { getPlanningDayForBookingAction } from "@/features/planning/server/actions/planning-actions";
import type { NewAppointmentOptions, NewAppointmentClientOption } from "@/features/appointments/new/types";
import type { PlanningAppointmentItem, PlanningEmployeeItem, PlanningRoomItem } from "@/features/planning/server";

const field = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400";

type DraftLine={key:string;serviceId:string;time:string;employeeId:string;roomId:string;price:string};
type Props=NewAppointmentOptions&{dateKey:string;initialTime?:string;initialEmployeeId?:string;cancelHref:string;planningAppointments:PlanningAppointmentItem[];planningEmployees:PlanningEmployeeItem[];planningRooms:PlanningRoomItem[]};

function minutes(time:string){const [h,m]=time.split(":").map(Number);return h*60+m}
function timeFromMinutes(value:number){const safe=Math.max(0,Math.min(value,23*60+59));return `${String(Math.floor(safe/60)).padStart(2,"0")}:${String(safe%60).padStart(2,"0")}`}
function overlaps(aStart:number,aDuration:number,bStart:number,bDuration:number){return aStart < bStart+bDuration && aStart+aDuration > bStart}
function quarterHourOptions(minimumTime="10:00"){
  const start=Math.max(10*60,minutes(minimumTime));
  return Array.from({length:Math.floor((21*60-start)/15)+1},(_,index)=>timeFromMinutes(start+index*15));
}

export function PlanningAppointmentBuilder({services,employees,rooms,dateKey,initialTime="10:00",initialEmployeeId="",cancelHref,planningAppointments,planningEmployees,planningRooms}:Props){
  const router=useRouter(); const[pending,startTransition]=useTransition();
  const minimumBooking=getMinimumBookableCasablancaDateTime();
  const[selectedDateKey,setSelectedDateKey]=useState(dateKey < minimumBooking.dateKey ? minimumBooking.dateKey : dateKey);
  const[dayAppointments,setDayAppointments]=useState(planningAppointments);
  const[dayEmployees,setDayEmployees]=useState(planningEmployees);
  const[dayRooms,setDayRooms]=useState(planningRooms);
  const[loadingDay,setLoadingDay]=useState(false);
  const[clientQuery,setClientQuery]=useState(""); const[clients,setClients]=useState<NewAppointmentClientOption[]>([]); const[client,setClient]=useState<NewAppointmentClientOption|null>(null);
  const[newClientName,setNewClientName]=useState(""); const[newClientPhone,setNewClientPhone]=useState(""); const[clientNote,setClientNote]=useState(""); const[note,setNote]=useState(""); const[error,setError]=useState<string|null>(null); const[lines,setLines]=useState<DraftLine[]>([]);
  const serviceMap=useMemo(()=>new Map(services.map(s=>[s.id,s])),[services]);
  const employeePlanning=useMemo(()=>new Map(dayEmployees.map(e=>[e.id,e])),[dayEmployees]);
  const roomPlanning=useMemo(()=>new Map(dayRooms.map(r=>[r.id,r])),[dayRooms]);

  function duration(line:DraftLine){return serviceMap.get(line.serviceId)?.defaultDurationMinutes??0}
  function firstAllowedTime(){
    const minimum=selectedDateKey===minimumBooking.dateKey?minimumBooking.timeValue:"10:00";
    const requested=timeFromMinutes(Math.ceil(minutes(initialTime)/15)*15);
    return requested<minimum?minimum:requested>"21:00"?"21:00":requested;
  }
  function nextStart(){const last=lines.at(-1);if(!last)return firstAllowedTime();const d=duration(last);const raw=last.time&&d?timeFromMinutes(minutes(last.time)+d):last.time||firstAllowedTime();return timeFromMinutes(Math.ceil(minutes(raw)/15)*15)}
  function addLine(){setLines(current=>[...current,{key:crypto.randomUUID(),serviceId:"",time:current.length?nextStart():firstAllowedTime(),employeeId:current.length===0?initialEmployeeId:"",roomId:"",price:""}])}
  function patchLine(key:string,patch:Partial<DraftLine>){setLines(current=>current.map(line=>line.key===key?{...line,...patch}:line))}

  function existingEmployeeConflict(employeeId:string,line:DraftLine){const d=duration(line);if(!line.time||!d)return false;const start=new Date(casablancaLocalDateTimeToIso(selectedDateKey,line.time)).getTime();const end=start+d*60000;const p=employeePlanning.get(employeeId);if(p?.unavailabilities.some(u=>new Date(u.startAt).getTime()<end&&new Date(u.endAt).getTime()>start))return true;return dayAppointments.some(a=>a.services.some(s=>s.assignedEmployee?.id===employeeId&&new Date(s.scheduledStart).getTime()<end&&new Date(s.scheduledEnd).getTime()>start))}
  function draftEmployeeConflict(employeeId:string,line:DraftLine){const d=duration(line);if(!line.time||!d)return false;return lines.some(other=>other.key!==line.key&&other.employeeId===employeeId&&other.time&&duration(other)>0&&overlaps(minutes(line.time),d,minutes(other.time),duration(other)))}
  function employeeUnavailableReason(employeeId:string,line:DraftLine){
    const d=duration(line); if(!line.time||!d)return null;
    const start=new Date(casablancaLocalDateTimeToIso(selectedDateKey,line.time)).getTime(); const end=start+d*60000;
    const p=employeePlanning.get(employeeId);
    const unavailability=p?.unavailabilities.find(u=>new Date(u.startAt).getTime()<end&&new Date(u.endAt).getTime()>start);
    if(unavailability){
      const labels={ABSENCE:"absence",BREAK:"pause",LEAVE:"congé",UNAVAILABLE:"indisponible"} as const;
      return labels[unavailability.type];
    }
    if(draftEmployeeConflict(employeeId,line))return "déjà choisie sur une autre prestation";
    if(dayAppointments.some(a=>a.services.some(service=>service.assignedEmployee?.id===employeeId&&new Date(service.scheduledStart).getTime()<end&&new Date(service.scheduledEnd).getTime()>start)))return "déjà en rendez-vous";
    return null;
  }
  function employeeAvailable(employeeId:string,line:DraftLine){return employeeUnavailableReason(employeeId,line)===null}
  function existingRoomConflict(roomId:string,line:DraftLine){const d=duration(line);if(!line.time||!d)return false;const start=new Date(casablancaLocalDateTimeToIso(selectedDateKey,line.time)).getTime();const end=start+d*60000;const p=roomPlanning.get(roomId);if(p?.unavailabilities.some(u=>new Date(u.startAt).getTime()<end&&new Date(u.endAt).getTime()>start))return true;return dayAppointments.some(a=>a.services.some(s=>s.room?.id===roomId&&new Date(s.scheduledStart).getTime()<end&&new Date(s.scheduledEnd).getTime()>start))}
  function draftRoomConflict(roomId:string,line:DraftLine){const d=duration(line);if(!line.time||!d)return false;return lines.some(other=>other.key!==line.key&&other.roomId===roomId&&other.time&&duration(other)>0&&overlaps(minutes(line.time),d,minutes(other.time),duration(other)))}
  function roomAvailable(roomId:string,line:DraftLine){return !existingRoomConflict(roomId,line)&&!draftRoomConflict(roomId,line)}

  function changeBookingDate(nextDate:string){
    if(!nextDate||nextDate<minimumBooking.dateKey)return;
    setSelectedDateKey(nextDate);
    setError(null);
    setLoadingDay(true);
    startTransition(async()=>{
      const result=await getPlanningDayForBookingAction({dateKey:nextDate});
      if(!result.ok){setError(result.message);setLoadingDay(false);return}
      setDayAppointments(result.data.appointments);
      setDayEmployees(result.data.employees);
      setDayRooms(result.data.rooms);
      setLoadingDay(false);
      const minimumTime=nextDate===minimumBooking.dateKey?minimumBooking.timeValue:"10:00";
      setLines(current=>current.map(line=>({
        ...line,
        time:line.time<minimumTime?minimumTime:line.time,
        employeeId:"",
        roomId:"",
      })));
    });
  }

  useEffect(()=>{const query=clientQuery.trim();if(client||query.length<2){if(query.length<2)setClients([]);return}const timeout=window.setTimeout(()=>{startTransition(async()=>{const result=await searchClientsAction({query});setClients(result.ok?result.data.clients:[])})},250);return()=>window.clearTimeout(timeout)},[clientQuery,client]);
  function selectClient(item:NewAppointmentClientOption){setClient(item);setClientQuery(`${item.name} · ${item.phone}`);setClientNote(item.internalNote??"");setClients([]);setError(null)}
  function clearSelectedClient(){setClient(null);setClientQuery("");setClientNote("");setClients([])}

  function submit(){setError(null);if(!client&&(!newClientName.trim()||!newClientPhone.trim())){setError("Renseignez le nom et le téléphone de la nouvelle cliente.");return}if(!lines.length){setError("Ajoutez au moins une prestation.");return}for(const line of lines){const service=serviceMap.get(line.serviceId);if(!service||!line.time||!line.employeeId){setError("Chaque prestation doit avoir une heure et une employée.");return}if(service.requiredRoomType&&!line.roomId){setError(`Affectez une salle à « ${service.name} » avant de confirmer.`);return}if(!employeeAvailable(line.employeeId,line)){setError(`L’employée choisie pour « ${service.name} » n’est plus disponible sur ce créneau.`);return}if(line.roomId&&!roomAvailable(line.roomId,line)){setError(`La salle choisie pour « ${service.name} » n’est plus disponible sur ce créneau.`);return}}
    startTransition(async()=>{const result=await createPlannedAppointmentAction({client:client?{type:"existing",clientId:client.id,clientNote:clientNote||null}:{type:"new",name:newClientName.trim(),phone:newClientPhone.trim(),clientNote:clientNote||null},internalNote:note||null,services:lines.map(line=>({serviceId:line.serviceId,scheduledStart:new Date(casablancaLocalDateTimeToIso(selectedDateKey,line.time)),employeeId:line.employeeId,roomId:line.roomId||null,...(line.price!==""?{price:Number(line.price)}:{})}))});if(!result.ok){setError(result.message);return}router.push(`/appointments/${result.data.appointmentId}`);router.refresh()})}

  const total=lines.reduce((sum,line)=>sum+(Number(line.price)||0),0);
  const complete=lines.filter(line=>line.serviceId&&line.time&&line.employeeId&&(!serviceMap.get(line.serviceId)?.requiredRoomType||line.roomId)).length;
  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-violet-100 text-sm font-bold text-violet-700">1</span><div><h3 className="font-semibold text-slate-950">Cliente</h3><p className="text-sm text-slate-500">Nom ou téléphone, sans étape “nouvelle cliente”.</p></div></div>
        <div className="relative mt-4"><input className={field} value={clientQuery} onChange={e=>{if(client)clearSelectedClient();const value=e.target.value;setClientQuery(value);if(/^[+\d\s().-]+$/.test(value))setNewClientPhone(value);else setNewClientName(value)}} placeholder="Rechercher par nom ou téléphone" autoComplete="off"/>{clients.length>0?<div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">{clients.map(item=><button key={item.id} type="button" onClick={()=>selectClient(item)} className="block min-h-11 w-full border-b border-slate-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-50"><strong>{item.name}</strong><span className="ml-2 text-slate-500">{item.phone}</span></button>)}</div>:null}</div>
        {client?<div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm"><div className="flex justify-between gap-3"><div><strong>{client.name}</strong><p className="text-slate-600">{client.phone}</p></div><button type="button" onClick={clearSelectedClient} className="font-semibold">Changer</button></div>{client.internalNote?<div className="mt-3 rounded-xl bg-white/80 p-3"><p className="text-xs font-bold uppercase text-rose-700">♥ Préférences connues</p><p className="mt-1 whitespace-pre-wrap text-sm">{client.internalNote}</p></div>:null}</div>:clientQuery.trim().length>=2&&clients.length===0&&!pending?<div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3"><p className="text-sm font-semibold">Nouvelle cliente</p><p className="mt-1 text-xs text-slate-500">Aucune fiche trouvée. Elle sera créée seulement à la confirmation.</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><input className={field} value={newClientName} onChange={e=>setNewClientName(e.target.value)} placeholder="Nom"/><input className={field} value={newClientPhone} onChange={e=>setNewClientPhone(e.target.value)} placeholder="Téléphone" inputMode="tel"/></div></div>:null}
        {(client||(newClientName.trim()&&newClientPhone.trim()))?<div className="mt-3"><label className="text-sm font-semibold">Préférences cliente</label><textarea className={`${field} mt-1 min-h-20 py-3`} value={clientNote} onChange={e=>setClientNote(e.target.value)} placeholder="Ex. couleur 6.3, préfère Lina, peau sensible…"/><p className="mt-1 text-xs text-slate-500">Conservées sur la fiche cliente pour les prochains rendez-vous.</p></div>:null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-violet-100 text-sm font-bold text-violet-700">2</span><div><h3 className="font-semibold text-slate-950">Construire le rendez-vous</h3><p className="text-sm text-slate-500">Choisissez d’abord la date, puis placez chaque prestation par créneaux de 15 minutes.</p></div></div><button type="button" onClick={addLine} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white"><Plus className="h-4 w-4"/>Ajouter une prestation</button></div>
        <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
          <label className="block text-xs font-bold uppercase tracking-wide text-violet-800"><span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4"/>Date du rendez-vous</span><input type="date" min={minimumBooking.dateKey} value={selectedDateKey} onChange={e=>changeBookingDate(e.target.value)} className={`${field} mt-2 max-w-xs`} /></label>
          <p className="mt-2 text-xs font-medium text-violet-800">Heure de Marrakech · débuts de prestation de 10:00 à 21:00 · pas de 15 min · fin maximale 21:30.</p>
          {loadingDay?<p className="mt-2 text-xs font-semibold text-violet-700">Mise à jour des disponibilités…</p>:null}
        </div>
        <div className="mt-4 space-y-3">{lines.length===0?<button type="button" onClick={addLine} className="w-full rounded-2xl border border-dashed border-violet-300 bg-violet-50/40 p-8 text-sm font-semibold text-violet-800">+ Choisir la première prestation</button>:null}{lines.map((line,index)=>{const selected=serviceMap.get(line.serviceId);const capable=employees.filter(e=>!line.serviceId||e.serviceIds.includes(line.serviceId));const compatibleRooms=rooms.filter(r=>!selected?.requiredRoomType||r.type===selected.requiredRoomType);const d=duration(line);const end=line.time&&d?timeFromMinutes(minutes(line.time)+d):null;return <div key={line.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="mb-3 flex items-center justify-between"><div><strong className="text-sm">{index+1}. {selected?.name??"Prestation"}</strong>{line.time&&end?<p className="mt-0.5 text-xs font-medium text-violet-700">{line.time} → {end}</p>:null}</div><button type="button" aria-label="Supprimer" onClick={()=>setLines(x=>x.filter(v=>v.key!==line.key))} className="rounded-lg p-2 text-rose-700 hover:bg-rose-50"><Trash2 className="h-4 w-4"/></button></div>
          <div className="grid gap-3 md:grid-cols-2"><label className="text-xs font-semibold text-slate-600">Prestation<select className={`${field} mt-1`} value={line.serviceId} onChange={e=>{const next=serviceMap.get(e.target.value);const stillCapable=employees.find(x=>x.id===line.employeeId)?.serviceIds.includes(e.target.value);patchLine(line.key,{serviceId:e.target.value,employeeId:stillCapable?line.employeeId:"",roomId:"",price:next?String(next.defaultPrice):""})}}><option value="">Choisir…</option>{services.map(s=><option key={s.id} value={s.id}>{s.categoryName} · {s.name}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-600">Heure<select className={`${field} mt-1`} value={line.time} onChange={e=>patchLine(line.key,{time:e.target.value,employeeId:"",roomId:""})}>{quarterHourOptions(selectedDateKey===minimumBooking.dateKey?minimumBooking.timeValue:"10:00").filter(time=>{const dur=d||0;return minutes(time)<=21*60 && (!dur || minutes(time)+dur<=21*60+30)}).map(time=><option key={time} value={time}>{time}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-600"><span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5"/>Employée</span><select className={`${field} mt-1`} value={line.employeeId} onChange={e=>patchLine(line.key,{employeeId:e.target.value})}><option value="">Choisir une employée disponible…</option>{capable.map(e=>{const reason=employeeUnavailableReason(e.id,line);return <option key={e.id} value={e.id} disabled={Boolean(reason)}>{e.name}{reason?` — ${reason}`:" — disponible"}</option>})}</select></label>
          <label className="text-xs font-semibold text-slate-600"><span className="inline-flex items-center gap-1"><DoorOpen className="h-3.5 w-3.5"/>Salle</span><select className={`${field} mt-1`} value={line.roomId} onChange={e=>patchLine(line.key,{roomId:e.target.value})}><option value="">{selected?.requiredRoomType?"Choisir une salle disponible…":"Sans salle"}</option>{compatibleRooms.map(r=>{const available=roomAvailable(r.id,line);return <option key={r.id} value={r.id} disabled={!available}>{r.name}{available?"":" — occupée"}</option>})}</select></label>
          <label className="text-xs font-semibold text-slate-600 md:col-span-2">Prix pour ce RDV<input className={`${field} mt-1 max-w-48`} type="number" min="0" step="1" value={line.price} onChange={e=>patchLine(line.key,{price:e.target.value})}/></label></div>
          {selected?<div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-white px-2.5 py-1 font-medium text-slate-600"><Clock3 className="mr-1 inline h-3.5 w-3.5"/>{selected.defaultDurationMinutes} min</span>{line.employeeId&&employeeAvailable(line.employeeId,line)?<span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-800">Employée disponible</span>:null}{line.roomId&&roomAvailable(line.roomId,line)?<span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-800">Salle disponible</span>:null}</div>:null}
        </div>})}</div>
        {lines.length>0?<button type="button" onClick={addLine} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 text-sm font-semibold text-violet-800"><Plus className="h-4 w-4"/>Ajouter la prestation suivante</button>:null}
      </section>
    </div>

    <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-4"><p className="text-xs font-bold uppercase tracking-wider text-violet-700">RDV en préparation</p><p className="mt-1 text-sm font-semibold text-slate-600">{selectedDateKey} · heure de Marrakech</p><h3 className="mt-1 text-lg font-semibold">{client?.name??(newClientName||"Cliente à sélectionner")}</h3><p className="mt-1 text-xs text-slate-500">{complete}/{lines.length} prestation{lines.length>1?"s":""} prête{complete>1?"s":""}</p>
      <div className="mt-4 space-y-2">{lines.map((line,index)=>{const service=serviceMap.get(line.serviceId);const employee=employees.find(e=>e.id===line.employeeId);const room=rooms.find(r=>r.id===line.roomId);const d=duration(line);return <div key={line.key} className="rounded-2xl bg-slate-50 p-3 text-sm"><div className="flex items-start gap-2"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-violet-700">{index+1}</span><div className="min-w-0"><strong>{service?.name??"Prestation à choisir"}</strong><p className="mt-1 text-slate-600">{line.time||"--:--"}{line.time&&d?` → ${timeFromMinutes(minutes(line.time)+d)}`:""} · {employee?.name??"Employée à choisir"}</p>{room?<p className="text-slate-500">{room.name}</p>:null}</div></div></div>})}</div>
      {lines.length>0?<div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4"><span className="text-sm font-semibold text-slate-600">Total prévu</span><strong className="text-xl text-slate-950">{new Intl.NumberFormat("fr-MA").format(total)} DH</strong></div>:null}
      <textarea className={`${field} mt-4 min-h-20 py-3`} value={note} onChange={e=>setNote(e.target.value)} placeholder="Note interne du rendez-vous"/>{error?<div role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800">{error}</div>:null}
      <div className="mt-4 grid gap-2"><button type="button" disabled={pending||!lines.length||complete!==lines.length} onClick={submit} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{pending?"Contrôle final…":<><CheckCircle2 className="h-4 w-4"/>Confirmer le rendez-vous</>}</button><button type="button" onClick={()=>router.push(cancelHref)} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold">Annuler le brouillon</button></div><p className="mt-3 text-xs leading-5 text-slate-500">Les disponibilités sont filtrées pendant la saisie. À la confirmation, SalonFlow recontrôle tout en transaction pour empêcher un chevauchement concurrent.</p>
    </aside>
  </div>
}
