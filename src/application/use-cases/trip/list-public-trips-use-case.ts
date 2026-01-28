import { Injectable, Inject } from '@nestjs/common';
import type { ITripRepository, PublicTripsResult, PublicTripFilters } from '../../../domain/ports/trip.repository.port';
import { TRIP_REPOSITORY } from '../../../domain/ports/tokens';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';

@Injectable()
export class ListPublicTripsUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY)
    private readonly tripRepository: ITripRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(filters: {
    origen?: string;
    destino?: string;
    destination?: string;
    startDate?: string;
    endDate?: string;
    persons?: number;
    type?: 'TRIP' | 'EXPERIENCE';
    page?: number;
    limit?: number;
  }): Promise<PublicTripsResult> {
    let idCity: bigint | undefined;
    let idCityOrigin: bigint | undefined;
    let idCityDestination: bigint | undefined;
    let destinationCityName: string | undefined;

    // Si se proporciona el nombre de la ciudad de origen, buscar su ID
    if (filters.origen) {
      const cities = await this.prisma.$queryRaw<any[]>`
        SELECT id_city, name_city
        FROM cities
        WHERE LOWER(name_city) = LOWER(${filters.origen})
        LIMIT 1
      `;

      if (cities && cities.length > 0) {
        idCityOrigin = BigInt(cities[0].id_city);
      } else {
        // Si no se encuentra la ciudad de origen, retornar resultado vacío
        return {
          trips: [],
          total: 0,
          page: filters.page || 1,
          limit: filters.limit || 20,
          totalPages: 0,
        };
      }
    }

    // Si se proporciona el nombre de la ciudad de destino, buscar su ID
    if (filters.destino) {
      const cities = await this.prisma.$queryRaw<any[]>`
        SELECT id_city, name_city
        FROM cities
        WHERE LOWER(name_city) = LOWER(${filters.destino})
        LIMIT 1
      `;

      if (cities && cities.length > 0) {
        idCityDestination = BigInt(cities[0].id_city);
        destinationCityName = cities[0].name_city;
        // También establecer idCity para compatibilidad con filtro antiguo
        idCity = idCityDestination;
      } else {
        // Si no se encuentra la ciudad de destino, retornar resultado vacío
        return {
          trips: [],
          total: 0,
          page: filters.page || 1,
          limit: filters.limit || 20,
          totalPages: 0,
        };
      }
    } else if (filters.destination) {
      // Si se proporciona el ID directamente (mantiene compatibilidad)
      idCity = BigInt(filters.destination);
      idCityDestination = idCity;
    }

    const repositoryFilters: PublicTripFilters = {
      ...(idCity && {
        idCity,
      }),
      ...(idCityOrigin && {
        idCityOrigin,
      }),
      ...(idCityDestination && {
        idCityDestination,
      }),
      ...(destinationCityName && {
        destinationCityName,
      }),
      ...(filters.startDate && {
        startDate: new Date(filters.startDate),
      }),
      ...(filters.endDate && {
        endDate: new Date(filters.endDate),
      }),
      ...(filters.persons && {
        persons: filters.persons,
      }),
      ...(filters.type && {
        type: filters.type,
      }),
      page: filters.page || 1,
      limit: filters.limit || 20,
    };

    return await this.tripRepository.findPublicTrips(repositoryFilters);
  }
}
