import { prisma } from "@/server/db/prisma";
import { canViewDashboardFinance } from "@/features/dashboard/lib/access";
import type { CurrentUser } from "@/server/permissions";
import { getPlanningDay, parsePlanningDate } from "@/features/planning/server";
import { getCasablancaDayRange } from "@/features/planning/server/casablanca-day";

function addDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}
function mondayOf(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  return addDays(dateKey, -(weekday === 0 ? 6 : weekday - 1));
}
function monthStart(dateKey: string) { return `${dateKey.slice(0, 7)}-01`; }

async function paidAmountBetween(salonId: string, start: Date, end: Date) {
  const result = await prisma.payment.aggregate({
    where: { status: "PAID", paidAt: { gte: start, lt: end }, appointment: { salonId } },
    _sum: { amount: true },
  });
  return Number(result._sum.amount ?? 0);
}

async function completedServicesByEmployee(salonId:string,start:Date,end:Date,employeeNames:Map<string,string>) {
  const rows=await prisma.appointmentService.findMany({
    where:{status:"DONE",performedByEmployeeId:{not:null},appointment:{salonId,scheduledStart:{gte:start,lt:end}}},
    select:{performedByEmployeeId:true,appointmentId:true},
  });
  const map=new Map<string,{appointments:Set<string>;services:number}>();
  for(const row of rows){if(!row.performedByEmployeeId)continue;const v=map.get(row.performedByEmployeeId)??{appointments:new Set<string>(),services:0};v.services++;v.appointments.add(row.appointmentId);map.set(row.performedByEmployeeId,v)}
  return [...map.entries()].map(([employeeId,v])=>({employeeId,name:employeeNames.get(employeeId)??"Employée",completedServices:v.services,appointmentCount:v.appointments.size})).sort((a,b)=>b.completedServices-a.completedServices||a.name.localeCompare(b.name,"fr"));
}

export async function getDashboard(currentUser: CurrentUser) {
  const dateKey=parsePlanningDate(undefined);
  const planning=await getPlanningDay(currentUser,dateKey);
  const todayRange=getCasablancaDayRange(dateKey);
  const weekStartRange=getCasablancaDayRange(mondayOf(dateKey));
  const monthStartRange=getCasablancaDayRange(monthStart(dateKey));
  const employeeNames=new Map(planning.employees.map(e=>[e.id,e.name]));

  const [teamToday,teamWeek,teamMonth]=await Promise.all([
    completedServicesByEmployee(currentUser.salonId,todayRange.start,todayRange.end,employeeNames),
    completedServicesByEmployee(currentUser.salonId,weekStartRange.start,todayRange.end,employeeNames),
    completedServicesByEmployee(currentUser.salonId,monthStartRange.start,todayRange.end,employeeNames),
  ]);

  const operational={dateKey,appointmentCount:planning.appointmentCount,completedCount:planning.completedCount,teamActivity:{today:teamToday,week:teamWeek,month:teamMonth}};
  if(!canViewDashboardFinance(currentUser))return {operational,finance:null};
  const [today,week,month]=await Promise.all([
    paidAmountBetween(currentUser.salonId,todayRange.start,todayRange.end),
    paidAmountBetween(currentUser.salonId,weekStartRange.start,todayRange.end),
    paidAmountBetween(currentUser.salonId,monthStartRange.start,todayRange.end),
  ]);
  return {operational,finance:{today,week,month}};
}
