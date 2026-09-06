export type NewAppointmentClientOption = {
  id: string;
  name: string;
  phone: string;
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

export type NewAppointmentOptions = {
  services: NewAppointmentServiceOption[];
};
