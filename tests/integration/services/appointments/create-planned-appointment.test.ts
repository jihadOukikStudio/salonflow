import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { CurrentUser } from "@/server/permissions";
import { createPlannedAppointment } from "@/server/services/appointments/create-planned-appointment";
import { BusinessRuleError } from "@/server/services/errors";
import { cleanDatabase } from "../../helpers/database";
import { testPrisma } from "../../helpers/prisma";

async function setup() {
  const salon=await testPrisma.salon.create({data:{name:`Salon ${crypto.randomUUID()}`}});
  const user=await testPrisma.user.create({data:{salonId:salon.id,email:`${crypto.randomUUID()}@test.local`,passwordHash:"test",firstName:"Admin",role:"ADMIN",canManageSalon:true}});
  const employee=await testPrisma.employee.create({data:{salonId:salon.id,firstName:"Lina"}});
  const room=await testPrisma.room.create({data:{salonId:salon.id,name:"Salle soin",type:"TREATMENT_ROOM",capacity:1}});
  const category=await testPrisma.serviceCategory.create({data:{salonId:salon.id,name:"Cheveux"}});
  const soin=await testPrisma.service.create({data:{salonId:salon.id,categoryId:category.id,name:"Soin cheveux",defaultDurationMinutes:60,defaultPrice:300,requiredRoomType:"TREATMENT_ROOM"}});
  const brushing=await testPrisma.service.create({data:{salonId:salon.id,categoryId:category.id,name:"Brushing",defaultDurationMinutes:30,defaultPrice:150}});
  const client=await testPrisma.client.create({data:{salonId:salon.id,name:"Fatima",phone:`+2126${crypto.randomUUID().replaceAll("-","").slice(0,8)}`}});
  const currentUser:CurrentUser={id:user.id,salonId:salon.id,role:user.role,canManageSalon:user.canManageSalon,isActive:user.isActive};
  return {salon,user,employee,room,soin,brushing,client,currentUser};
}

describe("createPlannedAppointment — planning prestation par prestation",()=>{
  beforeEach(cleanDatabase);
  afterAll(async()=>{await cleanDatabase();await testPrisma.$disconnect()});

  it("autorise la même employée sur deux prestations consécutives du même RDV",async()=>{
    const c=await setup();
    const result=await createPlannedAppointment(c.currentUser,{client:{type:"existing",clientId:c.client.id},services:[
      {serviceId:c.soin.id,scheduledStart:new Date("2099-09-10T10:00:00.000Z"),employeeId:c.employee.id,roomId:c.room.id},
      {serviceId:c.brushing.id,scheduledStart:new Date("2099-09-10T11:00:00.000Z"),employeeId:c.employee.id},
    ]});
    expect(result.services).toHaveLength(2);
    expect(result.estimatedDurationMinutes).toBe(90);
    expect(result.services.every(s=>s.assignedEmployeeId===c.employee.id)).toBe(true);
  });

  it("refuse la même employée si deux prestations du brouillon se chevauchent",async()=>{
    const c=await setup();
    await expect(createPlannedAppointment(c.currentUser,{client:{type:"existing",clientId:c.client.id},services:[
      {serviceId:c.soin.id,scheduledStart:new Date("2099-09-10T10:00:00.000Z"),employeeId:c.employee.id,roomId:c.room.id},
      {serviceId:c.brushing.id,scheduledStart:new Date("2099-09-10T10:45:00.000Z"),employeeId:c.employee.id},
    ]})).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("autorise une salle à être réutilisée exactement à la fin de la prestation précédente",async()=>{
    const c=await setup();
    const soin2=await testPrisma.service.create({data:{salonId:c.salon.id,categoryId:c.soin.categoryId,name:"Soin visage",defaultDurationMinutes:30,defaultPrice:200,requiredRoomType:"TREATMENT_ROOM"}});
    const result=await createPlannedAppointment(c.currentUser,{client:{type:"existing",clientId:c.client.id},services:[
      {serviceId:c.soin.id,scheduledStart:new Date("2099-09-10T10:00:00.000Z"),employeeId:c.employee.id,roomId:c.room.id},
      {serviceId:soin2.id,scheduledStart:new Date("2099-09-10T11:00:00.000Z"),employeeId:c.employee.id,roomId:c.room.id},
    ]});
    expect(result.services).toHaveLength(2);
  });

  it("refuse un créneau déjà occupé par un autre RDV",async()=>{
    const c=await setup();
    const other=await testPrisma.client.create({data:{salonId:c.salon.id,name:"Autre",phone:"+212600000099"}});
    await testPrisma.appointment.create({data:{salonId:c.salon.id,clientId:other.id,scheduledStart:new Date("2099-09-10T10:30:00.000Z"),estimatedDurationMinutes:30,createdByUserId:c.user.id,services:{create:{serviceNameSnapshot:"Occupée",durationMinutes:30,scheduledStart:new Date("2099-09-10T10:30:00.000Z"),price:100,assignedEmployeeId:c.employee.id}}}});
    await expect(createPlannedAppointment(c.currentUser,{client:{type:"existing",clientId:c.client.id},services:[{serviceId:c.soin.id,scheduledStart:new Date("2099-09-10T10:00:00.000Z"),employeeId:c.employee.id,roomId:c.room.id}]})).rejects.toBeInstanceOf(BusinessRuleError);
  });
  it("conserve le prix catalogue comme base quand le prix du RDV est personnalisé",async()=>{
    const c=await setup();
    const result=await createPlannedAppointment(c.currentUser,{client:{type:"existing",clientId:c.client.id},services:[
      {serviceId:c.brushing.id,scheduledStart:new Date("2099-09-10T12:00:00.000Z"),employeeId:c.employee.id,price:190},
    ]});
    expect(Number(result.services[0]?.price)).toBe(190);
    expect(Number(result.services[0]?.basePriceSnapshot)).toBe(150);
  });

});
