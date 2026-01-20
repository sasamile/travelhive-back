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
   * Si un usuario solo puede tener una agencia, retorna la aprobada o la más reciente
   */
  private async getUserAgencyId(userId: string): Promise<bigint> {
    // Obtener todas las agencias del usuario con información completa
    const agencyMembers = await this.prisma.agencyMember.findMany({
      where: { idUser: userId },
      include: { agency: true },
      orderBy: {
        createdAt: 'desc', // Ordenar por más reciente primero
      },
    });

    if (!agencyMembers || agencyMembers.length === 0) {
      throw new NotFoundException('No se encontró ninguna agencia asociada a tu usuario');
    }

    // Si solo hay una, retornarla directamente
    if (agencyMembers.length === 1) {
      return agencyMembers[0].idAgency;
    }

    // Si hay múltiples, buscar primero una aprobada (y priorizar la más reciente)
    const approvedAgency = agencyMembers.find(
      (member) => member.agency.approvalStatus === 'APPROVED',
    );

    if (approvedAgency) {
      return approvedAgency.idAgency;
    }

    // Si no hay aprobada, usar la primera (ya está ordenada por más reciente)
    return agencyMembers[0].idAgency;
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
    // Convertir BigInt a número para el DTO usando toString() para evitar pérdida de precisión
    const tripData = {
      ...dto,
      idAgency: Number(agencyId.toString()),
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
