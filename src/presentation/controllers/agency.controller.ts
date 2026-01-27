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
import { GetTripStatsUseCase } from '../../application/use-cases/trip/get-trip-stats-use-case';
import { UpdateTripUseCase } from '../../application/use-cases/trip/update-trip-use-case';
import { DeleteTripUseCase } from '../../application/use-cases/trip/delete-trip-use-case';
import { ChangeTripStatusUseCase } from '../../application/use-cases/trip/change-trip-status-use-case';
import { ToggleTripActiveUseCase } from '../../application/use-cases/trip/toggle-trip-active-use-case';
import { CreateExpeditionUseCase } from '../../application/use-cases/expedition/create-expedition-use-case';
import { ListExpeditionsUseCase } from '../../application/use-cases/expedition/list-expeditions-use-case';
import { ListAgencyExpeditionsUseCase } from '../../application/use-cases/expedition/list-agency-expeditions-use-case';
import { UpdateExpeditionUseCase } from '../../application/use-cases/expedition/update-expedition-use-case';
import { DeleteExpeditionUseCase } from '../../application/use-cases/expedition/delete-expedition-use-case';
import { RegisterAgencyDto } from '../dto/register-agency.dto';
import { CreateTripDto } from '../dto/create-trip.dto';
import { UpdateTripDto } from '../dto/update-trip.dto';
import { ChangeTripStatusDto } from '../dto/change-trip-status.dto';
import { ToggleTripActiveDto } from '../dto/toggle-trip-active.dto';
import { CreateExpeditionDto } from '../dto/create-expedition.dto';
import { ListExpeditionsDto } from '../dto/list-expeditions.dto';
import { UpdateExpeditionDto } from '../dto/update-expedition.dto';
import { S3Service } from '../../config/storage/s3.service';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { UpdateAgencyUseCase } from '../../application/use-cases/agency/update-agency-use-case';
import { CreateAgencyMemberUseCase } from '../../application/use-cases/agency/create-agency-member-use-case';
import { UpdateAgencyMemberUseCase } from '../../application/use-cases/agency/update-agency-member-use-case';
import { DeleteAgencyMemberUseCase } from '../../application/use-cases/agency/delete-agency-member-use-case';
import { ToggleAgencyMemberActiveUseCase } from '../../application/use-cases/agency/toggle-agency-member-active-use-case';
import { ActivateAgencyMemberUseCase } from '../../application/use-cases/agency/activate-agency-member-use-case';
import { DeactivateAgencyMemberUseCase } from '../../application/use-cases/agency/deactivate-agency-member-use-case';
import { ChangeAgencyMemberPasswordUseCase } from '../../application/use-cases/agency/change-agency-member-password-use-case';
import { ListAgencyMembersUseCase } from '../../application/use-cases/agency/list-agency-members-use-case';
import { CreateBookingUseCase } from '../../application/use-cases/booking/create-booking-use-case';
import { ListMyBookingsUseCase } from '../../application/use-cases/booking/list-my-bookings-use-case';
import { ListAgencyBookingsUseCase } from '../../application/use-cases/booking/list-agency-bookings-use-case';
import { GetAgencyInsightsUseCase } from '../../application/use-cases/agency/get-agency-insights-use-case';
import { UpdateAgencyDto } from '../dto/update-agency.dto';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { CreateAgencyMemberDto } from '../dto/create-agency-member.dto';
import { UpdateAgencyMemberDto } from '../dto/update-agency-member.dto';
import { ChangeMemberPasswordDto } from '../dto/change-member-password.dto';
import { ListAgencyMembersDto } from '../dto/list-agency-members.dto';

