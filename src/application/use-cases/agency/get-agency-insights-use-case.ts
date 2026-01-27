import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';

export interface GetAgencyInsightsInput {
  agencyId: bigint;
  userId: string;
  startDate?: Date;
  endDate?: Date;
}

export interface GetAgencyInsightsResponse {
  stats: {
    avgBookingValue: {
      value: number;
      currency: string;
      change: number; // Porcentaje de cambio vs período anterior
      target: number; // Porcentaje del objetivo alcanzado
    };
    customerLTV: {
      value: number;
      currency: string;
      change: number; // Porcentaje de cambio vs período anterior
      retention: number; // Porcentaje de retención estimado
    };
    conversionRate: {
      value: number; // Porcentaje
      change: number; // Porcentaje de cambio vs período anterior
      status: 'increasing' | 'decreasing' | 'stable';
    };
  };
  revenueGrowth: {
    currentYear: Array<{
      month: string; // "May", "Jun", etc.
      revenue: number;
      currency: string;
    }>;
    lastYear: Array<{
      month: string;
      revenue: number;
      currency: string;
    }>;
  };
  topDestinations: Array<{
    destination: string; // Nombre de la ciudad
    bookings: number;
    percentage: number; // Porcentaje del total
  }>;
  optimizationChecklist: Array<{
    id: string;
    type: 'completed' | 'warning' | 'pending';
    title: string;
    description: string;
    actionLabel?: string;
    actionUrl?: string;
  }>;
}

@Injectable()
export class GetAgencyInsightsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: GetAgencyInsightsInput): Promise<GetAgencyInsightsResponse> {
    // Verificar que el usuario pertenezca a la agencia
    const memberships = await this.prisma.$queryRaw<any[]>`
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
        AND role IN ('admin', 'editor')
      LIMIT 1
    `;

    if (!memberships || memberships.length === 0) {
      throw new ForbiddenException('No tienes permiso para ver los insights de esta agencia');
    }

    const now = new Date();
    const startDate = input.startDate || new Date(now.getFullYear(), now.getMonth() - 5, 1); // Últimos 6 meses por defecto
    const endDate = input.endDate || now;

    // Calcular fecha de inicio del período anterior para comparaciones
    const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const previousStartDate = new Date(startDate);
    previousStartDate.setDate(previousStartDate.getDate() - periodDays);
    const previousEndDate = new Date(startDate);

