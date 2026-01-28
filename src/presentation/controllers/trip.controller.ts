import { Controller, Get, Post, Query, Param, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { ListPublicTripsUseCase } from '../../application/use-cases/trip/list-public-trips-use-case';
import { GetPublicTripByIdUseCase } from '../../application/use-cases/trip/get-public-trip-by-id-use-case';
import { RegisterPromoterViewUseCase } from '../../application/use-cases/promoter/register-promoter-view-use-case';
import { ListPublicTripsDto } from '../dto/list-public-trips.dto';

@Controller('trips')
export class TripController {
  constructor(
    private readonly listPublicTripsUseCase: ListPublicTripsUseCase,
    private readonly getPublicTripByIdUseCase: GetPublicTripByIdUseCase,
    private readonly registerPromoterViewUseCase: RegisterPromoterViewUseCase,
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
      idAgency: trip.idAgency?.toString(),
      idHost: trip.idHost,
      idCity: trip.idCity.toString(),
      agency: trip.agency
        ? {
            ...trip.agency,
            idAgency: trip.agency.idAgency.toString(),
          }
        : null,
      host: trip.host
        ? {
            id: trip.host.id,
            name: trip.host.name,
            image: trip.host.image,
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
   * Endpoint público para listar TODOS los viajes (type=TRIP) publicados
   * Solo muestra viajes de agencias aprobadas que están publicados y disponibles
   * No requiere autenticación
   */
  @Get('all')
  @AllowAnonymous()
  async listAllTrips(@Query('page') page?: string, @Query('limit') limit?: string) {
    const result = await this.listPublicTripsUseCase.execute({
      type: 'TRIP',
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 100, // Por defecto 100 para mostrar todos
    });

    // Formatear respuesta
    const formattedTrips = result.trips.map((trip: any) => ({
      ...trip,
      idTrip: trip.idTrip.toString(),
      idAgency: trip.idAgency?.toString(),
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
   * Endpoint público para obtener un viaje o experiencia específico por ID
   * Funciona tanto para viajes (TRIP) de agencias aprobadas como para experiencias (EXPERIENCE) de hosts
   * Solo muestra viajes/experiencias publicados y activos
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
        idAgency: trip.idAgency?.toString(),
        idHost: trip.idHost,
        idCity: trip.idCity.toString(),
        agency: (trip as any).agency
          ? {
              ...(trip as any).agency,
              idAgency: (trip as any).agency.idAgency.toString(),
            }
          : null,
        host: (trip as any).host
          ? {
              id: (trip as any).host.id,
              name: (trip as any).host.name,
              image: (trip as any).host.image,
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

  /**
   * Endpoint para registrar una vista de promoter cuando alguien entra al link con ?promoter=CODIGO
   * No requiere autenticación (puede ser usuario anónimo)
   * Solo cuenta una vez por usuario (o IP si es anónimo) por promoter+trip
   */
  @Post(':id/view')
  @AllowAnonymous()
  @HttpCode(HttpStatus.OK)
  async registerPromoterView(
    @Param('id') id: string,
    @Query('promoter') promoterCode: string,
    @Req() req: any,
  ) {
    if (!promoterCode) {
      return {
        registered: false,
        message: 'Código de promoter no proporcionado',
      };
    }

    // Obtener información del usuario si está autenticado
    const session: UserSession | undefined = req.session;
    const userId = session?.user?.id;

    // Obtener IP y User-Agent del request
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await this.registerPromoterViewUseCase.execute({
      promoterCode,
      idTrip: BigInt(id),
      userId: userId || undefined,
      ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
      userAgent,
    });

    return result;
  }
}
