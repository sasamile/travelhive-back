import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';

export interface GetAgencyDashboardInput {
  agencyId: bigint;
  userId: string;
}

export interface GetAgencyDashboardResponse {
  agency: {
    idAgency: string;
    nameAgency: string;
    email?: string;
    phone?: string;
    nit?: string;
    rntNumber?: string;
    picture?: string;
    status: string;
    approvalStatus: string;
    createdAt: Date;
    updatedAt: Date;
  };
  metrics: {
    totalTrips: number;
    activeTrips: number;
    totalExpeditions: number;
    upcomingExpeditions: number;
    totalBookings: number;
    confirmedBookings: number;
    pendingBookings: number;
    totalRevenue: number;
    currency: string;
    totalMembers: number;
    activeMembers: number;
  };
  recentActivity: {
    recentBookings: Array<{
      idBooking: string;
      status: string;
      totalBuy: number;
      currency: string;
      dateBuy: Date;
      tripTitle: string;
      ownerName: string;
      ownerEmail: string;
    }>;
    upcomingExpeditions: Array<{
      idExpedition: string;
      tripTitle: string;
      startDate: Date;
      endDate: Date;
      capacityTotal: number;
      capacityAvailable: number;
      occupancyPercentage: number;
    }>;
  };
  quickStats: {
    bookingsThisMonth: number;
    revenueThisMonth: number;
    bookingsLastMonth: number;
    revenueLastMonth: number;
    monthOverMonthChange: number;
  };
}

@Injectable()
export class GetAgencyDashboardUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: GetAgencyDashboardInput): Promise<GetAgencyDashboardResponse> {
    // Verificar que el usuario pertenezca a la agencia y sea admin
    const membership = await this.prisma.$queryRaw<any[]>`
      SELECT 
        id,
        id_agency as "idAgency",
        user_id as "idUser",
        role,
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM agency_members
      WHERE id_agency = ${input.agencyId}::bigint 
        AND user_id = ${input.userId}
        AND role = 'admin'
      LIMIT 1
    `;

    if (!membership || membership.length === 0) {
      throw new ForbiddenException('No tienes permiso para acceder al dashboard de esta agencia');
    }

    // Obtener información de la agencia
    const agency = await this.prisma.agency.findUnique({
      where: { idAgency: input.agencyId },
    });