    // Obtener todas las reservas confirmadas del período actual
    const currentPeriodBookings = await this.prisma.booking.findMany({
      where: {
        idAgency: input.agencyId,
        status: 'CONFIRMED',
        dateBuy: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        idBooking: true,
        totalBuy: true,
        currency: true,
        dateBuy: true,
        ownerBuy: true,
        trip: {
          select: {
            idTrip: true,
            title: true,
            city: {
              select: {
                nameCity: true,
              },
            },
          },
        },
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Obtener reservas del período anterior para comparaciones
    const previousPeriodBookings = await this.prisma.booking.findMany({
      where: {
        idAgency: input.agencyId,
        status: 'CONFIRMED',
        dateBuy: {
          gte: previousStartDate,
          lt: startDate,
        },
      },
    });

    // Calcular estadísticas
    const currentTotalRevenue = currentPeriodBookings.reduce(
      (sum, b) => sum + Number(b.totalBuy),
      0,
    );
    const currentAvgBookingValue =
      currentPeriodBookings.length > 0 ? currentTotalRevenue / currentPeriodBookings.length : 0;
    const previousAvgBookingValue =
      previousPeriodBookings.length > 0
        ? previousPeriodBookings.reduce((sum, b) => sum + Number(b.totalBuy), 0) /
          previousPeriodBookings.length
        : 0;
    const avgBookingValueChange =
      previousAvgBookingValue > 0
        ? ((currentAvgBookingValue - previousAvgBookingValue) / previousAvgBookingValue) * 100
        : 0;

    // Customer LTV: promedio de ingresos totales por cliente
    const customerRevenueMap = new Map<string, number>();
    currentPeriodBookings.forEach((booking) => {
      const currentRevenue = customerRevenueMap.get(booking.ownerBuy) || 0;
      customerRevenueMap.set(booking.ownerBuy, currentRevenue + Number(booking.totalBuy));
    });
    const customerLTVs = Array.from(customerRevenueMap.values());
    const avgCustomerLTV =
      customerLTVs.length > 0
        ? customerLTVs.reduce((sum, ltv) => sum + ltv, 0) / customerLTVs.length
        : 0;

    // Calcular LTV del período anterior
    const previousCustomerRevenueMap = new Map<string, number>();
    previousPeriodBookings.forEach((booking) => {
      const currentRevenue = previousCustomerRevenueMap.get(booking.ownerBuy) || 0;
      previousCustomerRevenueMap.set(booking.ownerBuy, currentRevenue + Number(booking.totalBuy));
    });
    const previousCustomerLTVs = Array.from(previousCustomerRevenueMap.values());
    const previousAvgCustomerLTV =
      previousCustomerLTVs.length > 0
        ? previousCustomerLTVs.reduce((sum, ltv) => sum + ltv, 0) / previousCustomerLTVs.length
        : 0;
    const customerLTVChange =
      previousAvgCustomerLTV > 0
        ? ((avgCustomerLTV - previousAvgCustomerLTV) / previousAvgCustomerLTV) * 100
        : 0;

    // Conversion Rate: CONFIRMED / (CONFIRMED + PENDING + CANCELLED)
    const allBookings = await this.prisma.booking.findMany({
      where: {
        idAgency: input.agencyId,
        dateBuy: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          in: ['CONFIRMED', 'PENDING', 'CANCELLED'],
        },
      },
    });
    const confirmedCount = allBookings.filter((b) => b.status === 'CONFIRMED').length;
    const conversionRate =
      allBookings.length > 0 ? (confirmedCount / allBookings.length) * 100 : 0;

    // Calcular conversion rate del período anterior
    const previousAllBookings = await this.prisma.booking.findMany({
      where: {
        idAgency: input.agencyId,
        dateBuy: {
          gte: previousStartDate,
          lt: startDate,
        },
        status: {
          in: ['CONFIRMED', 'PENDING', 'CANCELLED'],
        },
      },
    });
    const previousConfirmedCount = previousAllBookings.filter((b) => b.status === 'CONFIRMED').length;
    const previousConversionRate =
      previousAllBookings.length > 0
        ? (previousConfirmedCount / previousAllBookings.length) * 100
        : 0;
    const conversionRateChange = conversionRate - previousConversionRate;

    // Revenue Growth: agrupar por mes
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    // Ingresos del año actual
    const currentYearStart = new Date(now.getFullYear(), 0, 1);
    const currentYearBookings = await this.prisma.booking.findMany({
      where: {
        idAgency: input.agencyId,
        status: 'CONFIRMED',
        dateBuy: {
          gte: currentYearStart,
          lte: now,
        },
      },
    });

    const currentYearRevenueByMonth = new Map<number, number>();
    currentYearBookings.forEach((booking) => {
      const month = new Date(booking.dateBuy).getMonth();
      const current = currentYearRevenueByMonth.get(month) || 0;
      currentYearRevenueByMonth.set(month, current + Number(booking.totalBuy));
    });

    const currentYearRevenue = Array.from({ length: 12 }, (_, i) => ({
      month: monthNames[i],
      revenue: currentYearRevenueByMonth.get(i) || 0,
      currency: currentYearBookings[0]?.currency || 'USD',
    }));

    // Ingresos del año anterior
    const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
    const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31);
    const lastYearBookings = await this.prisma.booking.findMany({
      where: {
        idAgency: input.agencyId,
        status: 'CONFIRMED',
        dateBuy: {
          gte: lastYearStart,
          lte: lastYearEnd,
        },
      },
    });

    const lastYearRevenueByMonth = new Map<number, number>();
    lastYearBookings.forEach((booking) => {
      const month = new Date(booking.dateBuy).getMonth();
      const current = lastYearRevenueByMonth.get(month) || 0;
      lastYearRevenueByMonth.set(month, current + Number(booking.totalBuy));
    });

    const lastYearRevenue = Array.from({ length: 12 }, (_, i) => ({
      month: monthNames[i],
      revenue: lastYearRevenueByMonth.get(i) || 0,
      currency: lastYearBookings[0]?.currency || 'USD',
    }));

    // Top Destinations: contar reservas por ciudad
    const destinationCounts = new Map<string, number>();
    currentPeriodBookings.forEach((booking) => {
      const cityName = booking.trip.city.nameCity;
      const current = destinationCounts.get(cityName) || 0;
      destinationCounts.set(cityName, current + 1);
    });

    const totalBookingsForDestinations = Array.from(destinationCounts.values()).reduce(
      (sum, count) => sum + count,
      0,
    );

    const topDestinations = Array.from(destinationCounts.entries())
      .map(([destination, bookings]) => ({
        destination,
        bookings,
        percentage:
          totalBookingsForDestinations > 0
            ? Math.round((bookings / totalBookingsForDestinations) * 100)
            : 0,
      }))
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, 5);

