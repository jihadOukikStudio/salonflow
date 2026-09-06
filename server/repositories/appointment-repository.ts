import type { AppointmentStatus } from "@/app/generated/prisma/client";
import { prisma } from "@/server/db/prisma";

type ListAppointmentsParams = {
  salonId: string;
  from: Date;
  to: Date;
  statuses?: AppointmentStatus[];
};

type UpdateAppointmentParams = {
  salonId: string;
  appointmentId: string;
  scheduledStart?: Date;
  estimatedDurationMinutes?: number;
  internalNote?: string | null;
  status?: AppointmentStatus;
};

export const appointmentRepository = {
  findById(params: { salonId: string; appointmentId: string }) {
    return prisma.appointment.findFirst({
      where: {
        id: params.appointmentId,
        salonId: params.salonId,
      },
      include: {
        client: true,

        services: {
          include: {
            service: true,
            assignedEmployee: true,
            performedByEmployee: true,
            room: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },

        parallelGroups: {
          include: {
            services: true,
          },
        },

        payment: true,

        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },

        cancelledByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  },

  list(params: ListAppointmentsParams) {
    return prisma.appointment.findMany({
      where: {
        salonId: params.salonId,

        scheduledStart: {
          gte: params.from,
          lt: params.to,
        },

        ...(params.statuses?.length
          ? {
              status: {
                in: params.statuses,
              },
            }
          : {}),
      },

      include: {
        client: true,

        services: {
          include: {
            assignedEmployee: true,
            performedByEmployee: true,
            room: true,
          },
        },

        payment: true,
      },

      orderBy: {
        scheduledStart: "asc",
      },
    });
  },

  update(params: UpdateAppointmentParams) {
    const {
      salonId,
      appointmentId,
      scheduledStart,
      estimatedDurationMinutes,
      internalNote,
      status,
    } = params;

    return prisma.appointment.updateMany({
      where: {
        id: appointmentId,
        salonId,
      },

      data: {
        ...(scheduledStart !== undefined && {
          scheduledStart,
        }),

        ...(estimatedDurationMinutes !== undefined && {
          estimatedDurationMinutes,
        }),

        ...(internalNote !== undefined && {
          internalNote,
        }),

        ...(status !== undefined && {
          status,
        }),
      },
    });
  },

  cancel(params: {
    salonId: string;
    appointmentId: string;
    cancelledByUserId: string;
    cancelledAt: Date;
  }) {
    return prisma.appointment.updateMany({
      where: {
        id: params.appointmentId,
        salonId: params.salonId,

        status: {
          not: "CANCELLED",
        },
      },

      data: {
        status: "CANCELLED",
        cancelledByUserId: params.cancelledByUserId,
        cancelledAt: params.cancelledAt,
      },
    });
  },

  findServiceById(params: { salonId: string; appointmentServiceId: string }) {
    return prisma.appointmentService.findFirst({
      where: {
        id: params.appointmentServiceId,

        appointment: {
          salonId: params.salonId,
        },
      },

      include: {
        appointment: true,
        service: true,
        assignedEmployee: true,
        performedByEmployee: true,
        room: true,
      },
    });
  },
};
