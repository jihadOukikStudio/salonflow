-- Employee skills are queried by service during booking-capacity checks.
CREATE INDEX "employee_skills_serviceId_idx" ON "employee_skills"("serviceId");
