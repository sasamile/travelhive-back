import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';

export interface GetTripStatsInput {
  tripId: bigint;
  agencyId: bigint;
  userId: string;
}

export interface GetTripStatsResponse {
  trip: {
    idTrip: string;
    title: string;
    status: string;
    isActive: boolean;
  };
  promoter: {
    id: string;
    code: string;
    name: string;
    email: string | null;
    phone: string | null;
    referralCount: number;
    isActive: boolean;
  } | null;
  monthlyStats: {
    currentMonth: {
      bookings: number;
      revenue: number;
      currency: string;
      averageBookingValue: number;
      discountCodesUsed: number;
      totalDiscountAmount: number;
    };
    previousMonth: {
      bookings: number;
      revenue: number;
      currency: string;
      averageBookingValue: number;
    };
    change: {
      bookings: number; // Porcentaje
      revenue: number; // Porcentaje
    };
  };
  discountCodes: Array<{
    code: string;
    discountType: string;
    value: number;
    timesUsed: number;
    totalDiscountAmount: number;
    maxUses: number | null;
    usedCount: number;
    active: boolean;
  }>;
  totalStats: {
    totalBookings: number;
    totalRevenue: number;
    currency: string;
    totalDiscountAmount: number;
    averageBookingValue: number;
    conversionRate: number; // CONFIRMED / (CONFIRMED + PENDING + CANCELLED)
  };
  bookingHistory: Array<{
    idBooking: string;
    status: string;
    dateBuy: string;
    totalBuy: number;
    subtotal: number;
    discountAmount: number;
    discountCode: string | null;
    currency: string;
    transactionId: string | null;
    customer: {
      id: string;
      name: string;
      email: string;
      phone: string | null;
    };
    expedition: {
      idExpedition: string;
      startDate: string;
      endDate: string;
    };
    bookingItems: Array<{
      itemType: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }>;
  }>;
}

@Injectable()
export class GetTripStatsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: GetTripStatsInput): Promise<GetTripStatsResponse> {
    // Verificar que el usuario pertenezca a la agencia
    const membership = await this.prisma.$queryRaw<any[]>`
      SELECT 
        id,
        id_agency as "idAgency",
        user_id as "idUser",
        role
      FROM agency_members
      WHERE id_agency = ${input.agencyId}::bigint 
        AND user_id = ${input.userId}
        AND role IN ('admin', 'editor')
      LIMIT 1
    `;

    if (!membership || membership.length === 0) {
      throw new ForbiddenException('No tienes permiso para ver las estadísticas de este viaje');
    }

    // Verificar que el viaje existe y pertenece a la agencia
    const trip = await this.prisma.trip.findFirst({
      where: {
        idTrip: input.tripId,
        idAgency: input.agencyId,
      },
      select: {
        idTrip: true,
        title: true,
        status: true,
        isActive: true,
        idPromoter: true,
      },
    });

    if (!trip) {
      throw new NotFoundException('Viaje no encontrado o no pertenece a tu agencia');
    }

    // Obtener promoter si existe
    let promoter: {
      id: string;
      code: string;
      name: string;
      email: string | null;
      phone: string | null;
      referralCount: number;
      isActive: boolean;
    } | null = null;
    if (trip.idPromoter) {
      const promoterData = await this.prisma.promoter.findUnique({
        where: { id: trip.idPromoter },
        select: {
          id: true,
          code: true,
          name: true,
          email: true,
          phone: true,
          referralCount: true,
          isActive: true,
        },
      });
      if (promoterData) {
        promoter = {
          id: promoterData.id.toString(),
          code: promoterData.code,
          name: promoterData.name,
          email: promoterData.email,
          phone: promoterData.phone,
          referralCount: promoterData.referralCount,
          isActive: promoterData.isActive,
        };
      }
    }

