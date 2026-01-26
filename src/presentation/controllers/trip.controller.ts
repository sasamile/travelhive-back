import { Controller, Get, Query, Param } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { ListPublicTripsUseCase } from '../../application/use-cases/trip/list-public-trips-use-case';
import { GetPublicTripByIdUseCase } from '../../application/use-cases/trip/get-public-trip-by-id-use-case';
import { ListPublicTripsDto } from '../dto/list-public-trips.dto';

@Controller('trips')
export class TripController {
  constructor(
    private readonly listPublicTripsUseCase: ListPublicTripsUseCase,
    private readonly getPublicTripByIdUseCase: GetPublicTripByIdUseCase,
  ) {}

  /**
   * Endpoint público para listar todos los viajes publicados de todas las agencias aprobadas
   * Permite filtrar por destino, fechas y cantidad de personas
   * No requiere autenticación
   */
  @Get()
  @AllowAnonymous()
  async listPublicTrips(@Query() query: ListPublicTripsDto) {
    const result = await this.listPublicTripsUseCase.execute({
      origen: query.origen,
      destino: query.destino,
      destination: query.destination,
      startDate: query.startDate,
      endDate: query.endDate,
      persons: query.persons,
      page: query.page,
      limit: query.limit,
    });

    // Formatear respuesta con BigInt convertidos a string
    const formattedTrips = result.trips.map((trip: any) => ({
      ...trip,
      idTrip: trip.idTrip.toString(),
      idAgency: trip.idAgency.toString(),
      idCity: trip.idCity.toString(),
      agency: trip.agency
        ? {
            ...trip.agency,
            idAgency: trip.agency.idAgency.toString(),
          }
        : null,
      city: trip.city
        ? {
            ...trip.city,
            idCity: trip.city.idCity.toString(),
          }
        : null,
      expeditions: trip.expeditions || [],
    }));

    return {
      data: formattedTrips,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    };
  }

  /**
   * Endpoint público para obtener un viaje específico por ID
   * Solo muestra viajes publicados de agencias aprobadas
   * No requiere autenticación
   */
  @Get(':id')
  @AllowAnonymous()
  async getPublicTripById(@Param('id') id: string) {
    const trip = await this.getPublicTripByIdUseCase.execute(id);

    // Formatear respuesta con BigInt convertidos a string
    return {
      data: {
        ...trip,
        idTrip: trip.idTrip.toString(),
        idAgency: trip.idAgency.toString(),
        idCity: trip.idCity.toString(),
        agency: (trip as any).agency
          ? {
              ...(trip as any).agency,
              idAgency: (trip as any).agency.idAgency.toString(),
            }
          : null,
        city: (trip as any).city
          ? {
              ...(trip as any).city,
              idCity: (trip as any).city.idCity.toString(),
            }
          : null,
        expeditions: (trip as any).expeditions || [],
      },
    };
  }
}