    // Optimization Checklist
    const optimizationChecklist: Array<{
      id: string;
      type: 'completed' | 'warning' | 'pending';
      title: string;
      description: string;
      actionLabel?: string;
      actionUrl?: string;
    }> = [];

    // 1. Verificar si hay viajes con bajo rendimiento
    const tripsWithBookings = await this.prisma.trip.findMany({
      where: {
        idAgency: input.agencyId,
        isActive: true,
        status: 'PUBLISHED',
      },
      select: {
        idTrip: true,
        title: true,
        expeditions: {
          select: {
            idExpedition: true,
            bookings: {
              where: {
                status: 'CONFIRMED',
              },
              select: {
                idBooking: true,
              },
            },
          },
        },
        bookings: {
          where: {
            status: 'CONFIRMED',
            dateBuy: {
              gte: startDate,
              lte: endDate,
            },
          },
          select: {
            idBooking: true,
          },
        },
      },
    });

    // Calcular promedio de reservas por viaje
    const avgBookingsPerTrip =
      tripsWithBookings.length > 0
        ? tripsWithBookings.reduce((sum, trip) => sum + trip.bookings.length, 0) /
          tripsWithBookings.length
        : 0;

    // Encontrar viajes con bajo rendimiento (< 50% del promedio)
    const underperformingTrips = tripsWithBookings.filter(
      (trip) => trip.bookings.length < avgBookingsPerTrip * 0.5 && trip.bookings.length > 0,
    );

    if (underperformingTrips.length > 0) {
      const trip = underperformingTrips[0];
      const bookingRate = trip.bookings.length / avgBookingsPerTrip;
      optimizationChecklist.push({
        id: `underperforming-${trip.idTrip}`,
        type: 'warning',
        title: `Underperforming: ${trip.title}`,
        description: `Booking rate is ${Math.round((1 - bookingRate) * 100)}% lower than average. Consider refreshing the gallery or launching a flash sale.`,
        actionLabel: 'LAUNCH PROMO',
        actionUrl: `/agencies/trips/${trip.idTrip}`,
      });
    }

    // 2. Verificar expediciones próximas con baja ocupación
    const upcomingExpeditions = await this.prisma.expedition.findMany({
      where: {
        trip: {
          idAgency: input.agencyId,
          isActive: true,
        },
        startDate: {
          gte: now,
          lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // Próximos 30 días
        },
        status: {
          in: ['AVAILABLE', 'FULL'],
        },
      },
      select: {
        idExpedition: true,
        capacityTotal: true,
        startDate: true,
        bookings: {
          where: {
            status: 'CONFIRMED',
          },
          select: {
            idBooking: true,
            bookingItems: {
              select: {
                quantity: true,
              },
            },
          },
        },
        trip: {
          select: {
            idTrip: true,
            title: true,
          },
        },
      },
    });