@Controller('agencies')
export class AgencyController {
  constructor(
    private readonly registerAgencyUseCase: RegisterAgencyUseCase,
    private readonly createTripUseCase: CreateTripUseCase,
    private readonly s3Service: S3Service,
    private readonly listTripsUseCase: ListTripsUseCase,
    private readonly getTripByIdUseCase: GetTripByIdUseCase,
    private readonly getTripStatsUseCase: GetTripStatsUseCase,
    private readonly updateTripUseCase: UpdateTripUseCase,
    private readonly deleteTripUseCase: DeleteTripUseCase,
    private readonly changeTripStatusUseCase: ChangeTripStatusUseCase,
    private readonly toggleTripActiveUseCase: ToggleTripActiveUseCase,
    private readonly createExpeditionUseCase: CreateExpeditionUseCase,
    private readonly listExpeditionsUseCase: ListExpeditionsUseCase,
    private readonly listAgencyExpeditionsUseCase: ListAgencyExpeditionsUseCase,
    private readonly updateExpeditionUseCase: UpdateExpeditionUseCase,
    private readonly deleteExpeditionUseCase: DeleteExpeditionUseCase,
    private readonly prisma: PrismaService,
    private readonly updateAgencyUseCase: UpdateAgencyUseCase,
    private readonly createAgencyMemberUseCase: CreateAgencyMemberUseCase,
    private readonly updateAgencyMemberUseCase: UpdateAgencyMemberUseCase,
    private readonly deleteAgencyMemberUseCase: DeleteAgencyMemberUseCase,
    private readonly toggleAgencyMemberActiveUseCase: ToggleAgencyMemberActiveUseCase,
    private readonly activateAgencyMemberUseCase: ActivateAgencyMemberUseCase,
    private readonly deactivateAgencyMemberUseCase: DeactivateAgencyMemberUseCase,
    private readonly changeAgencyMemberPasswordUseCase: ChangeAgencyMemberPasswordUseCase,
    private readonly listAgencyMembersUseCase: ListAgencyMembersUseCase,
    private readonly createBookingUseCase: CreateBookingUseCase,
    private readonly listMyBookingsUseCase: ListMyBookingsUseCase,
    private readonly listAgencyBookingsUseCase: ListAgencyBookingsUseCase,
    private readonly getAgencyInsightsUseCase: GetAgencyInsightsUseCase,
  ) {}

