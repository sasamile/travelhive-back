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
  UseInterceptors,
  UploadedFiles,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ParseJsonFieldInterceptor } from '../interceptors/parse-json-field.interceptor';
import { Session, AllowAnonymous } from '@thallesp/nestjs-better-auth';
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
import { S3Service } from '../../config/storage/s3.service';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';

@Controller('agencies')
export class AgencyController {
  constructor(
    private readonly registerAgencyUseCase: RegisterAgencyUseCase,
    private readonly createTripUseCase: CreateTripUseCase,
    private readonly s3Service: S3Service,
    private readonly listTripsUseCase: ListTripsUseCase,
    private readonly updateTripUseCase: UpdateTripUseCase,
    private readonly deleteTripUseCase: DeleteTripUseCase,
    private readonly createExpeditionUseCase: CreateExpeditionUseCase,
    private readonly listExpeditionsUseCase: ListExpeditionsUseCase,
    private readonly prisma: PrismaService,
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

    // Debug: Log de todas las agencias encontradas
    console.log('[DEBUG getUserAgencyId] Agencias encontradas para usuario:', userId);
    agencyMembers.forEach((member, index) => {
      console.log(`[DEBUG getUserAgencyId] Agencia ${index + 1}:`, {
        idAgency: member.idAgency.toString(),
        role: member.role,
        approvalStatus: member.agency.approvalStatus,
      });
    });

    // Si solo hay una agencia, retornarla directamente
    if (agencyMembers.length === 1) {
      const selectedAgency = agencyMembers[0].idAgency;
      console.log('[DEBUG getUserAgencyId] Retornando única agencia:', selectedAgency.toString());
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
    console.log('[DEBUG getUserAgencyId] Retornando agencia seleccionada (múltiples):', selectedAgency.toString());
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
    // Este método ya garantiza que la agencia pertenece al usuario
    const agencyId = await this.getUserAgencyId(session.user.id);
    
    // Debug: Log para verificar el agencyId obtenido
    console.log('[DEBUG createTrip] AgencyId obtenido:', agencyId.toString());
    console.log('[DEBUG createTrip] UserId:', session.user.id);
    
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
   * Lista todos los trips de la agencia del usuario
   * La agencia se obtiene automáticamente de la sesión del usuario
   */
  @Get('trips')
  async listTrips(@Session() session: UserSession) {
    // Obtener la agencia del usuario desde la sesión
    const agencyId = await this.getUserAgencyId(session.user.id);
    
    const trips = await this.listTripsUseCase.execute(
      agencyId,
      session.user.id,
    );

    return {
      data: trips,
    };
  }

  /**
   * Actualiza un trip existente de la agencia del usuario
   * La agencia se obtiene automáticamente de la sesión del usuario
   */
  @Put('trips/:tripId')
  async updateTrip(
    @Param('tripId') tripId: string,
    @Body() dto: UpdateTripDto,
    @Session() session: UserSession,
  ) {
    // Obtener la agencia del usuario desde la sesión
    const agencyId = await this.getUserAgencyId(session.user.id);
    
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
