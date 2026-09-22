export type NewAppointmentClientOption = {
  id: string;
  name: string;
  phone: string;
  internalNote: string | null;
};

export type NewAppointmentServiceOption = {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  defaultDurationMinutes: number | null;
  defaultPrice: number;
  isStartingPrice: boolean;
  requiredRoomType: "HAMAM" | "TREATMENT_ROOM" | null;
};

export type NewAppointmentEmployeeOption = {
  id: string;
  name: string;
  serviceIds: string[];
};

export type NewAppointmentRoomOption = {
  id: string;
  name: string;
  type: "HAMAM" | "TREATMENT_ROOM";
  capacity: number;
};

export type NewAppointmentOptions = {
  services: NewAppointmentServiceOption[];
  employees: NewAppointmentEmployeeOption[];
  rooms: NewAppointmentRoomOption[];
};