    const lowOccupancyExpeditions = upcomingExpeditions.filter((exp) => {
      const totalBookedSeats = exp.bookings.reduce(
        (sum, booking) =>
          sum +
          booking.bookingItems.reduce((itemSum, item) => itemSum + item.quantity, 0),
        0,
      );
      const occupancyPercentage = (totalBookedSeats / exp.capacityTotal) * 100;
      return occupancyPercentage < 30 && occupancyPercentage > 0; // Menos del 30% ocupado pero tiene algunas reservas
    });

    if (lowOccupancyExpeditions.length > 0) {
      const exp = lowOccupancyExpeditions[0];
      const totalBookedSeats = exp.bookings.reduce(
        (sum, booking) =>
          sum +
          booking.bookingItems.reduce((itemSum, item) => itemSum + item.quantity, 0),
        0,
      );
      const occupancyPercentage = Math.round((totalBookedSeats / exp.capacityTotal) * 100);
      optimizationChecklist.push({
        id: `low-occupancy-${exp.idExpedition}`,
        type: 'warning',
        title: `Low Occupancy: ${exp.trip.title}`,
        description: `Only ${occupancyPercentage}% booked for departure on ${new Date(exp.startDate).toLocaleDateString()}. Consider promotional pricing.`,
        actionLabel: 'VIEW EXPEDITION',
        actionUrl: `/agencies/trips/${exp.trip.idTrip}/expeditions/${exp.idExpedition}`,
      });
    }

    // 3. Verificar si hay muchos carritos abandonados (reservas PENDING antiguas)
    const abandonedCarts = await this.prisma.booking.count({
      where: {
        idAgency: input.agencyId,
        status: 'PENDING',
        createdAt: {
          lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // Más de 7 días
        },
      },
    });

    if (abandonedCarts > 10) {
      optimizationChecklist.push({
        id: 'abandoned-carts',
        type: 'pending',
        title: 'Email Campaign Retargeting',
        description: `${abandonedCarts} users abandoned carts last week. Automate follow-up emails with a 5% discount code.`,
      });
    }

    // 4. Marcar como completado si no hay problemas críticos
    if (optimizationChecklist.length === 0) {
      optimizationChecklist.push({
        id: 'all-optimized',
        type: 'completed',
        title: 'All Systems Optimized',
        description: 'Your expeditions are performing well. Keep monitoring for opportunities to improve.',
      });
    }

    // Obtener la moneda más común
    const currencyCounts = new Map<string, number>();
    currentPeriodBookings.forEach((booking) => {
      const count = currencyCounts.get(booking.currency) || 0;
      currencyCounts.set(booking.currency, count + 1);
    });
    const mostCommonCurrency =
      Array.from(currencyCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'USD';

    return {
      stats: {
        avgBookingValue: {
          value: currentAvgBookingValue,
          currency: mostCommonCurrency,
          change: avgBookingValueChange,
          target: 70, // Porcentaje del objetivo (puede ser configurable)
        },
        customerLTV: {
          value: avgCustomerLTV,
          currency: mostCommonCurrency,
          change: customerLTVChange,
          retention: 85, // Porcentaje de retención estimado (puede calcularse mejor)
        },
        conversionRate: {
          value: conversionRate,
          change: conversionRateChange,
          status:
            conversionRateChange > 1
              ? 'increasing'
              : conversionRateChange < -1
                ? 'decreasing'
                : 'stable',
        },
      },
      revenueGrowth: {
        currentYear: currentYearRevenue,
        lastYear: lastYearRevenue,
      },
      topDestinations: topDestinations,
      optimizationChecklist: optimizationChecklist,
    };
  }
}
