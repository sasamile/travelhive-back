import {
  Controller,
  Get,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';

@Controller('hosts')
export class HostController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Verificar si el usuario es un host
   */
  private async isHost(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isHost: true },
    });
    return user?.isHost ?? false;
  }

  /**
   * Dashboard del anfitrión (persona natural)
   * 
   * Este endpoint proporciona una vista consolidada de todas las métricas
   * y datos relevantes para el dashboard del anfitrión.
   * 
   * Incluye:
   * - Resumen general (total experiencias, reservas, ingresos, rating promedio)
   * - Experiencias recientes con estadísticas básicas
   * - Reservas recientes
   * - Ingresos por mes (últimos 6 meses)
   * - Métricas de rendimiento
   * 
   * Ejemplo:
   * GET /hosts/dashboard
   * GET /hosts/dashboard?startDate=2026-01-01&endDate=2026-01-31
   */
  @Get('dashboard')
  async getHostDashboard(
    @Session() session: UserSession,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const isHostUser = await this.isHost(session.user.id);

    if (!isHostUser) {
      throw new ForbiddenException('Este endpoint solo está disponible para anfitriones (hosts)');
    }

    // Construir filtro de fechas para bookings
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate);
    }

    // Obtener todas las experiencias del host con sus relaciones
    const experiences = await this.prisma.trip.findMany({
      where: {
        type: 'EXPERIENCE',
        idHost: session.user.id,
      },
      include: {
        bookings: {
          where: {
            ...(Object.keys(dateFilter).length > 0 && { dateBuy: dateFilter }),
          },
          select: {
            idBooking: true,
            totalBuy: true,
            dateBuy: true,
            currency: true,
            status: true,
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
            expedition: {
              select: {
                startDate: true,
                endDate: true,
              },
            },
          },
        },
        reviews: {
          select: {
            rating: true,
            comment: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
        favorites: {
          select: {
            id: true,
          },
        },
        expeditions: {
          select: {
            idExpedition: true,
            startDate: true,
            endDate: true,
            capacityTotal: true,
            capacityAvailable: true,
            status: true,
          },
        },
        city: {
          select: {
            idCity: true,
            nameCity: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calcular estadísticas generales
    let totalExperiences = experiences.length;
    let totalBookings = 0;
    let totalBookingsConfirmed = 0;
    let totalBookingsPending = 0;
    let totalBookingsCancelled = 0;
    let totalEarnings = 0;
    const allRatings: number[] = [];
    let totalFavorites = 0;
    const monthlyRevenueMap = new Map<string, number>();

    // Procesar cada experiencia
    const experiencesWithStats = experiences.map((exp: any) => {
      const confirmedBookings = exp.bookings.filter((b: any) => b.status === 'CONFIRMED');
      const pendingBookings = exp.bookings.filter((b: any) => b.status === 'PENDING');
      const cancelledBookings = exp.bookings.filter((b: any) => b.status === 'CANCELLED');

      const expRevenue = confirmedBookings.reduce((sum: number, b: any) => sum + Number(b.totalBuy), 0);
      totalEarnings += expRevenue;

      const expRatings = exp.reviews.map((r: any) => r.rating);
      allRatings.push(...expRatings);

      const expBookings = exp.bookings.length;
      totalBookings += expBookings;
      totalBookingsConfirmed += confirmedBookings.length;
      totalBookingsPending += pendingBookings.length;
      totalBookingsCancelled += cancelledBookings.length;

      const expFavorites = exp.favorites.length;
      totalFavorites += expFavorites;

      // Agrupar revenue por mes (solo bookings confirmados)
      confirmedBookings.forEach((booking: any) => {
        const date = new Date(booking.dateBuy);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const currentRevenue = monthlyRevenueMap.get(monthKey) || 0;
        monthlyRevenueMap.set(monthKey, currentRevenue + Number(booking.totalBuy));
      });

      const avgRating =
        expRatings.length > 0
          ? expRatings.reduce((sum: number, r: number) => sum + r, 0) / expRatings.length
          : null;

      // Calcular ocupación total de expediciones
      const totalCapacity = exp.expeditions.reduce((sum: number, e: any) => sum + e.capacityTotal, 0);
      const totalAvailable = exp.expeditions.reduce((sum: number, e: any) => sum + e.capacityAvailable, 0);
      const totalOccupied = totalCapacity - totalAvailable;
      const occupancyRate = totalCapacity > 0 ? (totalOccupied / totalCapacity) * 100 : 0;

      return {
        id: exp.idTrip.toString(),
        idTrip: exp.idTrip.toString(),
        title: exp.title,
        description: exp.description,
        coverImage: exp.coverImage,
        price: exp.price ? Number(exp.price) : null,
        currency: exp.currency,
        status: exp.status,
        isActive: exp.isActive,
        createdAt: exp.createdAt,
        city: exp.city
          ? {
              idCity: exp.city.idCity.toString(),
              nameCity: exp.city.nameCity,
            }
          : null,
        stats: {
          totalBookings: expBookings,
          confirmedBookings: confirmedBookings.length,
          pendingBookings: pendingBookings.length,
          cancelledBookings: cancelledBookings.length,
          totalReviews: exp.reviews.length,
          averageRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
          totalFavorites: expFavorites,
          revenue: expRevenue,
          occupancyRate: Math.round(occupancyRate * 10) / 10,
          totalCapacity,
          totalOccupied,
        },
      };
    });

    // Calcular rating promedio general
    const averageRating =
      allRatings.length > 0
        ? allRatings.reduce((sum, rating) => sum + rating, 0) / allRatings.length
        : 0;

    // Calcular tasa de conversión (bookings confirmados / (favorites * 10) como proxy de vistas)
    const totalViews = totalFavorites * 10; // Estimación: cada favorito = ~10 vistas
    const conversionRate = totalViews > 0 ? (totalBookingsConfirmed / totalViews) * 100 : 0;

    // Convertir monthlyRevenueMap a array ordenado (últimos 6 meses)
    const monthlyRevenue: Array<{ date: string; revenue: number }> = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(today);
      date.setMonth(date.getMonth() - i);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyRevenue.push({
        date: monthKey,
        revenue: monthlyRevenueMap.get(monthKey) || 0,
      });
    }

    // Obtener experiencias más populares (por favoritos)
    const topExperiencesByFavorites = [...experiencesWithStats]
      .sort((a, b) => b.stats.totalFavorites - a.stats.totalFavorites)
      .slice(0, 5);

    // Obtener experiencias con más ingresos
    const topExperiencesByRevenue = [...experiencesWithStats]
      .sort((a, b) => b.stats.revenue - a.stats.revenue)
      .slice(0, 5);

    // Obtener reservas recientes (últimas 10)
    const allBookings = experiences.flatMap((exp: any) =>
      exp.bookings.map((booking: any) => ({
        ...booking,
        tripTitle: exp.title,
        tripCoverImage: exp.coverImage,
      })),
    );

    const recentBookings = allBookings
      .sort((a: any, b: any) => new Date(b.dateBuy).getTime() - new Date(a.dateBuy).getTime())
      .slice(0, 10)
      .map((booking: any) => {
        const formattedId = `#BK-${booking.idBooking.toString().slice(-5)}`;
        const departureDate = booking.expedition?.startDate
          ? new Date(booking.expedition.startDate).toLocaleDateString('es-ES', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : 'Sin fecha';

        const formatCurrency = (amount: number, currency: string) => {
          return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: currency === 'COP' ? 'COP' : currency === 'EUR' ? 'EUR' : 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }).format(amount);
        };

        return {
          id: formattedId,
          idBooking: booking.idBooking.toString(),
          tripTitle: booking.tripTitle,
          tripCoverImage: booking.tripCoverImage,
          traveler: {
            name: booking.owner.name,
            email: booking.owner.email,
            avatar: booking.owner.image || undefined,
          },
          departure: departureDate,
          total: formatCurrency(Number(booking.totalBuy), booking.currency),
          totalBuy: Number(booking.totalBuy),
          currency: booking.currency,
          status: booking.status.toLowerCase(),
          statusRaw: booking.status,
          dateBuy: booking.dateBuy,
        };
      });

    // Obtener experiencias recientes (últimas 5)
    const recentExperiences = experiencesWithStats.slice(0, 5);

    return {
      summary: {
        totalExperiences,
        totalBookings,
        bookingsByStatus: {
          confirmed: totalBookingsConfirmed,
          pending: totalBookingsPending,
          cancelled: totalBookingsCancelled,
        },
        totalEarnings,
        averageRating: Math.round(averageRating * 100) / 100,
        totalFavorites,
        conversionRate: Math.round(conversionRate * 10) / 10,
      },
      monthlyRevenue,
      recentExperiences,
      recentBookings,
      topExperiences: {
        byFavorites: topExperiencesByFavorites,
        byRevenue: topExperiencesByRevenue,
      },
    };
  }
}