  /**
   * Helper para obtener la agencia del usuario desde la sesión
   * Retorna la primera agencia aprobada, o la primera si no hay aprobadas
   * Usa exactamente la misma lógica que el hook de login
   */
  private async getUserAgencyId(userId: string): Promise<bigint> {
    // Consulta usando $queryRaw para evitar problemas con isActive si la columna no existe aún
    const agencyMembers = await this.prisma.$queryRaw<any[]>`
      SELECT 
        am.id,
        am.id_agency as "idAgency",
        am.user_id as "idUser",
        am.role,
        am.created_at as "createdAt",
        a.id_agency as "agency_idAgency",
        a.approval_status as "agency_approvalStatus",
        a.created_at as "agency_createdAt"
      FROM agency_members am
      INNER JOIN agencies a ON am.id_agency = a.id_agency
      WHERE am.user_id = ${userId}
    `;

    if (!agencyMembers || agencyMembers.length === 0) {
      throw new NotFoundException('No se encontró ninguna agencia asociada a tu usuario');
    }

    // Si solo hay una agencia, retornarla directamente
    if (agencyMembers.length === 1) {
      const selectedAgency = BigInt(agencyMembers[0].idAgency);
      return selectedAgency;
    }

    // Si hay múltiples, buscar la primera aprobada
    // Ordenar: aprobadas primero, luego por fecha de creación (más reciente primero)
    const sortedAgencies = [...agencyMembers].sort((a: any, b: any) => {
      // Priorizar aprobadas
      if (a.agency_approvalStatus === 'APPROVED' && b.agency_approvalStatus !== 'APPROVED') {
        return -1;
      }
      if (b.agency_approvalStatus === 'APPROVED' && a.agency_approvalStatus !== 'APPROVED') {
        return 1;
      }
      // Si mismo estado, ordenar por fecha (más reciente primero)
      return new Date(b.agency_createdAt).getTime() - new Date(a.agency_createdAt).getTime();
    });

    // Retornar la primera (priorizando aprobadas)
    const selectedAgency = BigInt(sortedAgencies[0].idAgency);
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
   * Obtiene estadísticas detalladas de un viaje
   * Incluye: promoter, estadísticas mensuales, códigos de descuento, ganancias e historial de reservas
   * 
   * Ejemplo:
   * GET /agencies/trips/123456789/stats
   */
  @Get('trips/:tripId/stats')
  async getTripStats(
    @Param('tripId') tripId: string,
    @Session() session: UserSession,
  ) {
    // Obtener la agencia del usuario desde la sesión
    const agencyId = await this.getUserAgencyId(session.user.id);
    
    const stats = await this.getTripStatsUseCase.execute({
      tripId: BigInt(tripId),
      agencyId,
      userId: session.user.id,
    });

    return stats;
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
   * Actualiza una expedición existente
   * IMPORTANTE: Solo bloquea edición si hay reservas CONFIRMED, no PENDING
   * Las reservas PENDING no bloquean porque el pago no se completó
   */
  @Patch('trips/:tripId/expeditions/:expeditionId')
  async updateExpedition(
    @Param('tripId') tripId: string,
    @Param('expeditionId') expeditionId: string,
    @Body() dto: UpdateExpeditionDto,
    @Session() session: UserSession,
  ) {
    const expedition = await this.updateExpeditionUseCase.execute(
      BigInt(tripId),
      BigInt(expeditionId),
      dto,
      session.user.id,
    );

    return {
      message: 'Expedición actualizada exitosamente',
      data: expedition,
    };
  }

  /**
   * Elimina una expedición
   * Solo para administradores
   * Solo permite eliminar expediciones SIN reservas (ni PENDING ni CONFIRMED)
   * Recomendado: expediciones en borrador, desactivadas o canceladas
   */
  @Delete('trips/:tripId/expeditions/:expeditionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteExpedition(
    @Param('tripId') tripId: string,
    @Param('expeditionId') expeditionId: string,
    @Session() session: UserSession,
  ) {
    await this.deleteExpeditionUseCase.execute(
      BigInt(tripId),
      BigInt(expeditionId),
      session.user.id,
    );

    return {
      message: 'Expedición eliminada exitosamente',
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
   * Genera link de pago de Wompi.
   */
  @Post('bookings')
  @HttpCode(HttpStatus.CREATED)
  async createBooking(@Session() session: UserSession, @Body() dto: CreateBookingDto) {
    const booking = await this.createBookingUseCase.execute({
      userId: session.user.id,
      userEmail: session.user.email,
      idTrip: BigInt(dto.idTrip),
      idExpedition: BigInt(dto.idExpedition),
      adults: dto.adults,
      children: dto.children,
      discountCode: dto.discountCode,
      redirectUrl: dto.redirectUrl,
    });

    return { message: 'Reserva creada exitosamente', data: booking };
  }

  /**
   * Lista todas las reservas de la agencia del usuario autenticado
   * Permite filtrar por estado, fechas y buscar por ID de reserva o viajero
   * Solo usuarios admin o editor pueden acceder
   * 
   * Ejemplos:
   * GET /agencies/bookings - Todas las reservas
   * GET /agencies/bookings?status=confirmed - Solo confirmadas
   * GET /agencies/bookings?status=pending - Solo pendientes
   * GET /agencies/bookings?search=BK-94821 - Buscar por ID
   * GET /agencies/bookings?search=marcus - Buscar por nombre/email del viajero
   * GET /agencies/bookings?startDate=2023-10-01&endDate=2023-10-31 - Filtrar por fechas
   * GET /agencies/bookings?status=confirmed&page=1&limit=10 - Con paginación
   */
  @Get('bookings')
  async listAgencyBookings(
    @Session() session: UserSession,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const agencyId = await this.getUserAgencyId(session.user.id);
    
    const result = await this.listAgencyBookingsUseCase.execute({
      agencyId,
      userId: session.user.id,
      status: status as any,
      search,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    return result;
  }

  /**
   * Obtiene análisis e insights de la agencia
   * Incluye estadísticas, crecimiento de ingresos, destinos top y checklist de optimización
   * 
   * Ejemplos:
   * GET /agencies/insights - Insights de los últimos 6 meses
   * GET /agencies/insights?startDate=2023-01-01&endDate=2023-12-31 - Insights de un rango específico
   */
  @Get('insights')
  async getAgencyInsights(
    @Session() session: UserSession,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const agencyId = await this.getUserAgencyId(session.user.id);
    
    const result = await this.getAgencyInsightsUseCase.execute({
      agencyId,
      userId: session.user.id,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    return result;
  }

  /**
   * Crea un nuevo miembro de la agencia con contraseña temporal
   * Solo los administradores pueden crear miembros
   */
  @Post('members')
  @HttpCode(HttpStatus.CREATED)
  async createMember(
    @Body() dto: CreateAgencyMemberDto,
    @Session() session: UserSession,
  ) {
    const agencyId = await this.getUserAgencyId(session.user.id);

    const result = await this.createAgencyMemberUseCase.execute({
      agencyId,
      userId: session.user.id,
      email: dto.email,
      name: dto.name,
      role: dto.role,
      dni: dto.dni,
      phone: dto.phone,
    });

    return {
      message: 'Miembro creado exitosamente',
      data: result,
    };
  }

  /**
   * Lista todos los miembros de la agencia con filtros opcionales
   * Solo los administradores pueden listar miembros
   * Filtros disponibles: isActive, role, phone, dni, search
   */
  @Get('members')
  async listMembers(
    @Session() session: UserSession,
    @Query() query: ListAgencyMembersDto,
  ) {
    const agencyId = await this.getUserAgencyId(session.user.id);

    return await this.listAgencyMembersUseCase.execute({
      agencyId,
      userId: session.user.id,
      filters: {
        isActive: query.isActive,
        role: query.role,
        phone: query.phone,
        dni: query.dni,
        search: query.search,
      },
    });
  }

  /**
   * Actualiza la información de un miembro de la agencia
   * Solo los administradores pueden editar miembros
   */
  @Patch('members/:memberId')
  async updateMember(
    @Param('memberId') memberId: string,
    @Body() dto: UpdateAgencyMemberDto,
    @Session() session: UserSession,
  ) {
    const agencyId = await this.getUserAgencyId(session.user.id);

    const result = await this.updateAgencyMemberUseCase.execute({
      agencyId,
      memberId: BigInt(memberId),
      userId: session.user.id,
      email: dto.email,
      name: dto.name,
      role: dto.role,
      dni: dto.dni,
      phone: dto.phone,
    });

    return {
      message: 'Miembro actualizado exitosamente',
      data: result,
    };
  }

  /**
   * Elimina un miembro de la agencia
   * Solo los administradores pueden eliminar miembros
   */
  @Delete('members/:memberId')
  @HttpCode(HttpStatus.OK)
  async deleteMember(
    @Param('memberId') memberId: string,
    @Session() session: UserSession,
  ) {
    const agencyId = await this.getUserAgencyId(session.user.id);

    return await this.deleteAgencyMemberUseCase.execute({
      agencyId,
      memberId: BigInt(memberId),
      userId: session.user.id,
    });
  }

  /**
   * Activa un miembro de la agencia
   * Solo los administradores pueden activar miembros
   */
  @Put('members/:memberId/activate')
  async activateMember(
    @Param('memberId') memberId: string,
    @Session() session: UserSession,
  ) {
    const agencyId = await this.getUserAgencyId(session.user.id);

    const result = await this.activateAgencyMemberUseCase.execute({
      agencyId,
      memberId: BigInt(memberId),
      userId: session.user.id,
    });

    return {
      message: result.message,
      data: {
        id: result.id,
        isActive: result.isActive,
      },
    };
  }

  /**
   * Desactiva un miembro de la agencia
   * Solo los administradores pueden desactivar miembros
   * Los miembros desactivados siguen apareciendo en el listado pero con isActive: false
   */
  @Put('members/:memberId/deactivate')
  async deactivateMember(
    @Param('memberId') memberId: string,
    @Session() session: UserSession,
  ) {
    const agencyId = await this.getUserAgencyId(session.user.id);

    const result = await this.deactivateAgencyMemberUseCase.execute({
      agencyId,
      memberId: BigInt(memberId),
      userId: session.user.id,
    });

    return {
      message: result.message,
      data: {
        id: result.id,
        isActive: result.isActive,
      },
    };
  }

  /**
   * Cambia la contraseña de un miembro de la agencia
   * Solo los administradores pueden cambiar contraseñas
   */
  @Put('members/:memberId/password')
  async changeMemberPassword(
    @Param('memberId') memberId: string,
    @Body() dto: ChangeMemberPasswordDto,
    @Session() session: UserSession,
  ) {
    const agencyId = await this.getUserAgencyId(session.user.id);

    return await this.changeAgencyMemberPasswordUseCase.execute({
      agencyId,
      memberId: BigInt(memberId),
      userId: session.user.id,
      newPassword: dto.newPassword,
    });
  }
}
