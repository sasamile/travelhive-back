import { Injectable } from '@nestjs/common';
import { ITripRepository, PublicTripFilters, PublicTripsResult } from '../../domain/ports/trip.repository.port';
import {
  Trip,
  TripStatus,
  TripCategory,
  RoutePoint,
  TripGalleryImage,
  ItineraryDay,
} from '../../domain/entities/trip.entity';
import { PrismaService } from '../database/prisma/prisma.service';

@Injectable()
export class TripRepository implements ITripRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(trip: Partial<Trip>): Promise<Trip> {
    const created = await this.prisma.trip.create({
      data: {
        idAgency: trip.idAgency!,
        idCity: trip.idCity!,
        title: trip.title!,
        description: trip.description,
        category: trip.category! as any,
        destinationRegion: trip.destinationRegion,
        latitude: trip.latitude ? trip.latitude : null,
        longitude: trip.longitude ? trip.longitude : null,
        startDate: trip.startDate,
        endDate: trip.endDate,
        durationDays: trip.durationDays!,
        durationNights: trip.durationNights!,
        price: trip.price ? trip.price : null,
        currency: trip.currency as any,
        priceType: trip.priceType as any,
        maxPersons: trip.maxPersons,
        coverImage: trip.coverImage,
        coverImageIndex: trip.coverImageIndex,
        status: (trip.status || TripStatus.DRAFT) as any,
        isActive: trip.isActive ?? true,
        publishedAt: trip.publishedAt,
        idPromoter: trip.idPromoter,
        routePoints: trip.routePoints
          ? {
              create: trip.routePoints.map((rp) => ({
                name: rp.name,
                latitude: rp.latitude,
                longitude: rp.longitude,
                order: rp.order,
              })),
            }
          : undefined,
        galleryImages: trip.galleryImages
          ? {
              create: trip.galleryImages.map((gi) => ({
                imageUrl: gi.imageUrl,
                order: gi.order,
              })),
            }
          : undefined,
        itineraryDays: trip.itineraryDays
          ? {
              create: trip.itineraryDays.map((day) => ({
                day: day.day,
                title: day.title,
                subtitle: day.subtitle,
                order: day.order,
                activities: {
                  create: day.activities.map((act) => ({
                    type: act.type as any,
                    title: act.title,
                    description: act.description,
                    time: act.time,
                    imageUrl: act.imageUrl,
                    latitude: act.latitude ? act.latitude : null,
                    longitude: act.longitude ? act.longitude : null,
                    poiId: act.poiId,
                    order: act.order,
                  })),
                },
              })),
            }
          : undefined,
      },
      include: {
        routePoints: true,
        galleryImages: true,
        itineraryDays: {
          include: {
            activities: true,
          },
        },
      },
    });
    return this.mapToEntity(created);
  }

  async findById(id: bigint): Promise<Trip | null> {
    const trip = await this.prisma.trip.findUnique({
      where: { idTrip: id },
      select: {
        idTrip: true,
        idAgency: true,
        idCity: true,
        title: true,
        description: true,
        category: true,
        destinationRegion: true,
        latitude: true,
        longitude: true,
        startDate: true,
        endDate: true,
        durationDays: true,
        durationNights: true,
        price: true,
        currency: true,
        priceType: true,
        maxPersons: true,
        coverImage: true,
        coverImageIndex: true,
        status: true,
        isActive: true,
        publishedAt: true,
        idPromoter: true,
        createdAt: true,
        updatedAt: true,
        routePoints: true,
        galleryImages: true,
        itineraryDays: {
          include: {
            activities: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });
    return trip ? this.mapToEntity(trip) : null;
  }

  async findByAgency(agencyId: bigint): Promise<Trip[]> {
    const trips = await this.prisma.trip.findMany({
      where: { idAgency: agencyId },
      include: {
        routePoints: true,
        galleryImages: true,
        itineraryDays: {
          include: {
            activities: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return trips.map((trip) => this.mapToEntity(trip));
  }

  async update(id: bigint, data: Partial<Trip>): Promise<Trip> {
    // Primero eliminar relaciones existentes si se están actualizando
    if (data.routePoints || data.galleryImages || data.itineraryDays) {
      await this.prisma.routePoint.deleteMany({ where: { idTrip: id } });
      await this.prisma.tripGalleryImage.deleteMany({ where: { idTrip: id } });
      await this.prisma.itineraryActivity.deleteMany({
        where: { idDay: { in: (await this.prisma.itineraryDay.findMany({ where: { idTrip: id }, select: { id: true } })).map((d) => d.id) } },
      });
      await this.prisma.itineraryDay.deleteMany({ where: { idTrip: id } });
    }

    const updated = await this.prisma.trip.update({
      where: { idTrip: id },
      data: {
        title: data.title,
        description: data.description,
        category: data.category as any,
        destinationRegion: data.destinationRegion,
        latitude: data.latitude !== undefined ? (data.latitude ? data.latitude : null) : undefined,
        longitude: data.longitude !== undefined ? (data.longitude ? data.longitude : null) : undefined,
        startDate: data.startDate,
        endDate: data.endDate,
        durationDays: data.durationDays,
        durationNights: data.durationNights,
        price: data.price !== undefined ? (data.price ? data.price : null) : undefined,
        currency: data.currency as any,
        priceType: data.priceType as any,
        maxPersons: data.maxPersons,
        coverImage: data.coverImage,
        coverImageIndex: data.coverImageIndex,
        status: data.status as any,
        isActive: data.isActive,
        publishedAt: data.publishedAt,
        idCity: data.idCity,
        routePoints: data.routePoints
          ? {
              create: data.routePoints.map((rp) => ({
                name: rp.name,
                latitude: rp.latitude,
                longitude: rp.longitude,
                order: rp.order,
              })),
            }
          : undefined,
        galleryImages: data.galleryImages
          ? {
              create: data.galleryImages.map((gi) => ({
                imageUrl: gi.imageUrl,
                order: gi.order,
              })),
            }
          : undefined,
        itineraryDays: data.itineraryDays
          ? {
              create: data.itineraryDays.map((day) => ({
                day: day.day,
                title: day.title,
                subtitle: day.subtitle,
                order: day.order,
                activities: {
                  create: day.activities.map((act) => ({
                    type: act.type as any,
                    title: act.title,
                    description: act.description,
                    time: act.time,
                    imageUrl: act.imageUrl,
                    latitude: act.latitude ? act.latitude : null,
                    longitude: act.longitude ? act.longitude : null,
                    poiId: act.poiId,
                    order: act.order,
                  })),
                },
              })),
            }
          : undefined,
      },
      include: {
        routePoints: true,
        galleryImages: true,
        itineraryDays: {
          include: {
            activities: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });
    return this.mapToEntity(updated);
  }

  async delete(id: bigint): Promise<void> {
    await this.prisma.trip.delete({
      where: { idTrip: id },
    });
  }

  async findByAgencyAndId(agencyId: bigint, tripId: bigint): Promise<Trip | null> {
    const trip = await this.prisma.trip.findFirst({
      where: {
        idTrip: tripId,
        idAgency: agencyId,
      },
      include: {
        routePoints: true,
        galleryImages: true,
        itineraryDays: {
          include: {
            activities: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });
    return trip ? this.mapToEntity(trip) : null;
  }

  async hasBookings(tripId: bigint): Promise<boolean> {
    const bookingCount = await this.prisma.booking.count({
      where: {
        idTrip: tripId,
      },
    });
    return bookingCount > 0;
  }

  async findPublicTrips(filters: PublicTripFilters): Promise<PublicTripsResult> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    // Construir condiciones de filtro
    const whereConditions: any = {
      status: TripStatus.PUBLISHED,
      isActive: true,
      agency: {
        approvalStatus: 'APPROVED',
      },
    };

    // Filtrar por ciudad de origen/destino usando RoutePoints (nombre de la ciudad)
    const originFilter: any = null;
    const destinationFilters: any[] = [];

    // Origen: nombre de ciudad obtenido a partir de idCityOrigin
    let originFilterObj: any = null;
    if (filters.idCityOrigin) {
      const originCity = await this.prisma.city.findUnique({
        where: { idCity: filters.idCityOrigin },
        select: { nameCity: true },
      });

      if (originCity) {
        originFilterObj = {
          routePoints: {
            some: {
              name: {
                contains: originCity.nameCity,
                mode: 'insensitive',
              },
            },
          },
        };
      }
    }

    // Destino: puede venir por idCity (ciudad del trip) o por destinationCityName (nombre en RoutePoints)
    // Usar OR para que encuentre trips con idCity = destino O con RoutePoint que contenga destino
    if (filters.destinationCityName) {
      // Opción 1: RoutePoint que contenga el nombre de destino
      destinationFilters.push({
        routePoints: {
          some: {
            name: {
              contains: filters.destinationCityName,
              mode: 'insensitive',
            },
          },
        },
      });
      
      // Opción 2: idCity coincide con el destino (si está disponible)
      if (filters.idCity || filters.idCityDestination) {
        destinationFilters.push({
          idCity: filters.idCityDestination || filters.idCity,
        });
      }
    } else if (filters.idCity || filters.idCityDestination) {
      // Si no hay destinationCityName pero sí idCity/idCityDestination, usar filtro por idCity
      destinationFilters.push({
        idCity: filters.idCityDestination || filters.idCity,
      });
    }

    // Combinar filtros: origen (si existe) AND (destino en RoutePoints OR idCity)
    const finalFilters: any[] = [];

    if (originFilterObj) {
      finalFilters.push(originFilterObj);
    }

    if (destinationFilters.length === 1) {
      finalFilters.push(destinationFilters[0]);
    } else if (destinationFilters.length > 1) {
      // Múltiples opciones de destino: usar OR (RoutePoint O idCity)
      finalFilters.push({
        OR: destinationFilters,
      });
    }

    // Aplicar filtros finales
    if (finalFilters.length === 1) {
      Object.assign(whereConditions, finalFilters[0]);
    } else if (finalFilters.length > 1) {
      // Origen AND (destino en RoutePoints OR idCity)
      whereConditions.AND = finalFilters;
    }

    // IMPORTANTE: Filtrar trips que tengan al menos una expedición con cupo disponible
    // O que no tengan expediciones (se crearán al reservar)
    // NO mostrar trips que solo tienen expediciones llenas
    // El filtro en el mapeo se encargará de excluir trips con todas las expediciones llenas
    if (filters.startDate || filters.endDate || filters.persons) {
      // Si hay filtros de fecha/personas, también requerir expediciones con cupo disponible que cumplan los filtros
      whereConditions.expeditions = {
        some: {
          status: 'AVAILABLE', // Solo expediciones disponibles (no FULL, no COMPLETED, no CANCELLED)
          capacityAvailable: {
            gt: 0, // Debe tener cupo disponible (mayor que 0)
          },
          ...(filters.startDate && {
            startDate: {
              gte: filters.startDate,
            },
          }),
          ...(filters.endDate && {
            endDate: {
              lte: filters.endDate,
            },
          }),
          ...(filters.persons && {
            capacityAvailable: {
              gte: filters.persons, // Si hay filtro de personas, debe tener al menos ese cupo
            },
          }),
        },
      };
    }

    // Contar total de trips que cumplen los filtros
    const total = await this.prisma.trip.count({
      where: whereConditions,
    });

    // Obtener trips con paginación
    const trips = await this.prisma.trip.findMany({
      where: whereConditions,
      include: {
        routePoints: {
          orderBy: {
            order: 'asc',
          },
        },
        galleryImages: {
          orderBy: {
            order: 'asc',
          },
        },
        itineraryDays: {
          include: {
            activities: {
              orderBy: {
                order: 'asc',
              },
            },
          },
          orderBy: {
            order: 'asc',
          },
        },
        agency: {
          select: {
            idAgency: true,
            nameAgency: true,
            email: true,
            phone: true,
            picture: true,
          },
        },
        city: {
          select: {
            idCity: true,
            nameCity: true,
          },
        },
        expeditions: {
          where: {
            // Incluir TODAS las expediciones para poder verificar si están llenas
            // Filtrar después en el mapeo para mostrar solo las disponibles
            status: {
              in: ['AVAILABLE', 'FULL'], // Incluir FULL para poder detectarlas
            },
            ...(filters.startDate && {
              startDate: {
                gte: filters.startDate,
              },
            }),
            ...(filters.endDate && {
              endDate: {
                lte: filters.endDate,
              },
            }),
          },
          orderBy: {
            startDate: 'asc',
          },
          take: 10, // Traer más para verificar todas
        },
      },
      orderBy: {
        publishedAt: 'desc',
      },
      skip,
      take: limit,
    });

    // Consultar todas las expediciones de los trips para verificar si están llenas
    // Esto es más eficiente que consultar dentro del map
    const tripIds = trips.map((t) => t.idTrip);
    const allExpeditions = await this.prisma.expedition.findMany({
      where: {
        idTrip: { in: tripIds },
      },
      select: {
        idTrip: true,
        status: true,
        capacityAvailable: true,
      },
    });

    // Agrupar expediciones por trip y verificar si todas están llenas
    const tripsWithOnlyFullExpeditions = new Set<bigint>();
    const expeditionsByTrip = new Map<bigint, typeof allExpeditions>();
    
    for (const exp of allExpeditions) {
      if (!expeditionsByTrip.has(exp.idTrip)) {
        expeditionsByTrip.set(exp.idTrip, []);
      }
      expeditionsByTrip.get(exp.idTrip)!.push(exp);
    }

    // Verificar para cada trip si todas sus expediciones están llenas
    for (const [tripId, tripExpeditions] of expeditionsByTrip.entries()) {
      if (tripExpeditions.length > 0) {
        const allFull = tripExpeditions.every(
          (exp) =>
            exp.status === 'FULL' ||
            exp.status === 'COMPLETED' ||
            exp.status === 'CANCELLED' ||
            exp.capacityAvailable === 0,
        );
        if (allFull) {
          tripsWithOnlyFullExpeditions.add(tripId);
        }
      }
    }

    // Mapear trips incluyendo agency y city
    // IMPORTANTE: 
    // - Mostrar trips sin expediciones (se crearán al reservar)
    // - Mostrar trips con al menos una expedición con cupo disponible
    // - NO mostrar trips que solo tienen expediciones llenas
    const mappedTrips = trips
      .map((trip) => {
        // NO mostrar el trip si todas sus expediciones están llenas
        if (tripsWithOnlyFullExpeditions.has(trip.idTrip)) {
          return null;
        }

        const tripEntity = this.mapToEntity(trip);
        
        // Filtrar expediciones que tengan cupo disponible (capacityAvailable > 0)
        // Y que no estén en estado FULL o COMPLETED
        const availableExpeditions = trip.expeditions
          .filter((exp) => {
            // Excluir expediciones llenas o completadas
            if (exp.status === 'FULL' || exp.status === 'COMPLETED' || exp.status === 'CANCELLED') {
              return false;
            }
            // Solo incluir expediciones con cupo disponible
            return exp.capacityAvailable > 0;
          })
          .filter((exp) => {
            // Aplicar filtro de personas si existe
            if (filters.persons) {
              return exp.capacityAvailable >= filters.persons;
            }
            return true;
          })
          .map((exp) => ({
            ...exp,
            idExpedition: exp.idExpedition.toString(),
            priceAdult: Number(exp.priceAdult),
            priceChild: exp.priceChild ? Number(exp.priceChild) : null,
          }));

        // Mostrar el trip si:
        // - No tiene expediciones (se crearán al reservar), O
        // - Tiene al menos una expedición con cupo disponible
        return {
          ...tripEntity,
          // Incluir datos adicionales de agency y city
          agency: trip.agency,
          city: trip.city,
          expeditions: availableExpeditions, // Solo expediciones con cupo disponible (o vacío si no tiene)
        };
      })
      .filter((trip) => trip !== null) as Array<ReturnType<typeof this.mapToEntity> & { agency: any; city: any; expeditions: any[] }>;

    return {
      trips: mappedTrips,
      total: mappedTrips.length, // Total ajustado después de filtrar
      page,
      limit,
      totalPages: Math.ceil(mappedTrips.length / limit),
    };
  }

  async findPublicTripById(id: bigint): Promise<Trip | null> {
    const trip = await this.prisma.trip.findFirst({
      where: {
        idTrip: id,
        status: TripStatus.PUBLISHED,
        isActive: true,
        agency: {
          approvalStatus: 'APPROVED',
        },
      },
      include: {
        routePoints: {
          orderBy: {
            order: 'asc',
          },
        },
        galleryImages: {
          orderBy: {
            order: 'asc',
          },
        },
        itineraryDays: {
          include: {
            activities: {
              orderBy: {
                order: 'asc',
              },
            },
          },
          orderBy: {
            order: 'asc',
          },
        },
        agency: {
          select: {
            idAgency: true,
            nameAgency: true,
            email: true,
            phone: true,
            picture: true,
          },
        },
        city: {
          select: {
            idCity: true,
            nameCity: true,
          },
        },
        expeditions: {
          where: {
            status: 'AVAILABLE',
          },
          orderBy: {
            startDate: 'asc',
          },
        },
      },
    });

    if (!trip) {
      return null;
    }

    const tripEntity = this.mapToEntity(trip);
    return {
      ...tripEntity,
      agency: trip.agency,
      city: trip.city,
      expeditions: trip.expeditions.map((exp) => ({
        ...exp,
        idExpedition: exp.idExpedition.toString(),
        priceAdult: Number(exp.priceAdult),
        priceChild: exp.priceChild ? Number(exp.priceChild) : null,
      })),
    } as any;
  }

  private mapToEntity(prismaTrip: any): Trip {
    return new Trip({
      idTrip: prismaTrip.idTrip,
      idAgency: prismaTrip.idAgency,
      idCity: prismaTrip.idCity,
      title: prismaTrip.title,
      description: prismaTrip.description,
      category: prismaTrip.category as TripCategory,
      destinationRegion: prismaTrip.destinationRegion,
      latitude: prismaTrip.latitude ? Number(prismaTrip.latitude) : undefined,
      longitude: prismaTrip.longitude ? Number(prismaTrip.longitude) : undefined,
      startDate: prismaTrip.startDate ? new Date(prismaTrip.startDate) : undefined,
      endDate: prismaTrip.endDate ? new Date(prismaTrip.endDate) : undefined,
      durationDays: prismaTrip.durationDays,
      durationNights: prismaTrip.durationNights,
      price: prismaTrip.price ? Number(prismaTrip.price) : undefined,
      currency: prismaTrip.currency,
      priceType: prismaTrip.priceType,
      maxPersons: prismaTrip.maxPersons,
      coverImage: prismaTrip.coverImage,
      coverImageIndex: prismaTrip.coverImageIndex,
      status: prismaTrip.status as TripStatus,
      isActive: prismaTrip.isActive ?? true,
      publishedAt: prismaTrip.publishedAt ? new Date(prismaTrip.publishedAt) : undefined,
      idPromoter: prismaTrip.idPromoter ? BigInt(prismaTrip.idPromoter) : undefined,
      createdAt: prismaTrip.createdAt ? new Date(prismaTrip.createdAt) : new Date(),
      updatedAt: prismaTrip.updatedAt ? new Date(prismaTrip.updatedAt) : new Date(),
      routePoints: prismaTrip.routePoints
        ? prismaTrip.routePoints.map((rp: any) => ({
            id: rp.id,
            idTrip: rp.idTrip,
            name: rp.name,
            latitude: Number(rp.latitude),
            longitude: Number(rp.longitude),
            order: rp.order,
          }))
        : undefined,
      galleryImages: prismaTrip.galleryImages
        ? prismaTrip.galleryImages.map((gi: any) => ({
            id: gi.id,
            idTrip: gi.idTrip,
            imageUrl: gi.imageUrl,
            order: gi.order,
          }))
        : undefined,
      itineraryDays: prismaTrip.itineraryDays
        ? prismaTrip.itineraryDays.map((day: any) => ({
            id: day.id,
            idTrip: day.idTrip,
            day: day.day,
            title: day.title,
            subtitle: day.subtitle,
            order: day.order,
            activities: day.activities.map((act: any) => ({
              id: act.id,
              idDay: act.idDay,
              type: act.type,
              title: act.title,
              description: act.description,
              time: act.time,
              imageUrl: act.imageUrl,
              latitude: act.latitude ? Number(act.latitude) : undefined,
              longitude: act.longitude ? Number(act.longitude) : undefined,
              poiId: act.poiId,
              order: act.order,
            })),
          }))
        : undefined,
    });
  }
}