    if (!agency) {
      throw new ForbiddenException('Agencia no encontrada');
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Obtener métricas generales
    const [
      totalTrips,
      activeTrips,
      totalExpeditions,
      upcomingExpeditions,
      totalBookings,
      confirmedBookings,
      pendingBookings,
      bookingsThisMonth,
      bookingsLastMonth,
      totalMembers,
      isActiveColumnExists,
    ] = await Promise.all([
      // Total de trips
      this.prisma.trip.count({
        where: { idAgency: input.agencyId, type: 'TRIP' },
      }),
      // Trips activos
      this.prisma.trip.count({
        where: {
          idAgency: input.agencyId,
          type: 'TRIP',
          isActive: true,
          status: 'PUBLISHED',
        },
      }),
      // Total de expediciones
      this.prisma.expedition.count({
        where: {
          trip: { idAgency: input.agencyId },
        },
      }),
      // Expediciones próximas (próximos 30 días)
      this.prisma.expedition.count({
        where: {
          trip: { idAgency: input.agencyId },
          startDate: {
            gte: now,
            lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      // Total de reservas
      this.prisma.booking.count({
        where: { idAgency: input.agencyId },
      }),
      // Reservas confirmadas
      this.prisma.booking.count({
        where: { idAgency: input.agencyId, status: 'CONFIRMED' },
      }),
      // Reservas pendientes
      this.prisma.booking.count({
        where: { idAgency: input.agencyId, status: 'PENDING' },
      }),
      // Reservas este mes
      this.prisma.booking.count({
        where: {
          idAgency: input.agencyId,
          status: 'CONFIRMED',
          dateBuy: { gte: startOfMonth },
        },
      }),
      // Reservas mes pasado
      this.prisma.booking.count({
        where: {
          idAgency: input.agencyId,
          status: 'CONFIRMED',
          dateBuy: {
            gte: startOfLastMonth,
            lte: endOfLastMonth,
          },
        },
      }),
      // Total de miembros
      this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count
        FROM agency_members
        WHERE id_agency = ${input.agencyId}::bigint
      `,
      // Verificar si la columna is_active existe
      this.prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'agency_members' 
          AND column_name = 'is_active'
        ) as exists
      `,
    ]);

    // Contar miembros activos según si la columna existe
    const hasIsActiveColumn = isActiveColumnExists[0]?.exists || false;
    let activeMembersResult: Array<{ count: bigint }>;
    
    if (hasIsActiveColumn) {
      activeMembersResult = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count
        FROM agency_members
        WHERE id_agency = ${input.agencyId}::bigint
        AND is_active = true
      `;
    } else {
      // Si la columna no existe, todos los miembros se consideran activos
      activeMembersResult = totalMembers;
    }

    // Obtener ingresos totales y del mes
    const revenueData = await this.prisma.booking.aggregate({
      where: {
        idAgency: input.agencyId,
        status: 'CONFIRMED',
      },
      _sum: {
        totalBuy: true,
      },
    });

    const revenueThisMonthData = await this.prisma.booking.aggregate({
      where: {
        idAgency: input.agencyId,
        status: 'CONFIRMED',
        dateBuy: { gte: startOfMonth },
      },
      _sum: {
        totalBuy: true,
      },
    });

    const revenueLastMonthData = await this.prisma.booking.aggregate({
      where: {
        idAgency: input.agencyId,
        status: 'CONFIRMED',
        dateBuy: {
          gte: startOfLastMonth,
          lte: endOfLastMonth,
        },
      },
      _sum: {
        totalBuy: true,
      },
    });

    // Obtener la moneda más común
    const currencyData = await this.prisma.booking.findFirst({
      where: {
        idAgency: input.agencyId,
        status: 'CONFIRMED',
      },
      select: {
        currency: true,
      },
      orderBy: {
        dateBuy: 'desc',
      },
    });

    const currency = currencyData?.currency || 'USD';

    // Calcular cambio mes a mes
    const revenueThisMonth = Number(revenueThisMonthData._sum.totalBuy || 0);
    const revenueLastMonth = Number(revenueLastMonthData._sum.totalBuy || 0);
    const monthOverMonthChange =
      revenueLastMonth > 0
        ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100
        : revenueThisMonth > 0
          ? 100
          : 0;

    // Obtener reservas recientes (últimas 10)
    const recentBookings = await this.prisma.booking.findMany({
      where: { idAgency: input.agencyId },
      take: 10,
      orderBy: { dateBuy: 'desc' },
      select: {
        idBooking: true,
        status: true,
        totalBuy: true,
        currency: true,
        dateBuy: true,
        trip: {
          select: {
            title: true,
          },
        },
        owner: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    // Obtener expediciones próximas con ocupación
    const upcomingExpeditionsData = await this.prisma.expedition.findMany({
      where: {
        trip: { idAgency: input.agencyId },
        startDate: {
          gte: now,
          lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
      },
      take: 5,
      orderBy: { startDate: 'asc' },
      select: {
        idExpedition: true,
        startDate: true,
        endDate: true,
        capacityTotal: true,
        capacityAvailable: true,
        trip: {
          select: {
            title: true,
          },
        },
        bookings: {
          where: {
            status: 'CONFIRMED',
          },
          select: {
            bookingItems: {
              select: {
                quantity: true,
              },
            },
          },
        },
      },
    });

    const upcomingExpeditionsWithOccupancy = upcomingExpeditionsData.map((exp) => {
      const totalBookedSeats = exp.bookings.reduce(
        (sum, booking) =>
          sum + booking.bookingItems.reduce((itemSum, item) => itemSum + item.quantity, 0),
        0,
      );
      const occupancyPercentage = exp.capacityTotal > 0 
        ? Math.round((totalBookedSeats / exp.capacityTotal) * 100)
        : 0;

      return {
        idExpedition: exp.idExpedition.toString(),
        tripTitle: exp.trip.title,
        startDate: exp.startDate,
        endDate: exp.endDate,
        capacityTotal: exp.capacityTotal,
        capacityAvailable: exp.capacityAvailable,
        occupancyPercentage,
      };
    });

    const totalMembersCount = Number(totalMembers[0]?.count || 0);
    const activeMembersCount = Number(activeMembersResult[0]?.count || totalMembersCount);

    return {
      agency: {
        idAgency: agency.idAgency.toString(),
        nameAgency: agency.nameAgency,
        email: agency.email || undefined,
        phone: agency.phone || undefined,
        nit: agency.nit || undefined,
        rntNumber: agency.rntNumber || undefined,
        picture: agency.picture || undefined,
        status: agency.status,
        approvalStatus: agency.approvalStatus,
        createdAt: agency.createdAt,
        updatedAt: agency.updatedAt,
      },
      metrics: {
        totalTrips,
        activeTrips,
        totalExpeditions,
        upcomingExpeditions,
        totalBookings,
        confirmedBookings,
        pendingBookings,
        totalRevenue: Number(revenueData._sum.totalBuy || 0),
        currency,
        totalMembers: totalMembersCount,
        activeMembers: activeMembersCount,
      },
      recentActivity: {
        recentBookings: recentBookings.map((booking) => ({
          idBooking: booking.idBooking.toString(),
          status: booking.status,
          totalBuy: Number(booking.totalBuy),
          currency: booking.currency,
          dateBuy: booking.dateBuy,
          tripTitle: booking.trip.title,
          ownerName: booking.owner.name || '',
          ownerEmail: booking.owner.email,
        })),
        upcomingExpeditions: upcomingExpeditionsWithOccupancy,
      },
      quickStats: {
        bookingsThisMonth,
        revenueThisMonth,
        bookingsLastMonth,
        revenueLastMonth,
        monthOverMonthChange: Math.round(monthOverMonthChange * 10) / 10,
      },
    };
  }
}
