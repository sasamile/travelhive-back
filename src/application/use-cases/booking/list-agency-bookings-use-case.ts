import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { BookingStatusFilter } from '../../../presentation/dto/list-agency-bookings.dto';

export interface ListAgencyBookingsInput {
  agencyId: bigint;
  userId: string;
  status?: BookingStatusFilter;
  search?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export interface ListAgencyBookingsResponse {
  bookings: Array<{
    // Formato principal para el frontend
    id: string; // "#BK-94821"
    expedition: string; // Nombre de la expedición
    departure: string; // "Nov 14, 2023"
    traveler: {
      name: string;
      email: string;
      avatar?: string;
    };
    seats: string; // "2/4"
    total: string; // "$4,850.00"
    status: string; // 'confirmed', 'pending', 'cancelled'
    
    // Información adicional completa
    idBooking: string;
    idTrip: string;
    idExpedition: string;
    statusRaw: string;
    totalBuy: number;
    currency: string;
    dateBuy: Date;
    referenceBuy: string | null;
    transactionId: string | null;
    paymentSource: string | null;
    createdAt: Date;
    updatedAt: Date;
    trip: {
      idTrip: string;
      title: string;
      coverImage: string | null;
    };
    expeditionDetails: {
      idExpedition: string;
      startDate: string; // ISO string
      endDate: string; // ISO string
      status: string;
      capacityTotal: number;
      capacityAvailable: number;
      dates: string; // Formateado: "Nov 14, 2023"
    };
    bookingItems: Array<{
      id: string;
      itemType: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }>;
    totalSeats: number; // Total de asientos reservados
  }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class ListAgencyBookingsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: ListAgencyBookingsInput): Promise<ListAgencyBookingsResponse> {
    // Verificar que el usuario pertenezca a la agencia
    // Usar $queryRaw para evitar problemas con isActive si la columna no existe aún
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
      throw new ForbiddenException('No tienes permiso para ver las reservas de esta agencia');
    }

    const page = input.page || 1;
    const limit = input.limit || 20;
    const skip = (page - 1) * limit;

    // Construir condiciones de filtro
    const whereConditions: any = {
      idAgency: input.agencyId,
    };

    // Filtrar por estado
    if (input.status && input.status !== 'all') {
      const statusMap: Record<string, string> = {
        confirmed: 'CONFIRMED',
        pending: 'PENDING',
        canceled: 'CANCELLED',
      };
      whereConditions.status = statusMap[input.status] || input.status.toUpperCase();
    }

    // Filtrar por búsqueda (ID de reserva, nombre o email del viajero)
    if (input.search) {
      const searchConditions: any[] = [
        {
          referenceBuy: {
            contains: input.search,
            mode: 'insensitive',
          },
        },
        {
          owner: {
            OR: [
              {
                name: {
                  contains: input.search,
                  mode: 'insensitive',
                },
              },
              {
                email: {
                  contains: input.search,
                  mode: 'insensitive',
                },
              },
            ],
          },
        },
      ];

      // Intentar buscar por ID de reserva si el search es numérico
      const numericSearch = input.search.replace(/[^0-9]/g, '');
      if (numericSearch && numericSearch.length > 0) {
        try {
          const bookingId = BigInt(numericSearch);
          searchConditions.unshift({
            idBooking: {
              equals: bookingId,
            },
          });
        } catch (e) {
          // Si no es un BigInt válido, ignorar
        }
      }

      whereConditions.OR = searchConditions;
    }

    // Filtrar por rango de fechas de la expedición
    if (input.startDate || input.endDate) {
      whereConditions.expedition = {};
      if (input.startDate) {
        whereConditions.expedition.startDate = {
          gte: input.startDate,
        };
      }
      if (input.endDate) {
        whereConditions.expedition.endDate = {
          lte: input.endDate,
        };
      }
    }

    // Contar total de reservas
    const total = await this.prisma.booking.count({
      where: whereConditions,
    });

    // Obtener reservas con información completa
    const bookings = await this.prisma.booking.findMany({
      where: whereConditions,
      include: {
        bookingItems: true,
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        trip: {
          select: {
            idTrip: true,
            title: true,
            coverImage: true,
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
      skip,
      take: limit,
    });

    // Formatear respuesta según el formato esperado por el frontend
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    const formattedBookings = bookings.map((booking) => {
      const startDate = new Date(booking.expedition.startDate);
      const endDate = new Date(booking.expedition.endDate);
      
      // Formatear fecha de salida: "Nov 14, 2023"
      const departureMonth = monthNames[startDate.getMonth()];
      const departureDate = `${departureMonth} ${startDate.getDate()}, ${startDate.getFullYear()}`;

      // Calcular total de asientos reservados
      const totalSeats = booking.bookingItems.reduce((sum, item) => sum + item.quantity, 0);
      const seatsInfo = `${totalSeats}/${booking.expedition.capacityTotal}`;

      // Formatear monto total según la moneda
      const formatCurrency = (amount: number, currency: string) => {
        if (currency === 'COP') {
          return `$${amount.toLocaleString('es-CO')}`;
        } else if (currency === 'USD') {
          return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        } else if (currency === 'EUR') {
          return `€${amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        return `${amount} ${currency}`;
      };

      // Formatear ID de reserva: #BK-94821 (usar últimos 5 dígitos del ID)
      const bookingIdStr = booking.idBooking.toString();
      const shortId = bookingIdStr.slice(-5);
      const formattedId = `#BK-${shortId}`;

      return {
        // Formato para el frontend
        id: formattedId, // "#BK-94821"
        expedition: booking.trip.title, // Nombre de la expedición
        departure: departureDate, // "Nov 14, 2023"
        traveler: {
          name: booking.owner.name,
          email: booking.owner.email,
          avatar: booking.owner.image || undefined,
        },
        seats: seatsInfo, // "2/4"
        total: formatCurrency(Number(booking.totalBuy), booking.currency), // "$4,850.00"
        status: booking.status.toLowerCase(), // 'confirmed', 'pending', 'cancelled'
        
        // Información adicional completa
        idBooking: booking.idBooking.toString(),
        idTrip: booking.idTrip.toString(),
        idExpedition: booking.expedition.idExpedition.toString(),
        statusRaw: booking.status,
        totalBuy: Number(booking.totalBuy),
        currency: booking.currency,
        dateBuy: booking.dateBuy,
        referenceBuy: booking.referenceBuy,
        transactionId: booking.transactionId,
        paymentSource: booking.paymentSource,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        trip: {
          idTrip: booking.trip.idTrip.toString(),
          title: booking.trip.title,
          coverImage: booking.trip.coverImage,
        },
        expeditionDetails: {
          idExpedition: booking.expedition.idExpedition.toString(),
          startDate: booking.expedition.startDate.toISOString(),
          endDate: booking.expedition.endDate.toISOString(),
          status: booking.expedition.status,
          capacityTotal: booking.expedition.capacityTotal,
          capacityAvailable: booking.expedition.capacityAvailable,
          dates: departureDate,
        },
        bookingItems: booking.bookingItems.map((item) => ({
          id: item.id.toString(),
          itemType: item.itemType,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
        })),
        totalSeats,
      };
    });

    return {
      bookings: formattedBookings,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
