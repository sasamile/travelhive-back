import {
  Controller,
  Post,
  Get,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFiles,
  UploadedFile,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ParseJsonFieldInterceptor } from '../interceptors/parse-json-field.interceptor';
import { Session, AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { RegisterAgencyUseCase } from '../../application/use-cases/auth/register-use-case';
import { CreateTripUseCase } from '../../application/use-cases/trip/create-trip-use-case';
import { ListTripsUseCase } from '../../application/use-cases/trip/list-trips-use-case';
import { GetTripByIdUseCase } from '../../application/use-cases/trip/get-trip-by-id-use-case';
import { UpdateTripUseCase } from '../../application/use-cases/trip/update-trip-use-case';
import { DeleteTripUseCase } from '../../application/use-cases/trip/delete-trip-use-case';
import { ChangeTripStatusUseCase } from '../../application/use-cases/trip/change-trip-status-use-case';
import { ToggleTripActiveUseCase } from '../../application/use-cases/trip/toggle-trip-active-use-case';
import { CreateExpeditionUseCase } from '../../application/use-cases/expedition/create-expedition-use-case';
import { ListExpeditionsUseCase } from '../../application/use-cases/expedition/list-expeditions-use-case';
import { ListAgencyExpeditionsUseCase } from '../../application/use-cases/expedition/list-agency-expeditions-use-case';
import { RegisterAgencyDto } from '../dto/register-agency.dto';
import { CreateTripDto } from '../dto/create-trip.dto';
import { UpdateTripDto } from '../dto/update-trip.dto';
import { ChangeTripStatusDto } from '../dto/change-trip-status.dto';
import { ToggleTripActiveDto } from '../dto/toggle-trip-active.dto';
import { CreateExpeditionDto } from '../dto/create-expedition.dto';
import { ListExpeditionsDto } from '../dto/list-expeditions.dto';
import { S3Service } from '../../config/storage/s3.service';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { UpdateAgencyUseCase } from '../../application/use-cases/agency/update-agency-use-case';
import { CreateBookingUseCase } from '../../application/use-cases/booking/create-booking-use-case';
import { ListMyBookingsUseCase } from '../../application/use-cases/booking/list-my-bookings-use-case';
import { UpdateAgencyDto } from '../dto/update-agency.dto';
import { CreateBookingDto } from '../dto/create-booking.dto';

@Controller('agencies')
export class AgencyController {
  constructor(
    private readonly registerAgencyUseCase: RegisterAgencyUseCase,
    private readonly createTripUseCase: CreateTripUseCase,
    private readonly s3Service: S3Service,
    private readonly listTripsUseCase: ListTripsUseCase,
    private readonly getTripByIdUseCase: GetTripByIdUseCase,
    private readonly updateTripUseCase: UpdateTripUseCase,
    private readonly deleteTripUseCase: DeleteTripUseCase,
    private readonly changeTripStatusUseCase: ChangeTripStatusUseCase,
    private readonly toggleTripActiveUseCase: ToggleTripActiveUseCase,
    private readonly createExpeditionUseCase: CreateExpeditionUseCase,
    private readonly listExpeditionsUseCase: ListExpeditionsUseCase,
    private readonly listAgencyExpeditionsUseCase: ListAgencyExpeditionsUseCase,
    private readonly prisma: PrismaService,
    private readonly updateAgencyUseCase: UpdateAgencyUseCase,
    private readonly createBookingUseCase: CreateBookingUseCase,
    private readonly listMyBookingsUseCase: ListMyBookingsUseCase,
  ) {}

  /**
   * Helper para obtener la agencia del usuario desde la sesión
   * Retorna la primera agencia aprobada, o la primera si no hay aprobadas
   * Usa exactamente la misma lógica que el hook de login
   */
  private async getUserAgencyId(userId: string): Promise<bigint> {
    // Consulta exacta igual que el hook de login en auth.config.ts
    const agencyMembers = await this.prisma.agencyMember.findMany({
      where: { idUser: userId },
      include: { agency: true },
    });

    if (!agencyMembers || agencyMembers.length === 0) {
      throw new NotFoundException('No se encontró ninguna agencia asociada a tu usuario');
    }

    // Si solo hay una agencia, retornarla directamente
    if (agencyMembers.length === 1) {
      const selectedAgency = agencyMembers[0].idAgency;
      return selectedAgency;
    }

    // Si hay múltiples, buscar la primera aprobada
    // Ordenar: aprobadas primero, luego por fecha de creación (más reciente primero)
    const sortedAgencies = [...agencyMembers].sort((a, b) => {
      // Priorizar aprobadas
      if (a.agency.approvalStatus === 'APPROVED' && b.agency.approvalStatus !== 'APPROVED') {
        return -1;
      }
      if (b.agency.approvalStatus === 'APPROVED' && a.agency.approvalStatus !== 'APPROVED') {
        return 1;
      }
      // Si mismo estado, ordenar por fecha (más reciente primero)
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    // Retornar la primera (priorizando aprobadas)
    const selectedAgency = sortedAgencies[0].idAgency;
    return selectedAgency;
  }

  /**
   * Registra un nuevo usuario-agencia
   * Crea tanto el usuario como la agencia y los relaciona
   * Este endpoint es público - no requiere autenticación
   */
  @Post('register')
  @AllowAnonymous()
  @HttpCode(HttpStatus.CREATED)
  async registerAgency(@Body() dto: RegisterAgencyDto) {
    const result = await this.registerAgencyUseCase.execute({
      emailUser: dto.emailUser,
      nameUser: dto.nameUser,
      password: dto.password,
      dniUser: dto.dniUser,
      phoneUser: dto.phoneUser,
      picture: dto.picture,
      nameAgency: dto.nameAgency,
      phone: dto.phone,
      nit: dto.nit,
      rntNumber: dto.rntNumber,
      pictureAgency: dto.pictureAgency,
    });

    return {
      message: 'Agencia registrada exitosamente. Pendiente de aprobación.',
      data: result,
    };
  }

  /**
   * Crea un nuevo trip (experiencia) para la agencia del usuario
   * Acepta imágenes en el campo 'galleryImages' (múltiples archivos)
   * La agencia se obtiene automáticamente de la sesión del usuario
   */
  @Post('trips')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FilesInterceptor('galleryImages', 20), // Máximo 20 imágenes
    ParseJsonFieldInterceptor, // Parsea campos JSON en form-data
  )
  async createTrip(
    @Body() dto: CreateTripDto,
    @UploadedFiles() files: any[], // Archivos subidos
    @Session() session: UserSession,
  ) {
    // Obtener la agencia del usuario desde la sesión
    // Este metodo ya garantiza que la agencia pertenece al usuario
    const agencyId = await this.getUserAgencyId(session.user.id);

    // Subir imágenes a S3 si hay archivos
    let uploadedImageUrls: string[] = [];
    if (files && files.length > 0) {
      uploadedImageUrls = await this.s3Service.uploadMultipleImages(files, 'trips');
    }

    // Si hay imágenes subidas, reemplazar las URLs en galleryImages
    if (uploadedImageUrls.length > 0 && dto.galleryImages) {
      // Combinar imágenes subidas con las que ya vienen en el DTO (si hay)
      const combinedImages = uploadedImageUrls.map((url, index) => ({
        imageUrl: url,
        order: dto.galleryImages?.[index]?.order ?? index,
      }));
      
      // Si había más imágenes en el DTO, mantenerlas
      const existingImages = (dto.galleryImages || []).slice(uploadedImageUrls.length);
      dto.galleryImages = [...combinedImages, ...existingImages];
    } else if (uploadedImageUrls.length > 0) {
      // Si no había galleryImages en el DTO, crear el array con las subidas
      dto.galleryImages = uploadedImageUrls.map((url, index) => ({
        imageUrl: url,
        order: index,
      }));
    }

    // Agregar el idAgency al DTO (obtenido de la sesión)
    // Usar string para evitar pérdida de precisión con BigInt grandes
    const tripData = {
      ...dto,
      idAgency: agencyId.toString(),
    };

    const trip = await this.createTripUseCase.execute(
      tripData,
      session.user.id,
    );

    return {
      message: 'Trip creado exitosamente',
      data: trip,
    };
  }

  /**
   * Lista todas las expediciones de la agencia del usuario con información completa
   * Incluye ocupación, ingresos, filtros por estado y paginación
   * La agencia se obtiene automáticamente de la sesión del usuario
   */
  @Get('trips')
  async listTrips(
    @Session() session: UserSession,
    @Query() query: ListExpeditionsDto,
  ) {
    // Obtener la agencia del usuario desde la sesión
    const agencyId = await this.getUserAgencyId(session.user.id);
    
    return await this.listAgencyExpeditionsUseCase.execute(
      agencyId,
      session.user.id,
      {
        status: query.status as string | undefined,
        search: query.search,
        date: query.date,
        page: query.page,
        limit: query.limit,
      },
    );
  }

  /**
   * Obtiene un trip individual por ID
   * La agencia se obtiene automáticamente de la sesión del usuario
   */
  @Get('trips/:tripId')
  async getTripById(
    @Param('tripId') tripId: string,
    @Session() session: UserSession,
  ) {
    // Obtener la agencia del usuario desde la sesión
    const agencyId = await this.getUserAgencyId(session.user.id);
    
    const trip = await this.getTripByIdUseCase.execute(
      agencyId,
      BigInt(tripId),
      session.user.id,
    );

    return {
      data: trip,
    };
  }

  /**
   * Actualiza un trip existente de la agencia del usuario
   * Acepta imágenes en el campo 'galleryImages' (múltiples archivos)
   * La agencia se obtiene automáticamente de la sesión del usuario
   */
  @Patch('trips/:tripId')
  @UseInterceptors(
    FilesInterceptor('galleryImages', 20), // Máximo 20 imágenes
    ParseJsonFieldInterceptor, // Parsea campos JSON en form-data
  )
  async updateTrip(
    @Param('tripId') tripId: string,
    @Body() dto: UpdateTripDto,
    @UploadedFiles() files: any[], // Archivos subidos
    @Session() session: UserSession,
  ) {
    // Obtener la agencia del usuario desde la sesión
    const agencyId = await this.getUserAgencyId(session.user.id);

    // Subir imágenes a S3 si hay archivos
    let uploadedImageUrls: string[] = [];
    if (files && files.length > 0) {
      uploadedImageUrls = await this.s3Service.uploadMultipleImages(files, 'trips');
    }

    // Si hay imágenes subidas, reemplazar las URLs en galleryImages
    if (uploadedImageUrls.length > 0 && dto.galleryImages) {
      // Combinar imágenes subidas con las que ya vienen en el DTO (si hay)
      const combinedImages = uploadedImageUrls.map((url, index) => ({
        imageUrl: url,
        order: dto.galleryImages?.[index]?.order ?? index,
      }));
      
      // Si había más imágenes en el DTO, mantenerlas
      const existingImages = (dto.galleryImages || []).slice(uploadedImageUrls.length);
      dto.galleryImages = [...combinedImages, ...existingImages];
    } else if (uploadedImageUrls.length > 0) {
      // Si no había galleryImages en el DTO, crear el array con las subidas
      dto.galleryImages = uploadedImageUrls.map((url, index) => ({
        imageUrl: url,
        order: index,
      }));
    }
    
    const trip = await this.updateTripUseCase.execute(
      agencyId,
      BigInt(tripId),
      dto,
      session.user.id,
    );

    return {
      message: 'Trip actualizado exitosamente',
      data: trip,
    };
  }

  /**
   * Elimina un trip de la agencia del usuario
   * La agencia se obtiene automáticamente de la sesión del usuario
   */
  @Delete('trips/:tripId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTrip(
    @Param('tripId') tripId: string,
    @Session() session: UserSession,
  ) {
    // Obtener la agencia del usuario desde la sesión
    const agencyId = await this.getUserAgencyId(session.user.id);
    
    await this.deleteTripUseCase.execute(
      agencyId,
      BigInt(tripId),
      session.user.id,
    );

    return {
      message: 'Trip eliminado exitosamente',
    };
  }

  /**
   * Cambia el estado de un trip (DRAFT, PUBLISHED, ARCHIVED)
   * La agencia se obtiene automáticamente de la sesión del usuario
   */
  @Put('trips/:tripId/status')
  async changeTripStatus(
    @Param('tripId') tripId: string,
    @Body() dto: ChangeTripStatusDto,
    @Session() session: UserSession,
  ) {
    // Obtener la agencia del usuario desde la sesión
    const agencyId = await this.getUserAgencyId(session.user.id);
    
    const trip = await this.changeTripStatusUseCase.execute(
      agencyId,
      BigInt(tripId),
      dto.status,
      session.user.id,
    );

    return {
      message: `Estado del trip cambiado a ${dto.status}`,
      data: trip,
    };
  }

  /**
   * Activa o desactiva un trip
   * La agencia se obtiene automáticamente de la sesión del usuario
   */
  @Put('trips/:tripId/active')
  async toggleTripActive(
    @Param('tripId') tripId: string,
    @Body() dto: ToggleTripActiveDto,
    @Session() session: UserSession,
  ) {
    // Obtener la agencia del usuario desde la sesión
    const agencyId = await this.getUserAgencyId(session.user.id);
    
    const trip = await this.toggleTripActiveUseCase.execute(
      agencyId,
      BigInt(tripId),
      dto.isActive,
      session.user.id,
    );

    return {
      message: `Trip ${dto.isActive ? 'activado' : 'desactivado'} exitosamente`,
      data: trip,
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

  /**
   * Actualiza la información de la agencia del usuario autenticado.
   * Permisos: roles admin/editor dentro de la agencia.
   */
  @Patch('me')
  @UseInterceptors(
    FileInterceptor('picture'),
    ParseJsonFieldInterceptor,
  )
  async updateMyAgency(
    @Session() session: UserSession,
    @Body() dto: UpdateAgencyDto,
    @UploadedFile() pictureFile?: any,
  ) {
    const agencyId = await this.getUserAgencyId(session.user.id);

    let pictureUrl = dto.picture;
    if (pictureFile) {
      pictureUrl = await this.s3Service.uploadImage(pictureFile, 'agencies');
    }

    const updated = await this.updateAgencyUseCase.execute({
      agencyId,
      userId: session.user.id,
      nameAgency: dto.nameAgency,
      email: dto.email,
      phone: dto.phone,
      nit: dto.nit,
      rntNumber: dto.rntNumber,
      picture: pictureUrl,
    });

    return { message: 'Agencia actualizada', data: updated };
  }

  /**
   * Compra/reserva cupos en una expedición (usuario normal).
   * Crea un Booking y descuenta cupos con transacción.
   */
  @Post('bookings')
  @HttpCode(HttpStatus.CREATED)
  async createBooking(@Session() session: UserSession, @Body() dto: CreateBookingDto) {
    const booking = await this.createBookingUseCase.execute({
      userId: session.user.id,
      idTrip: BigInt(dto.idTrip),
      idExpedition: BigInt(dto.idExpedition),
      adults: dto.adults,
      children: dto.children,
      discountCode: dto.discountCode,
    });

    return { message: 'Compra realizada', data: booking };
  }

  /**
   * Lista las compras del usuario autenticado.
   */
  @Get('bookings')
  async listMyBookings(@Session() session: UserSession) {
    return await this.listMyBookingsUseCase.execute(session.user.id);
  }
}
