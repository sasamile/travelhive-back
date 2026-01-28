import { Injectable, Inject } from '@nestjs/common';
import type { IBookingRepository } from '../../../domain/ports/booking.repository.port';
import { BOOKING_REPOSITORY } from '../../../domain/ports/tokens';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { BookingFilterType } from '../../../presentation/dto/list-my-bookings.dto';

export interface ListMyBookingsInput {
  userId: string;
  filter?: BookingFilterType;
  search?: string;
}

@Injectable()
export class ListMyBookingsUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY)
    private readonly bookingRepository: IBookingRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: ListMyBookingsInput) {
    const now = new Date();

    // Construir condiciones de filtro
    const whereConditions: any = {
      ownerBuy: input.userId,
      status: {
        in: ['CONFIRMED', 'PENDING'], // Solo mostrar reservas confirmadas o pendientes
      },
    };

    // Filtrar por búsqueda de nombre del viaje
    if (input.search) {
      whereConditions.trip = {
        title: {
          contains: input.search,
          mode: 'insensitive',
        },
      };
    }

    // Obtener reservas con información completa del trip y expedition
    const bookings = await this.prisma.booking.findMany({
      where: whereConditions,
      include: {
        bookingItems: true,
        qrCode: {
          select: {
            qrCode: true,
            qrImageUrl: true,
            isClaimed: true,
          },
        },
        trip: {
          select: {
            idTrip: true,
            title: true,
            description: true,
            coverImage: true,
            city: {
              select: {
                idCity: true,
                nameCity: true,
              },
            },
            agency: {
              select: {
                idAgency: true,
                nameAgency: true,
                picture: true,
              },
            },
            host: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
        expedition: {
          select: {
            idExpedition: true,
            startDate: true,
            endDate: true,
            status: true,
            capacityTotal: true,
            capacityAvailable: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Filtrar por tipo (upcoming/history) y formatear respuesta
    const nowDate = new Date();
    const filteredBookings = bookings
      .filter((booking) => {
        if (input.filter === 'upcoming') {
          // Solo próximos: fecha de inicio en el futuro
          return new Date(booking.expedition.startDate) > nowDate;
        } else if (input.filter === 'history') {
          // Solo historial: fecha de fin en el pasado o expedición completada
          return (
            new Date(booking.expedition.endDate) < nowDate ||
            booking.expedition.status === 'COMPLETED'
          );
        }
        // 'all' o sin filtro: mostrar todos
        return true;
      })
      .map((booking) => {
        const startDate = new Date(booking.expedition.startDate);
        const endDate = new Date(booking.expedition.endDate);
        const isUpcoming = startDate > nowDate;
        const isPast = endDate < nowDate || booking.expedition.status === 'COMPLETED';

        // Calcular duración
        const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const duration = `${daysDiff} ${daysDiff === 1 ? 'Día' : 'Días'}`;

        // Formatear fechas
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const startMonth = monthNames[startDate.getMonth()];
        const endMonth = monthNames[endDate.getMonth()];
        const startFormatted = `${startMonth} ${startDate.getDate()}`;
        const endFormatted = `${endMonth} ${endDate.getDate()}`;
        const dates = `${startFormatted} — ${endFormatted}`;

        // Calcular total de personas
        const totalPersons = booking.bookingItems.reduce((sum, item) => sum + item.quantity, 0);

        return {
          idBooking: booking.idBooking.toString(),
          idTrip: booking.idTrip.toString(),
          idExpedition: booking.expedition.idExpedition.toString(),
          idAgency: booking.idAgency?.toString(),
          status: booking.status,
          subtotal: Number(booking.subtotal),
          serviceFee: Number(booking.serviceFee),
          discountCode: booking.discountCode,
          discountAmount: Number(booking.discountAmount),
          totalBuy: Number(booking.totalBuy),
          currency: booking.currency,
          dateBuy: booking.dateBuy,
          referenceBuy: booking.referenceBuy,
          transactionId: booking.transactionId,
          paymentSource: booking.paymentSource,
          createdAt: booking.createdAt,
          updatedAt: booking.updatedAt,
          // Código QR (solo si la reserva está confirmada y tiene QR)
          qrCode: booking.status === 'CONFIRMED' && booking.qrCode ? booking.qrCode.qrCode : null,
          qrImageUrl: booking.status === 'CONFIRMED' && booking.qrCode ? booking.qrCode.qrImageUrl : null,
          // Información del viaje
          trip: {
            idTrip: booking.trip.idTrip.toString(),
            title: booking.trip.title,
            description: booking.trip.description,
            coverImage: booking.trip.coverImage,
            city: booking.trip.city
              ? {
                  idCity: booking.trip.city.idCity.toString(),
                  nameCity: booking.trip.city.nameCity,
                }
              : null,
            agency: booking.trip.agency
              ? {
                  idAgency: booking.trip.agency.idAgency.toString(),
                  nameAgency: booking.trip.agency.nameAgency,
                  picture: booking.trip.agency.picture,
                }
              : null,
            host: booking.trip.host
              ? {
                  id: booking.trip.host.id,
                  name: booking.trip.host.name,
                  image: booking.trip.host.image,
                }
              : null,
          },
          // Información de la expedición
          expedition: {
            idExpedition: booking.expedition.idExpedition.toString(),
            startDate: booking.expedition.startDate.toISOString(),
            endDate: booking.expedition.endDate.toISOString(),
            status: booking.expedition.status,
            capacityTotal: booking.expedition.capacityTotal,
            capacityAvailable: booking.expedition.capacityAvailable,
            dates, // Fechas formateadas
            duration, // Duración formateada
            isUpcoming, // Si es próximo
            isPast, // Si ya pasó
          },
          // Información de la reserva
          bookingItems: booking.bookingItems.map((item) => ({
            id: item.id.toString(),
            itemType: item.itemType,
            description: item.description,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice),
          })),
          totalPersons, // Total de personas reservadas
        };
      });

    // Separar en próximos e historial
    const upcoming = filteredBookings.filter((b) => b.expedition.isUpcoming);
    const history = filteredBookings.filter((b) => b.expedition.isPast);

    return {
      data: filteredBookings,
      upcoming,
      history,
      total: filteredBookings.length,
      upcomingCount: upcoming.length,
      historyCount: history.length,
    };
  }
}
