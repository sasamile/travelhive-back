import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import type { IAgencyMemberRepository } from '../../../domain/ports/agency.repository.port';
import { AGENCY_MEMBER_REPOSITORY } from '../../../domain/ports/tokens';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { ExpeditionStatus } from '../../../domain/entities/expedition.entity';
import { TripStatus } from '../../../domain/entities/trip.entity';

export interface ListExpeditionsFilters {
  status?: string; // 'active' | 'drafts' | 'completed' | 'archived' o cualquier otro valor
  search?: string; // Filtro por nombre/título
  date?: string; // Filtro por fecha (ISO string)
  page?: number;
  limit?: number;
}

export interface ExpeditionWithDetails {
  id: string;
  title: string;
  location: string;
  image: string | null;
  dates: string;
  duration: string;
  occupancy: {
    current: number;
    total: number;
    percentage: number;
  };
  revenue: string;
  status: string;
  statusColor: string;
}

export interface ListExpeditionsResponse {
  data: ExpeditionWithDetails[];
  total: number;
  page: number;
  limit: number;
  counts?: {
    active: number;
    drafts: number;
    completed: number;
    archived: number;
  };
}

@Injectable()
export class ListAgencyExpeditionsUseCase {
  constructor(
    @Inject(AGENCY_MEMBER_REPOSITORY)
    private readonly agencyMemberRepository: IAgencyMemberRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    agencyId: bigint,
    userId: string,
    filters: ListExpeditionsFilters = {},
  ): Promise<ListExpeditionsResponse> {
    // Verificar que el usuario pertenezca a la agencia
    const membership = await this.agencyMemberRepository.findByAgencyAndUser(agencyId, userId);
    if (!membership) {
      throw new ForbiddenException('No tienes permiso para ver las expediciones de esta agencia');
    }

    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    // Construir filtros de estado
    const now = new Date();
    const whereClause: any = {
      trip: {
        idAgency: agencyId,
      },
    };

    // Aplicar filtro de búsqueda por nombre/título
    if (filters.search && filters.search.trim()) {
      whereClause.trip.title = {
        contains: filters.search.trim(),
        mode: 'insensitive', // Búsqueda case-insensitive
      };
    }

    // Aplicar filtro de fecha
    if (filters.date) {
      const filterDate = new Date(filters.date);
      // Buscar expediciones que tengan la fecha en su rango (startDate <= filterDate <= endDate)
      whereClause.AND = whereClause.AND || [];
      whereClause.AND.push({
        startDate: { lte: filterDate },
        endDate: { gte: filterDate },
      });
    }

    switch (filters.status) {
      case 'active':
        // Expediciones activas: no canceladas, no completadas, y fecha de fin en el futuro o reciente
        // Excluir trips en borrador, archivados o desactivados
        whereClause.trip.status = {
          notIn: [TripStatus.DRAFT, TripStatus.ARCHIVED],
        };
        whereClause.trip.isActive = true; // Solo trips activos
        whereClause.status = {
          not: ExpeditionStatus.CANCELLED,
        };
        // Combinar con filtros existentes de AND si hay
        const existingAND = whereClause.AND || [];
        whereClause.AND = [
          ...existingAND,
          {
            OR: [
              { status: { not: ExpeditionStatus.COMPLETED } },
              { endDate: { gte: now } },
            ],
          },
        ];
        break;
      case 'drafts':
        // Trips en borrador - mostrar todas las expediciones de trips en borrador
        whereClause.trip.status = TripStatus.DRAFT;
        break;
      case 'completed':
        // Expediciones completadas: status COMPLETED o fecha de fin en el pasado
        // El filtro de fecha ya está aplicado en el AND general, así que solo agregamos el criterio de completed
        whereClause.OR = [
          { status: ExpeditionStatus.COMPLETED },
          { endDate: { lt: now } },
        ];
        break;
      case 'archived':
        // Trips archivados - mostrar todas las expediciones de trips archivados
        whereClause.trip.status = TripStatus.ARCHIVED;
        break;
      default:
        // Sin filtro de estado, mostrar todas excepto canceladas
        // Incluir trips desactivadas cuando no hay filtro específico
        // No aplicar filtro de status ni isActive si no hay filtro específico
        break;
    }

    // Construir filtros para trips (para incluir trips sin expediciones)
    const tripWhereClause: any = {
      idAgency: agencyId,
    };

    // Aplicar filtro de búsqueda por nombre/título
    if (filters.search && filters.search.trim()) {
      tripWhereClause.title = {
        contains: filters.search.trim(),
        mode: 'insensitive', // Búsqueda case-insensitive
      };
    }

    // Aplicar filtro de fecha para trips sin expediciones
    if (filters.date) {
      const filterDate = new Date(filters.date);
      // Buscar trips que tengan la fecha en su rango (startDate <= filterDate <= endDate)
      tripWhereClause.AND = [
        { startDate: { lte: filterDate } },
        { endDate: { gte: filterDate } },
      ];
    }

    // Aplicar filtros de estado del trip
    switch (filters.status) {
      case 'active':
        tripWhereClause.status = {
          notIn: [TripStatus.DRAFT, TripStatus.ARCHIVED],
        };
        tripWhereClause.isActive = true; // Solo trips activos
        break;
      case 'drafts':
        tripWhereClause.status = TripStatus.DRAFT;
        break;
      case 'archived':
        tripWhereClause.status = TripStatus.ARCHIVED;
        break;
      case 'completed':
        // Para completed, solo mostrar expediciones (no trips sin expediciones)
        break;
    }

    // Obtener expediciones
    const [expeditionsRaw, expeditionsTotal] = await Promise.all([
      this.prisma.expedition.findMany({
        where: whereClause,
        select: {
          idExpedition: true,
          idTrip: true,
          startDate: true,
          endDate: true,
          capacityTotal: true,
          capacityAvailable: true,
          currency: true,
          status: true,
          trip: {
            select: {
              idTrip: true,
              title: true,
              isActive: true,
              status: true,
              coverImage: true,
              city: {
                select: {
                  nameCity: true,
                },
              },
              galleryImages: {
                orderBy: { order: 'asc' },
                take: 1,
                select: {
                  imageUrl: true,
                },
              },
            },
          },
          bookings: {
            where: {
              status: 'CONFIRMED', // Solo contar reservas confirmadas
            },
            select: {
              totalBuy: true,
              bookingItems: {
                select: {
                  quantity: true,
                },
              },
            },
          },
        },
        orderBy: { startDate: 'desc' },
        // No usar skip/take aquí, lo haremos después de eliminar duplicados
      }),
      this.prisma.expedition.count({
        where: whereClause,
      }),
    ]);

    // Eliminar duplicados por idExpedition (por si acaso hay duplicados en la BD)
    const expeditionsMap = new Map<string, any>();
    expeditionsRaw.forEach((exp) => {
      const key = exp.idExpedition.toString();
      if (!expeditionsMap.has(key)) {
        expeditionsMap.set(key, exp);
      }
    });
    const expeditions = Array.from(expeditionsMap.values())
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
      .slice(skip, skip + limit);

    // Si no hay filtro de "completed" y hay espacio, obtener trips sin expediciones
    let tripsWithoutExpeditions: any[] = [];
    let tripsWithoutExpeditionsTotal = 0;
    
    if (filters.status !== 'completed' && expeditions.length < limit) {
      const remaining = limit - expeditions.length;
      [tripsWithoutExpeditions, tripsWithoutExpeditionsTotal] = await Promise.all([
        this.prisma.trip.findMany({
          where: {
            ...tripWhereClause,
            expeditions: {
              none: {},
            },
          },
          select: {
            idTrip: true,
            title: true,
            isActive: true,
            status: true,
            coverImage: true,
            startDate: true,
            endDate: true,
            durationDays: true,
            maxPersons: true,
            city: {
              select: {
                nameCity: true,
              },
            },
            galleryImages: {
              orderBy: { order: 'asc' },
              take: 1,
              select: {
                imageUrl: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: remaining,
        }),
        this.prisma.trip.count({
          where: {
            ...tripWhereClause,
            expeditions: {
              none: {},
            },
          },
        }),
      ]);
    }

    const total = expeditionsTotal + tripsWithoutExpeditionsTotal;

    // Transformar expediciones al formato requerido
    // Nota: Ya eliminamos duplicados arriba, así que expeditions ya está sin duplicados
    const expeditionsData: ExpeditionWithDetails[] = expeditions.map((expedition) => {
      // Calcular ocupación SOLO desde bookings CONFIRMED (no PENDING)
      const confirmedBookings = expedition.bookings || [];
      const totalBookedFromConfirmed = confirmedBookings.reduce((sum, booking) => {
        const bookingQuantity = booking.bookingItems.reduce(
          (itemSum, item) => itemSum + item.quantity,
          0,
        );
        return sum + bookingQuantity;
      }, 0);

      // La ocupación actual debe ser SOLO las reservas CONFIRMED
      // No usar capacityAvailable porque incluye reservas PENDING que pueden cancelarse
      const currentOccupancy = totalBookedFromConfirmed;
      const occupancy = {
        current: Math.max(0, currentOccupancy), // Asegurar que no sea negativo
        total: expedition.capacityTotal,
        percentage: expedition.capacityTotal > 0 
          ? Math.min(100, Math.round((currentOccupancy / expedition.capacityTotal) * 100))
          : 0,
      };

      // Calcular ingresos desde bookings confirmados
      const revenue = confirmedBookings.reduce((sum, booking) => {
        return sum + Number(booking.totalBuy);
      }, 0);

      // Formatear fechas
      const startDate = new Date(expedition.startDate);
      const endDate = new Date(expedition.endDate);
      
      // Formatear mes en español
      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const startMonth = monthNames[startDate.getMonth()];
      const endMonth = monthNames[endDate.getMonth()];
      const startFormatted = `${startMonth} ${startDate.getDate()}`;
      const endFormatted = `${endMonth} ${endDate.getDate()}`;
      const dates = `${startFormatted} — ${endFormatted}`;

      // Calcular duración
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const duration = `${daysDiff} ${daysDiff === 1 ? 'Día' : 'Días'}`;

      // Determinar estado y color
      let status: string;
      let statusColor: string;

      // Verificar primero si el trip está desactivado
      if (!expedition.trip.isActive) {
        status = 'DESACTIVADO';
        statusColor = 'bg-red-50 text-red-600 border-red-100';
      } else if (expedition.status === ExpeditionStatus.COMPLETED || endDate < now) {
        status = 'COMPLETADA';
        statusColor = 'bg-zinc-50 text-zinc-600 border-zinc-100';
      } else if (expedition.status === ExpeditionStatus.CANCELLED) {
        status = 'CANCELADA';
        statusColor = 'bg-red-50 text-red-600 border-red-100';
      } else if (expedition.status === ExpeditionStatus.FULL) {
        // Si el estado en BD es FULL, mostrar "LLENA"
        status = 'LLENA';
        statusColor = 'bg-amber-50 text-amber-600 border-amber-100';
      } else if (occupancy.percentage >= 100) {
        // LISTA DE ESPERA: Solo cuando hay 100% de ocupación pero el estado aún no se actualizó a FULL
        // Esto puede pasar temporalmente hasta que el cron job actualice el estado
        status = 'LISTA DE ESPERA';
        statusColor = 'bg-amber-50 text-amber-600 border-amber-100';
      } else if (startDate <= now && endDate >= now) {
        status = 'ACTIVA';
        statusColor = 'bg-emerald-50 text-emerald-600 border-emerald-100';
      } else if (startDate > now) {
        status = 'PROGRAMADA';
        statusColor = 'bg-indigo-50 text-indigo-600 border-indigo-100';
      } else {
        status = 'DISPONIBLE';
        statusColor = 'bg-blue-50 text-blue-600 border-blue-100';
      }

      // Obtener imagen del trip
      const image =
        expedition.trip.coverImage ||
        (expedition.trip.galleryImages && expedition.trip.galleryImages.length > 0
          ? expedition.trip.galleryImages[0].imageUrl
          : null);

      return {
        id: expedition.idExpedition.toString(),
        title: expedition.trip.title,
        location: expedition.trip.city.nameCity,
        image,
        dates,
        duration,
        occupancy,
        revenue: new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: expedition.currency || 'USD',
        }).format(revenue),
        status,
        statusColor,
      };
    });

    // Transformar trips sin expediciones al formato requerido
    const tripsData: ExpeditionWithDetails[] = tripsWithoutExpeditions.map((trip) => {
      // Usar fechas del trip si están disponibles, sino mostrar "Sin fechas"
      const startDate = trip.startDate ? new Date(trip.startDate) : null;
      const endDate = trip.endDate ? new Date(trip.endDate) : null;
      
      let dates = 'Sin fechas programadas';
      let duration = `${trip.durationDays} ${trip.durationDays === 1 ? 'Día' : 'Días'}`;
      
      if (startDate && endDate) {
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const startMonth = monthNames[startDate.getMonth()];
        const endMonth = monthNames[endDate.getMonth()];
        const startFormatted = `${startMonth} ${startDate.getDate()}`;
        const endFormatted = `${endMonth} ${endDate.getDate()}`;
        dates = `${startFormatted} — ${endFormatted}`;
      }

      // Obtener imagen del trip
      const image =
        trip.coverImage ||
        (trip.galleryImages && trip.galleryImages.length > 0
          ? trip.galleryImages[0].imageUrl
          : null);

      // Determinar estado y color basado en el status del trip
      let status: string;
      let statusColor: string;

      // Verificar primero si el trip está desactivado
      if (!trip.isActive) {
        status = 'DESACTIVADO';
        statusColor = 'bg-red-50 text-red-600 border-red-100';
      } else if (trip.status === TripStatus.DRAFT) {
        status = 'BORRADOR';
        statusColor = 'bg-gray-50 text-gray-600 border-gray-100';
      } else if (trip.status === TripStatus.ARCHIVED) {
        status = 'ARCHIVADO';
        statusColor = 'bg-zinc-50 text-zinc-600 border-zinc-100';
      } else if (trip.status === TripStatus.PUBLISHED) {
        status = 'PUBLICADO';
        statusColor = 'bg-blue-50 text-blue-600 border-blue-100';
      } else {
        status = 'BORRADOR';
        statusColor = 'bg-gray-50 text-gray-600 border-gray-100';
      }

      return {
        id: trip.idTrip.toString(),
        title: trip.title,
        location: trip.city.nameCity,
        image,
        dates,
        duration,
        occupancy: {
          current: 0,
          total: trip.maxPersons || 0,
          percentage: 0,
        },
        revenue: '$0.00',
        status,
        statusColor,
      };
    });

    // Combinar expediciones y trips sin expediciones
    const data = [...expeditionsData, ...tripsData].slice(0, limit);

    // Calcular conteos por estado si no hay filtro específico o si se solicita
    let counts: { active: number; drafts: number; completed: number; archived: number } | undefined;
    
    if (!filters.status) {
      const now = new Date();
      const baseWhere = {
        trip: {
          idAgency: agencyId,
        },
        status: {
          not: ExpeditionStatus.CANCELLED,
        },
      };

      const [activeCount, draftsCount, completedCount, archivedCount] = await Promise.all([
        // Active: no canceladas, no completadas, trips no en borrador/archivados y activos
        this.prisma.expedition.count({
          where: {
            ...baseWhere,
            trip: {
              idAgency: agencyId,
              status: {
                notIn: [TripStatus.DRAFT, TripStatus.ARCHIVED],
              },
              isActive: true, // Solo trips activos
            },
            AND: [
              {
                OR: [
                  { status: { not: ExpeditionStatus.COMPLETED } },
                  { endDate: { gte: now } },
                ],
              },
            ],
          },
        }),
        // Drafts: trips en borrador
        this.prisma.expedition.count({
          where: {
            ...baseWhere,
            trip: {
              idAgency: agencyId,
              status: TripStatus.DRAFT,
            },
          },
        }),
        // Completed: completadas o fecha pasada
        this.prisma.expedition.count({
          where: {
            trip: {
              idAgency: agencyId,
            },
            OR: [
              { status: ExpeditionStatus.COMPLETED },
              { endDate: { lt: now } },
            ],
          },
        }),
        // Archived: trips archivados
        this.prisma.expedition.count({
          where: {
            trip: {
              idAgency: agencyId,
              status: TripStatus.ARCHIVED,
            },
          },
        }),
      ]);

      counts = {
        active: activeCount,
        drafts: draftsCount,
        completed: completedCount,
        archived: archivedCount,
      };
    }

    return {
      data,
      total,
      page,
      limit,
      counts,
    };
  }
}
