import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { RegisterAgencyUseCase } from '../../application/use-cases/auth/register-use-case';
import { CreateTripUseCase } from '../../application/use-cases/trip/create-trip-use-case';
import { ListTripsUseCase } from '../../application/use-cases/trip/list-trips-use-case';
import { UpdateTripUseCase } from '../../application/use-cases/trip/update-trip-use-case';
import { DeleteTripUseCase } from '../../application/use-cases/trip/delete-trip-use-case';
import { CreateExpeditionUseCase } from '../../application/use-cases/expedition/create-expedition-use-case';
import { ListExpeditionsUseCase } from '../../application/use-cases/expedition/list-expeditions-use-case';
import { RegisterAgencyDto } from '../dto/register-agency.dto';
import { CreateTripDto } from '../dto/create-trip.dto';
import { UpdateTripDto } from '../dto/update-trip.dto';
import { CreateExpeditionDto } from '../dto/create-expedition.dto';

@Controller('agencies')
export class AgencyController {
  constructor(
    private readonly registerAgencyUseCase: RegisterAgencyUseCase,
    private readonly createTripUseCase: CreateTripUseCase,
    private readonly listTripsUseCase: ListTripsUseCase,
    private readonly updateTripUseCase: UpdateTripUseCase,
    private readonly deleteTripUseCase: DeleteTripUseCase,
    private readonly createExpeditionUseCase: CreateExpeditionUseCase,
    private readonly listExpeditionsUseCase: ListExpeditionsUseCase,
  ) {}

  /**
   * Registra un nuevo usuario-agencia
   * Crea tanto el usuario como la agencia y los relaciona
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async registerAgency(@Body() dto: RegisterAgencyDto) {
    const result = await this.registerAgencyUseCase.execute({
      emailUser: dto.emailUser,
      nameUser: dto.nameUser,
      password: dto.password,
      dniUser: dto.dniUser,
      phoneUser: dto.phoneUser,
      pictureUser: dto.pictureUser,
      idCity: dto.idCity ? BigInt(dto.idCity) : undefined,
      nameAgency: dto.nameAgency,
      email: dto.email,
      phone: dto.phone,
      nit: dto.nit,
      rntNumber: dto.rntNumber,
      picture: dto.picture,
    });

    return {
      message: 'Agencia registrada exitosamente. Pendiente de aprobación.',
      data: result,
    };
  }

  /**
   * Crea un nuevo trip (experiencia) para la agencia
   */
  @Post(':agencyId/trips')
  @HttpCode(HttpStatus.CREATED)
  async createTrip(
    @Param('agencyId') agencyId: string,
    @Body() dto: CreateTripDto,
    @Session() session: UserSession,
  ) {
    const trip = await this.createTripUseCase.execute(
      {
        idAgency: BigInt(agencyId),
        idCity: BigInt(dto.idCity),
        title: dto.title,
        description: dto.description,
        category: dto.category,
        vibe: dto.vibe,
        durationDays: dto.durationDays,
        durationNights: dto.durationNights,
        coverImage: dto.coverImage,
        status: dto.status,
      },
      session.user.id,
    );

    return {
      message: 'Trip creado exitosamente',
      data: trip,
    };
  }

  /**
   * Lista todos los trips de una agencia
   */
  @Get(':agencyId/trips')
  async listTrips(
    @Param('agencyId') agencyId: string,
    @Session() session: UserSession,
  ) {
    const trips = await this.listTripsUseCase.execute(
      BigInt(agencyId),
      session.user.id,
    );

    return {
      data: trips,
    };
  }

  /**
   * Actualiza un trip existente
   */
  @Put(':agencyId/trips/:tripId')
  async updateTrip(
    @Param('agencyId') agencyId: string,
    @Param('tripId') tripId: string,
    @Body() dto: UpdateTripDto,
    @Session() session: UserSession,
  ) {
    const trip = await this.updateTripUseCase.execute(
      BigInt(agencyId),
      BigInt(tripId),
      {
        title: dto.title,
        description: dto.description,
        category: dto.category,
        vibe: dto.vibe,
        durationDays: dto.durationDays,
        durationNights: dto.durationNights,
        coverImage: dto.coverImage,
        status: dto.status as any,
        idCity: dto.idCity ? BigInt(dto.idCity) : undefined,
      },
      session.user.id,
    );

    return {
      message: 'Trip actualizado exitosamente',
      data: trip,
    };
  }

  /**
   * Elimina un trip
   */
  @Delete(':agencyId/trips/:tripId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTrip(
    @Param('agencyId') agencyId: string,
    @Param('tripId') tripId: string,
    @Session() session: UserSession,
  ) {
    await this.deleteTripUseCase.execute(
      BigInt(agencyId),
      BigInt(tripId),
      session.user.id,
    );

    return {
      message: 'Trip eliminado exitosamente',
    };
  }

  /**
   * Crea una nueva expedición (instancia de trip con fechas)
   */
  @Post('trips/:tripId/expeditions')
  @HttpCode(HttpStatus.CREATED)
  async createExpedition(
    @Param('tripId') tripId: string,
    @Body() dto: CreateExpeditionDto,
    @Session() session: UserSession,
  ) {
    const expedition = await this.createExpeditionUseCase.execute(
      {
        idTrip: BigInt(tripId),
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        capacityTotal: dto.capacityTotal,
        capacityAvailable: dto.capacityAvailable,
        priceAdult: dto.priceAdult,
        priceChild: dto.priceChild,
        currency: dto.currency,
        status: dto.status,
      },
      session.user.id,
    );

    return {
      message: 'Expedición creada exitosamente',
      data: expedition,
    };
  }

  /**
   * Lista todas las expediciones de un trip
   */
  @Get('trips/:tripId/expeditions')
  async listExpeditions(
    @Param('tripId') tripId: string,
    @Session() session: UserSession,
  ) {
    const expeditions = await this.listExpeditionsUseCase.execute(
      BigInt(tripId),
      session.user.id,
    );

    return {
      data: expeditions,
    };
  }
}