    // Calcular fechas del mes actual y anterior
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // Obtener todas las reservas del viaje
    const allBookings = await this.prisma.booking.findMany({
      where: {
        idTrip: input.tripId,
      },
      select: {
        idBooking: true,
        status: true,
        dateBuy: true,
        totalBuy: true,
        subtotal: true,
        discountAmount: true,
        discountCode: true,
        currency: true,
        transactionId: true,
        ownerBuy: true,
        idExpedition: true,
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneUser: true,
          },
        },
        expedition: {
          select: {
            idExpedition: true,
            startDate: true,
            endDate: true,
          },
        },
        bookingItems: {
          select: {
            itemType: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
          },
        },
      },
      orderBy: {
        dateBuy: 'desc',
      },
    });

    // Filtrar reservas del mes actual
    const currentMonthBookings = allBookings.filter(
      (b) => b.dateBuy >= currentMonthStart && b.dateBuy <= currentMonthEnd,
    );

    // Filtrar reservas confirmadas del mes actual
    const currentMonthConfirmed = currentMonthBookings.filter((b) => b.status === 'CONFIRMED');

    // Filtrar reservas del mes anterior
    const previousMonthBookings = allBookings.filter(
      (b) => b.dateBuy >= previousMonthStart && b.dateBuy <= previousMonthEnd && b.status === 'CONFIRMED',
    );

    // Calcular estadísticas del mes actual
    const currentMonthRevenue = currentMonthConfirmed.reduce((sum, b) => sum + Number(b.totalBuy), 0);
    const currentMonthDiscountAmount = currentMonthConfirmed.reduce(
      (sum, b) => sum + Number(b.discountAmount),
      0,
    );
    const currentMonthAverageBookingValue =
      currentMonthConfirmed.length > 0 ? currentMonthRevenue / currentMonthConfirmed.length : 0;

    // Contar códigos de descuento únicos usados este mes
    const discountCodesUsedThisMonth = new Set(
      currentMonthConfirmed.filter((b) => b.discountCode).map((b) => b.discountCode!),
    ).size;

    // Calcular estadísticas del mes anterior
    const previousMonthRevenue = previousMonthBookings.reduce((sum, b) => sum + Number(b.totalBuy), 0);
    const previousMonthAverageBookingValue =
      previousMonthBookings.length > 0 ? previousMonthRevenue / previousMonthBookings.length : 0;

    // Calcular cambios porcentuales
    const bookingsChange =
      previousMonthBookings.length > 0
        ? ((currentMonthConfirmed.length - previousMonthBookings.length) / previousMonthBookings.length) * 100
        : currentMonthConfirmed.length > 0 ? 100 : 0;
    const revenueChange =
      previousMonthRevenue > 0
        ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100
        : currentMonthRevenue > 0 ? 100 : 0;

    // Obtener códigos de descuento asociados al viaje
    const discountCodes = await this.prisma.discountCode.findMany({
      where: {
        idTrip: input.tripId,
      },
      select: {
        codeName: true,
        discountType: true,
        value: true,
        maxUses: true,
        usedCount: true,
        active: true,
      },
    });

    // Contar uso de cada código de descuento en las reservas
    const discountCodeUsage = discountCodes.map((dc) => {
      const bookingsWithCode = allBookings.filter(
        (b) => b.status === 'CONFIRMED' && b.discountCode === dc.codeName,
      );
      const totalDiscountAmount = bookingsWithCode.reduce(
        (sum, b) => sum + Number(b.discountAmount),
        0,
      );

      return {
        code: dc.codeName,
        discountType: dc.discountType,
        value: Number(dc.value),
        timesUsed: bookingsWithCode.length,
        totalDiscountAmount,
        maxUses: dc.maxUses,
        usedCount: dc.usedCount,
        active: dc.active,
      };
    });

    // Calcular estadísticas totales
    const confirmedBookings = allBookings.filter((b) => b.status === 'CONFIRMED');
    const totalRevenue = confirmedBookings.reduce((sum, b) => sum + Number(b.totalBuy), 0);
    const totalDiscountAmount = confirmedBookings.reduce((sum, b) => sum + Number(b.discountAmount), 0);
    const averageBookingValue = confirmedBookings.length > 0 ? totalRevenue / confirmedBookings.length : 0;

    // Calcular tasa de conversión
    const allStatusBookings = allBookings.filter((b) =>
      ['CONFIRMED', 'PENDING', 'CANCELLED'].includes(b.status),
    );
    const conversionRate =
      allStatusBookings.length > 0 ? (confirmedBookings.length / allStatusBookings.length) * 100 : 0;

    // Obtener la moneda más común
    const currencyCounts = new Map<string, number>();
    confirmedBookings.forEach((b) => {
      const count = currencyCounts.get(b.currency) || 0;
      currencyCounts.set(b.currency, count + 1);
    });
    const mostCommonCurrency =
      Array.from(currencyCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'USD';

    // Formatear historial de reservas
    const bookingHistory = allBookings.map((b) => ({
      idBooking: b.idBooking.toString(),
      status: b.status,
      dateBuy: b.dateBuy.toISOString(),
      totalBuy: Number(b.totalBuy),
      subtotal: Number(b.subtotal),
      discountAmount: Number(b.discountAmount),
      discountCode: b.discountCode,
      currency: b.currency,
      transactionId: b.transactionId,
      customer: {
        id: b.owner.id,
        name: b.owner.name,
        email: b.owner.email,
        phone: b.owner.phoneUser,
      },
      expedition: {
        idExpedition: b.expedition.idExpedition.toString(),
        startDate: b.expedition.startDate.toISOString(),
        endDate: b.expedition.endDate.toISOString(),
      },
      bookingItems: b.bookingItems.map((item) => ({
        itemType: item.itemType,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
      })),
    }));

    return {
      trip: {
        idTrip: trip.idTrip.toString(),
        title: trip.title,
        status: trip.status,
        isActive: trip.isActive,
      },
      promoter,
      monthlyStats: {
        currentMonth: {
          bookings: currentMonthConfirmed.length,
          revenue: currentMonthRevenue,
          currency: mostCommonCurrency,
          averageBookingValue: currentMonthAverageBookingValue,
          discountCodesUsed: discountCodesUsedThisMonth,
          totalDiscountAmount: currentMonthDiscountAmount,
        },
        previousMonth: {
          bookings: previousMonthBookings.length,
          revenue: previousMonthRevenue,
          currency: mostCommonCurrency,
          averageBookingValue: previousMonthAverageBookingValue,
        },
        change: {
          bookings: bookingsChange,
          revenue: revenueChange,
        },
      },
      discountCodes: discountCodeUsage,
      totalStats: {
        totalBookings: confirmedBookings.length,
        totalRevenue,
        currency: mostCommonCurrency,
        totalDiscountAmount,
        averageBookingValue,
        conversionRate,
      },
      bookingHistory,
    };
  }
}
