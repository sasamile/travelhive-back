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
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ParseJsonFieldInterceptor } from '../interceptors/parse-json-field.interceptor';
import { Session } from '@thallesp/nestjs-better-auth';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { S3Service } from '../../config/storage/s3.service';
import { CreateTripUseCase } from '../../application/use-cases/trip/create-trip-use-case';
import { UpdateTripUseCase } from '../../application/use-cases/trip/update-trip-use-case';
import { DeleteTripUseCase } from '../../application/use-cases/trip/delete-trip-use-case';
import { GetTripStatsUseCase } from '../../application/use-cases/trip/get-trip-stats-use-case';
import { ListTripReviewsUseCase } from '../../application/use-cases/trip-review/list-trip-reviews-use-case';
import { CreateTripDto } from '../dto/create-trip.dto';
import { UpdateTripDto } from '../dto/update-trip.dto';
import { ChangeTripStatusDto } from '../dto/change-trip-status.dto';
import { ToggleTripActiveDto } from '../dto/toggle-trip-active.dto';
import { TripStatus, TripType } from '../../domain/entities/trip.entity';

@Controller('experiences')
export class ExperienceController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly createTripUseCase: CreateTripUseCase,
    private readonly updateTripUseCase: UpdateTripUseCase,
    private readonly deleteTripUseCase: DeleteTripUseCase,
    private readonly getTripStatsUseCase: GetTripStatsUseCase,
    private readonly listTripReviewsUseCase: ListTripReviewsUseCase,
  ) {}

  /**
   * Helper para obtener la agencia del usuario (si es agencia) o null (si es host)
   */
  private async getUserAgencyId(userId: string): Promise<bigint | null> {
    const agencyMembers = await this.prisma.$queryRaw<any[]>`
      SELECT 
        am.id_agency as "idAgency",
        a.approval_status as "agency_approvalStatus"
      FROM agency_members am
      INNER JOIN agencies a ON am.id_agency = a.id_agency
      WHERE am.user_id = ${userId}
      ORDER BY 
        CASE WHEN a.approval_status = 'APPROVED' THEN 0 ELSE 1 END,
        a.created_at DESC
      LIMIT 1
    `;

    if (!agencyMembers || agencyMembers.length === 0) {
      return null; // Es un host, no una agencia
    }

    return BigInt(agencyMembers[0].idAgency);
  }

  /**
   * Verificar si el usuario es un host
   */
  private async isHost(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isHost: true },
    });
    return user?.isHost ?? false;
  }

  /**
   * Crea una nueva experiencia (trip)
   * Funciona tanto para agencias como para anfitriones (hosts)
   * Acepta imágenes en el campo 'galleryImages' (múltiples archivos)
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FilesInterceptor('galleryImages', 20), // Máximo 20 imágenes
    ParseJsonFieldInterceptor, // Parsea campos JSON en form-data
  )
  async createExperience(
    @Body() dto: CreateTripDto,
    @UploadedFiles() files: any[],
    @Session() session: UserSession,
  ) {
    // Determinar si es agencia o host
    const agencyId = await this.getUserAgencyId(session.user.id);
    const isHostUser = await this.isHost(session.user.id);

    if (!agencyId && !isHostUser) {
      throw new ForbiddenException('Debes ser una agencia o un anfitrión para crear experiencias');
    }

    // Debug: verificar archivos recibidos
    console.log('📸 Archivos recibidos:', files?.length || 0);
    if (files && files.length > 0) {
      console.log('📸 Primer archivo:', {
        fieldname: files[0]?.fieldname,
        originalname: files[0]?.originalname,
        mimetype: files[0]?.mimetype,
        size: files[0]?.size,
        buffer: files[0]?.buffer ? `Buffer(${files[0].buffer.length} bytes)` : 'No buffer',
      });
    }

    // Subir imágenes a S3 si hay archivos
    let uploadedImageUrls: string[] = [];
    if (files && files.length > 0) {
      try {
        uploadedImageUrls = await this.s3Service.uploadMultipleImages(files, 'experiences');
        console.log('✅ Imágenes subidas exitosamente:', uploadedImageUrls.length);
      } catch (error) {
        console.error('❌ Error subiendo imágenes:', error);
        throw error;
      }
    } else {
      console.log('⚠️ No se recibieron archivos para subir');
    }

    // Si hay imágenes subidas, reemplazar las URLs en galleryImages
    if (uploadedImageUrls.length > 0 && dto.galleryImages) {
      const combinedImages = uploadedImageUrls.map((url, index) => ({
        imageUrl: url,
        order: dto.galleryImages?.[index]?.order ?? index,
      }));
      const existingImages = (dto.galleryImages || []).slice(uploadedImageUrls.length);
      dto.galleryImages = [...combinedImages, ...existingImages];
    } else if (uploadedImageUrls.length > 0) {
      dto.galleryImages = uploadedImageUrls.map((url, index) => ({
        imageUrl: url,
        order: index,
      }));
    }

    // Si hay imágenes pero no se especificó coverImageIndex, usar la primera imagen (índice 0) como cover
    if (dto.galleryImages && dto.galleryImages.length > 0 && dto.coverImageIndex === undefined) {
      dto.coverImageIndex = 0;
      console.log('📷 Usando primera imagen como cover (índice 0)');
    }

    // Preparar datos del trip
    // Las experiencias siempre se crean con type=EXPERIENCE y se publican automáticamente
    const tripData = {
      ...dto,
      type: 'EXPERIENCE' as any, // Siempre EXPERIENCE para este endpoint
      idAgency: agencyId ? agencyId.toString() : undefined,
      idHost: !agencyId ? session.user.id : undefined,
    };

    const trip = await this.createTripUseCase.execute(
      tripData,
      session.user.id,
    );

    return {
      message: 'Experiencia creada exitosamente',
      data: trip,
    };
  }

  /**
   * Endpoint público para listar TODAS las experiencias (type=EXPERIENCE) publicadas
   * Solo muestra experiencias que están publicadas y disponibles
   * No requiere autenticación
   */
  @Get('all')
  @AllowAnonymous()
  async listAllPublicExperiences(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 100; // Por defecto 100 para mostrar todas
    const skip = (pageNum - 1) * limitNum;

    // Obtener todas las experiencias publicadas (tanto de agencias como de hosts)
    const where: any = {
      type: 'EXPERIENCE' as any,
      status: TripStatus.PUBLISHED,
      isActive: true,
      OR: [
        // Experiencias de agencias aprobadas
        {
          idAgency: { not: null },
          agency: {
            approvalStatus: 'APPROVED' as any,
          },
        },
        // Experiencias de hosts
        {
          idHost: { not: null },
        },
      ],
    } as any;

    const [experiences, total] = await Promise.all([
      this.prisma.trip.findMany({
        where,
        include: {
          city: true,
          agency: {
            select: {
              idAgency: true,
              nameAgency: true,
              picture: true,
            },
          },
          host: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          galleryImages: {
            orderBy: { order: 'asc' },
          },
          routePoints: {
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limitNum,
      }),
      this.prisma.trip.count({ where }),
    ]);

    // Formatear experiencias
    const formattedExperiences = experiences.map((exp: any) => ({
      idTrip: exp.idTrip.toString(),
      idAgency: exp.idAgency?.toString() || null,
      idHost: exp.idHost || null,
      idCity: exp.idCity.toString(),
      type: exp.type,
      title: exp.title,
      description: exp.description,
      category: exp.category,
      destinationRegion: exp.destinationRegion,
      latitude: exp.latitude ? Number(exp.latitude) : null,
      longitude: exp.longitude ? Number(exp.longitude) : null,
      location: exp.location,
      startDate: exp.startDate,
      endDate: exp.endDate,
      durationDays: exp.durationDays,
      durationNights: exp.durationNights,
      price: exp.price ? Number(exp.price) : null,
      currency: exp.currency,
      priceType: exp.priceType,
      maxPersons: exp.maxPersons,
      coverImage: exp.coverImage,
      coverImageIndex: exp.coverImageIndex,
      status: exp.status,
      isActive: exp.isActive,
      publishedAt: exp.publishedAt,
      createdAt: exp.createdAt,
      updatedAt: exp.updatedAt,
      agency: exp.agency
        ? {
            idAgency: exp.agency.idAgency.toString(),
            nameAgency: exp.agency.nameAgency,
            picture: exp.agency.picture,
          }
        : null,
      host: exp.host
        ? {
            id: exp.host.id,
            name: exp.host.name,
            image: exp.host.image,
          }
        : null,
      city: {
        idCity: exp.city.idCity.toString(),
        nameCity: exp.city.nameCity,
      },
      galleryImages: exp.galleryImages.map((img: any) => ({
        id: img.id.toString(),
        imageUrl: img.imageUrl,
        order: img.order,
      })),
      routePoints: exp.routePoints.map((rp: any) => ({
        id: rp.id.toString(),
        name: rp.name,
        latitude: rp.latitude ? Number(rp.latitude) : null,
        longitude: rp.longitude ? Number(rp.longitude) : null,
        order: rp.order,
      })),
    }));

    return {
      data: formattedExperiences,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  /**
   * Endpoint para obtener analíticas agregadas de todas las experiencias del host/agencia
   * Incluye: total earnings, average rating, conversion rate, monthly revenue, y stats por experiencia
   */
  @Get('analytics')
  async getExperiencesAnalytics(
    @Session() session: UserSession,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const agencyId = await this.getUserAgencyId(session.user.id);
    const isHostUser = await this.isHost(session.user.id);

    if (!agencyId && !isHostUser) {
      throw new ForbiddenException('Debes ser una agencia o un anfitrión para ver analíticas');
    }

    // Construir filtro de fechas
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate);
    }

    // Obtener todas las experiencias del usuario con sus bookings y reviews
    const where: any = {
      type: 'EXPERIENCE' as any,
      ...(agencyId ? { idAgency: agencyId } : { idHost: session.user.id }),
    };

    const experiences = await this.prisma.trip.findMany({
      where,
      include: {
        bookings: {
          where: {
            status: 'CONFIRMED',
            ...(Object.keys(dateFilter).length > 0 && { dateBuy: dateFilter }),
          },
          select: {
            idBooking: true,
            totalBuy: true,
            dateBuy: true,
            currency: true,
            status: true,
          },
        },
        reviews: {
          select: {
            rating: true,
          },
        },
        favorites: {
          select: {
            id: true,
          },
        },
      },
    });

    // Calcular estadísticas agregadas
    let totalEarnings = 0;
    const allRatings: number[] = [];
    let totalBookings = 0;
    let totalFavorites = 0;
    const monthlyRevenueMap = new Map<string, number>();

    // Procesar cada experiencia
    const experiencesWithStats = experiences.map((exp: any) => {
      const expRevenue = exp.bookings.reduce((sum: number, b: any) => sum + Number(b.totalBuy), 0);
      totalEarnings += expRevenue;

      const expRatings = exp.reviews.map((r: any) => r.rating);
      allRatings.push(...expRatings);

      const expBookings = exp.bookings.length;
      totalBookings += expBookings;

      const expFavorites = exp.favorites.length;
      totalFavorites += expFavorites;

      // Agrupar revenue por mes
      exp.bookings.forEach((booking: any) => {
        const date = new Date(booking.dateBuy);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const currentRevenue = monthlyRevenueMap.get(monthKey) || 0;
        monthlyRevenueMap.set(monthKey, currentRevenue + Number(booking.totalBuy));
      });

      const avgRating =
        expRatings.length > 0
          ? expRatings.reduce((sum: number, r: number) => sum + r, 0) / expRatings.length
          : null;

      return {
        id: exp.idTrip.toString(),
        idTrip: exp.idTrip.toString(),
        title: exp.title,
        price: exp.price ? Number(exp.price) : null,
        currency: exp.currency,
        stats: {
          totalBookings: expBookings,
          totalReviews: exp.reviews.length,
          averageRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
          totalFavorites: expFavorites,
        },
        revenueRaw: expRevenue,
      };
    });

    // Calcular average rating general
    const averageRating =
      allRatings.length > 0
        ? allRatings.reduce((sum, rating) => sum + rating, 0) / allRatings.length
        : 0;

    // Calcular conversion rate (bookings / (favorites * 10) como proxy de views)
    // O usar un cálculo más realista basado en bookings vs total de experiencias vistas
    const totalViews = totalFavorites * 10; // Estimación: cada favorito = ~10 vistas
    const conversionRate = totalViews > 0 ? (totalBookings / totalViews) * 100 : 0;

    // Convertir monthlyRevenueMap a array ordenado
    const monthlyRevenue: Array<{ date: string; revenue: number }> = Array.from(
      monthlyRevenueMap.entries(),
    )
      .map(([date, revenue]) => ({
        date,
        revenue,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Si no hay fechas específicas, generar últimos 30 días
    if (monthlyRevenue.length === 0) {
      const today = new Date();
      for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyRevenue.push({
          date: monthKey,
          revenue: 0,
        });
      }
    }

    return {
      totalEarnings,
      averageRating: Math.round(averageRating * 100) / 100,
      conversionRate: Math.round(conversionRate * 10) / 10,
      monthlyRevenue,
      experiences: experiencesWithStats,
    };
  }

  /**
   * Endpoint para obtener el historial de reservas de las experiencias del host
   * Permite filtrar por experiencia específica
   * Solo para hosts (personas naturales)
   */
  @Get('bookings')
  async getHostBookings(
    @Session() session: UserSession,
    @Query('experienceId') experienceId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const isHostUser = await this.isHost(session.user.id);

    if (!isHostUser) {
      throw new ForbiddenException('Este endpoint solo está disponible para anfitriones (hosts)');
    }

    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const skip = (pageNum - 1) * limitNum;

    // Construir filtro para las experiencias del host
    const tripWhere: any = {
      type: 'EXPERIENCE' as any,
      idHost: session.user.id,
    };

    if (experienceId) {
      tripWhere.idTrip = BigInt(experienceId);
    }

    // Obtener IDs de las experiencias del host
    const hostTrips = await this.prisma.trip.findMany({
      where: tripWhere,
      select: { idTrip: true },
    });

    if (hostTrips.length === 0) {
      return {
        data: [],
        pagination: {
          total: 0,
          page: pageNum,
          limit: limitNum,
          totalPages: 0,
        },
      };
    }

    const tripIds = hostTrips.map((t) => t.idTrip);

    // Construir filtro para bookings
    const bookingWhere: any = {
      idTrip: { in: tripIds },
    };

    if (status) {
      bookingWhere.status = status.toUpperCase();
    }

    if (startDate || endDate) {
      bookingWhere.dateBuy = {};
      if (startDate) {
        bookingWhere.dateBuy.gte = new Date(startDate);
      }
      if (endDate) {
        bookingWhere.dateBuy.lte = new Date(endDate);
      }
    }

    // Obtener bookings con toda la información relacionada
    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where: bookingWhere,
        include: {
          trip: {
            select: {
              idTrip: true,
              title: true,
              coverImage: true,
              type: true,
              city: {
                select: {
                  idCity: true,
                  nameCity: true,
                },
              },
            },
          },
          expedition: {
            select: {
              idExpedition: true,
              startDate: true,
              endDate: true,
              status: true,
              capacityTotal: true,
              capacityAvailable: true,
            },
          },
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              phoneUser: true,
            },
          },
          bookingItems: {
            select: {
              id: true,
              itemType: true,
              description: true,
              quantity: true,
              unitPrice: true,
              totalPrice: true,
            },
          },
        },
        orderBy: {
          dateBuy: 'desc',
        },
        skip,
        take: limitNum,
      }),
      this.prisma.booking.count({ where: bookingWhere }),
    ]);

    // Formatear bookings
    const formattedBookings = bookings.map((booking: any) => {
      const totalSeats = booking.bookingItems.reduce(
        (sum: number, item: any) => sum + item.quantity,
        0,
      );

      // Formatear fecha de salida
      const departureDate = booking.expedition.startDate
        ? new Date(booking.expedition.startDate).toLocaleDateString('es-ES', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : 'Sin fecha';

      // Formatear ID de booking
      const formattedId = `#BK-${booking.idBooking.toString().slice(-5)}`;

      // Formatear asientos
      const seatsInfo = `${totalSeats}/${booking.expedition.capacityTotal || 'N/A'}`;

      // Formatear moneda
      const formatCurrency = (amount: number, currency: string) => {
        return new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: currency === 'COP' ? 'COP' : currency === 'EUR' ? 'EUR' : 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(amount);
      };

      return {
        // Formato principal para el frontend
        id: formattedId, // "#BK-94821"
        expedition: booking.trip.title,
        departure: departureDate,
        traveler: {
          name: booking.owner.name,
          email: booking.owner.email,
          phone: booking.owner.phoneUser,
          avatar: booking.owner.image || undefined,
        },
        seats: seatsInfo,
        total: formatCurrency(Number(booking.totalBuy), booking.currency),
        status: booking.status.toLowerCase(), // 'confirmed', 'pending', 'cancelled'

        // Información adicional completa
        idBooking: booking.idBooking.toString(),
        idTrip: booking.idTrip.toString(),
        idExpedition: booking.expedition.idExpedition.toString(),
        statusRaw: booking.status,
        subtotal: Number(booking.subtotal),
        serviceFee: Number(booking.serviceFee),
        discountCode: booking.discountCode,
        discountAmount: Number(booking.discountAmount),
        totalBuy: Number(booking.totalBuy),
        currency: booking.currency,
        dateBuy: booking.dateBuy,
        referenceBuy: booking.referenceBuy,
        transactionId: booking.transactionId,
        paymentSource: booking.paymentSource,
        promoterCode: booking.promoterCode,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        trip: {
          idTrip: booking.trip.idTrip.toString(),
          title: booking.trip.title,
          coverImage: booking.trip.coverImage,
          type: booking.trip.type,
          city: booking.trip.city
            ? {
                idCity: booking.trip.city.idCity.toString(),
                nameCity: booking.trip.city.nameCity,
              }
            : null,
        },
        expeditionDetails: {
          idExpedition: booking.expedition.idExpedition.toString(),
          startDate: booking.expedition.startDate.toISOString(),
          endDate: booking.expedition.endDate.toISOString(),
          status: booking.expedition.status,
          capacityTotal: booking.expedition.capacityTotal,
          capacityAvailable: booking.expedition.capacityAvailable,
          dates: departureDate,
        },
        bookingItems: booking.bookingItems.map((item: any) => ({
          id: item.id.toString(),
          itemType: item.itemType,
          description: item.description,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
        })),
        totalSeats,
      };
    });

    return {
      data: formattedBookings,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  /**
   * Lista todas las experiencias del usuario (agencia o host) con información completa
   * Incluye ocupación, ingresos, estadísticas y filtros por estado
   */
  @Get()
  async listExperiences(
    @Session() session: UserSession,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const agencyId = await this.getUserAgencyId(session.user.id);
    const isHostUser = await this.isHost(session.user.id);

    if (!agencyId && !isHostUser) {
      throw new ForbiddenException('Debes ser una agencia o un anfitrión para ver experiencias');
    }

    // Buscar solo experiencias (type=EXPERIENCE) por agencia o por host
    const where: any = {
      type: 'EXPERIENCE', // Solo experiencias, no viajes
    };
    if (agencyId) {
      where.idAgency = agencyId;
    } else {
      where.idHost = session.user.id;
    }

    // Filtro por estado
    if (status) {
      where.status = status;
    }

    // Filtro de búsqueda por título
    if (search && search.trim()) {
      where.title = {
        contains: search.trim(),
        mode: 'insensitive',
      };
    }

    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const skip = (pageNum - 1) * limitNum;

    // Obtener experiencias con toda la información relacionada
    const [experiences, total] = await Promise.all([
      this.prisma.trip.findMany({
        where,
        include: {
          city: true,
          agency: agencyId
            ? {
                select: {
                  idAgency: true,
                  nameAgency: true,
                  picture: true,
                },
              }
            : false,
          host: !agencyId
            ? {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              }
            : false,
          galleryImages: {
            orderBy: { order: 'asc' },
          },
          bookings: {
            where: {
              status: {
                not: 'CANCELLED',
              },
            },
            select: {
              idBooking: true,
              totalBuy: true,
              currency: true,
              bookingItems: {
                select: {
                  quantity: true,
                },
              },
            },
          },
          reviews: {
            select: {
              rating: true,
            },
          },
          favorites: {
            select: {
              id: true,
            },
          },
          discountCodes: {
            where: {
              active: true,
            },
            select: {
              id: true,
              codeName: true,
              value: true,
            },
          },
          promoter: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      this.prisma.trip.count({ where }),
    ]);

    // Formatear experiencias con información completa
    const formattedExperiences = experiences.map((exp: any) => {
      // Calcular ocupación (personas reservadas)
      const totalPersonsBooked = (exp.bookings || []).reduce((sum: number, booking: any) => {
        const bookingPersons = (booking.bookingItems || []).reduce(
          (itemSum: number, item: any) => itemSum + item.quantity,
          0,
        );
        return sum + bookingPersons;
      }, 0);

      // Calcular ingresos totales
      const totalRevenue = (exp.bookings || []).reduce((sum: number, booking: any) => {
        return sum + Number(booking.totalBuy);
      }, 0);

      // Calcular rating promedio
      const avgRating =
        (exp.reviews || []).length > 0
          ? (exp.reviews || []).reduce((sum: number, review: any) => sum + review.rating, 0) / (exp.reviews || []).length
          : 0;

      // Formatear fechas
      const dates =
        exp.startDate && exp.endDate
          ? `${new Date(exp.startDate).toLocaleDateString('es-ES', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })} - ${new Date(exp.endDate).toLocaleDateString('es-ES', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}`
          : exp.startDate
            ? new Date(exp.startDate).toLocaleDateString('es-ES', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : 'Sin fecha definida';

      // Formatear duración
      const duration =
        exp.durationDays > 0
          ? `${exp.durationDays} día${exp.durationDays > 1 ? 's' : ''}${
              exp.durationNights > 0 ? `, ${exp.durationNights} noche${exp.durationNights > 1 ? 's' : ''}` : ''
            }`
          : 'Sin duración definida';

      // Formatear moneda
      const formatCurrency = (amount: number, currency?: string) => {
        const currencySymbol = currency === 'USD' ? '$' : currency === 'COP' ? '$' : '';
        return `${currencySymbol}${amount.toLocaleString('es-ES', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
      };

      // Determinar color del estado
      const getStatusColor = (status: string) => {
        switch (status) {
          case 'PUBLISHED':
            return 'green';
          case 'DRAFT':
            return 'gray';
          case 'ARCHIVED':
            return 'red';
          default:
            return 'gray';
        }
      };

      return {
        // Información básica
        id: exp.idTrip.toString(),
        idTrip: exp.idTrip.toString(),
        idAgency: exp.idAgency?.toString(),
        idHost: exp.idHost,
        type: exp.type,
        title: exp.title,
        description: exp.description,
        category: exp.category,
        location: exp.location,
        city: exp.city
          ? {
              idCity: exp.city.idCity.toString(),
              nameCity: exp.city.nameCity,
            }
          : null,
        agency: exp.agency
          ? {
              idAgency: exp.agency.idAgency.toString(),
              nameAgency: exp.agency.nameAgency,
              picture: exp.agency.picture,
            }
          : null,
        host: exp.host
          ? {
              id: exp.host.id,
              name: exp.host.name,
              image: exp.host.image,
            }
          : null,

        // Fechas y duración
        startDate: exp.startDate?.toISOString(),
        endDate: exp.endDate?.toISOString(),
        dates, // Formateado para mostrar
        duration, // Formateado para mostrar
        durationDays: exp.durationDays,
        durationNights: exp.durationNights,

        // Precio
        price: exp.price ? Number(exp.price) : null,
        currency: exp.currency,
        priceType: exp.priceType,

        // Imágenes
        coverImage: exp.coverImage,
        coverImageIndex: exp.coverImageIndex,
        galleryImages: (exp.galleryImages || []).map((img: any) => ({
          id: img.id.toString(),
          imageUrl: img.imageUrl,
          order: img.order,
        })),

        // Estado
        status: exp.status,
        statusColor: getStatusColor(exp.status),
        isActive: exp.isActive,
        publishedAt: exp.publishedAt?.toISOString(),

        // Estadísticas
        occupancy: {
          current: totalPersonsBooked,
          total: exp.maxPersons || 0,
          percentage:
            exp.maxPersons && exp.maxPersons > 0
              ? Math.round((totalPersonsBooked / exp.maxPersons) * 100)
              : 0,
        },
        revenue: formatCurrency(totalRevenue, exp.currency || 'COP'),
        revenueRaw: totalRevenue,
        stats: {
          totalBookings: (exp.bookings || []).length,
          totalReviews: (exp.reviews || []).length,
          totalFavorites: (exp.favorites || []).length,
          averageRating: Math.round(avgRating * 10) / 10,
        },

        // Códigos de descuento activos
        discountCodes: (exp.discountCodes || []).map((code: any) => ({
          id: code.id.toString(),
          code: code.codeName,
          discount: code.value,
        })),

        // Promoter (solo para agencias)
        promoter: exp.promoter
          ? {
              id: exp.promoter.id.toString(),
              code: exp.promoter.code,
              name: exp.promoter.name,
            }
          : null,

        // Fechas de creación/actualización
        createdAt: exp.createdAt.toISOString(),
        updatedAt: exp.updatedAt.toISOString(),
      };
    });

    // Calcular conteos por estado si no hay filtro específico
    let counts: { published: number; draft: number; archived: number } | undefined;
    if (!status) {
      const [publishedCount, draftCount, archivedCount] = await Promise.all([
        this.prisma.trip.count({
          where: { ...where, status: 'PUBLISHED' },
        }),
        this.prisma.trip.count({
          where: { ...where, status: 'DRAFT' },
        }),
        this.prisma.trip.count({
          where: { ...where, status: 'ARCHIVED' },
        }),
      ]);

      counts = {
        published: publishedCount,
        draft: draftCount,
        archived: archivedCount,
      };
    }

    return {
      data: formattedExperiences,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
      counts,
    };
  }

  /**
   * Cambia el estado de una experiencia (PUBLISHED, DRAFT, ARCHIVED)
   * IMPORTANTE: Esta ruta debe ir ANTES de ':id' para que NestJS la capture correctamente
   */
  @Put(':id/status')
  async changeExperienceStatus(
    @Param('id') id: string,
    @Body() dto: ChangeTripStatusDto,
    @Session() session: UserSession,
  ) {
    const agencyId = await this.getUserAgencyId(session.user.id);
    const isHostUser = await this.isHost(session.user.id);

    // Verificar que la experiencia existe y pertenece al usuario
    const existingTrip = await this.prisma.trip.findUnique({
      where: { idTrip: BigInt(id) },
    });

    if (!existingTrip) {
      throw new NotFoundException('Experiencia no encontrada');
    }

    // Verificar que sea una experiencia
    if (existingTrip.type !== 'EXPERIENCE') {
      throw new BadRequestException('Este endpoint solo funciona para experiencias');
    }

    // Verificar permisos
    if (agencyId && existingTrip.idAgency?.toString() !== agencyId.toString()) {
      throw new ForbiddenException('No tienes permiso para cambiar el estado de esta experiencia');
    }
    if (!agencyId && existingTrip.idHost !== session.user.id) {
      throw new ForbiddenException('No tienes permiso para cambiar el estado de esta experiencia');
    }

    // Preparar los datos de actualización
    const updateData: any = {
      status: dto.status,
    };

    // Si el status cambia a PUBLISHED, establecer publishedAt y activar
    if (dto.status === 'PUBLISHED' && existingTrip.status !== 'PUBLISHED') {
      updateData.publishedAt = new Date();
      updateData.isActive = true;
    }

    const updatedTrip = await this.prisma.trip.update({
      where: { idTrip: BigInt(id) },
      data: updateData,
    });

    return {
      message: `Estado de la experiencia cambiado a ${dto.status}`,
      data: updatedTrip,
    };
  }

  /**
   * Activa o desactiva una experiencia
   * IMPORTANTE: Esta ruta debe ir ANTES de ':id' para que NestJS la capture correctamente
   */
  @Put(':id/active')
  async toggleExperienceActive(
    @Param('id') id: string,
    @Body() dto: ToggleTripActiveDto,
    @Session() session: UserSession,
  ) {
    const agencyId = await this.getUserAgencyId(session.user.id);
    const isHostUser = await this.isHost(session.user.id);

    // Verificar que la experiencia existe y pertenece al usuario
    const existingTrip = await this.prisma.trip.findUnique({
      where: { idTrip: BigInt(id) },
    });

    if (!existingTrip) {
      throw new NotFoundException('Experiencia no encontrada');
    }

    // Verificar que sea una experiencia
    if (existingTrip.type !== 'EXPERIENCE') {
      throw new BadRequestException('Este endpoint solo funciona para experiencias');
    }

    // Verificar permisos
    if (agencyId && existingTrip.idAgency?.toString() !== agencyId.toString()) {
      throw new ForbiddenException('No tienes permiso para activar/desactivar esta experiencia');
    }
    if (!agencyId && existingTrip.idHost !== session.user.id) {
      throw new ForbiddenException('No tienes permiso para activar/desactivar esta experiencia');
    }

    const updatedTrip = await this.prisma.trip.update({
      where: { idTrip: BigInt(id) },
      data: { isActive: dto.isActive },
    });

    return {
      message: `Experiencia ${dto.isActive ? 'activada' : 'desactivada'} exitosamente`,
      data: updatedTrip,
    };
  }

  /**
   * Obtiene estadísticas de una experiencia
   * IMPORTANTE: Esta ruta debe ir ANTES de ':id' para que NestJS la capture correctamente
   */
  @Get(':id/stats')
  async getExperienceStats(
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    const agencyId = await this.getUserAgencyId(session.user.id);
    const isHostUser = await this.isHost(session.user.id);

    // Verificar que la experiencia existe y pertenece al usuario
    const existingTrip = await this.prisma.trip.findUnique({
      where: { idTrip: BigInt(id) },
    });

    if (!existingTrip) {
      throw new NotFoundException('Experiencia no encontrada');
    }

    // Verificar que sea una experiencia
    if (existingTrip.type !== 'EXPERIENCE') {
      throw new BadRequestException('Este endpoint solo funciona para experiencias');
    }

    if (agencyId && existingTrip.idAgency?.toString() !== agencyId.toString()) {
      throw new ForbiddenException('No tienes permiso para ver estadísticas de esta experiencia');
    }
    if (!agencyId && existingTrip.idHost !== session.user.id) {
      throw new ForbiddenException('No tienes permiso para ver estadísticas de esta experiencia');
    }

    const stats = await this.getTripStatsUseCase.execute({
      tripId: BigInt(id),
      agencyId: agencyId || undefined,
      userId: session.user.id,
      isHost: !agencyId && isHostUser, // Es host si no hay agencyId y es host
    });

    return stats;
  }

  /**
   * Obtiene los comentarios/reviews de una experiencia
   * IMPORTANTE: Esta ruta debe ir ANTES de ':id' para que NestJS la capture correctamente
   */
  @Get(':id/reviews')
  async getExperienceReviews(
    @Param('id') id: string,
    @Session() session: UserSession,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const agencyId = await this.getUserAgencyId(session.user.id);
    const isHostUser = await this.isHost(session.user.id);

    // Verificar que la experiencia existe y pertenece al usuario
    const existingTrip = await this.prisma.trip.findUnique({
      where: { idTrip: BigInt(id) },
    });

    if (!existingTrip) {
      throw new NotFoundException('Experiencia no encontrada');
    }

    // Verificar que sea una experiencia
    if (existingTrip.type !== 'EXPERIENCE') {
      throw new BadRequestException('Este endpoint solo funciona para experiencias');
    }

    if (agencyId && existingTrip.idAgency?.toString() !== agencyId.toString()) {
      throw new ForbiddenException('No tienes permiso para ver comentarios de esta experiencia');
    }
    if (!agencyId && existingTrip.idHost !== session.user.id) {
      throw new ForbiddenException('No tienes permiso para ver comentarios de esta experiencia');
    }

    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    const reviews = await this.listTripReviewsUseCase.execute({
      idTrip: BigInt(id),
      page: pageNum,
      limit: limitNum,
    });

    return reviews;
  }

  /**
   * Elimina una experiencia
   * IMPORTANTE: Esta ruta debe ir ANTES de ':id' para que NestJS la capture correctamente
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteExperience(
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    const agencyId = await this.getUserAgencyId(session.user.id);
    const isHostUser = await this.isHost(session.user.id);

    // Verificar que la experiencia existe y pertenece al usuario
    const existingTrip = await this.prisma.trip.findUnique({
      where: { idTrip: BigInt(id) },
    });

    if (!existingTrip) {
      throw new NotFoundException('Experiencia no encontrada');
    }

    // Verificar que sea una experiencia
    if (existingTrip.type !== 'EXPERIENCE') {
      throw new BadRequestException('Este endpoint solo funciona para experiencias');
    }

    if (agencyId && existingTrip.idAgency?.toString() !== agencyId.toString()) {
      throw new ForbiddenException('No tienes permiso para eliminar esta experiencia');
    }
    if (!agencyId && existingTrip.idHost !== session.user.id) {
      throw new ForbiddenException('No tienes permiso para eliminar esta experiencia');
    }

    await this.deleteTripUseCase.execute(
      agencyId || BigInt(0),
      BigInt(id),
      session.user.id,
      !agencyId, // isHost: true si no hay agencyId
    );
  }

  /**
   * Obtiene una experiencia por ID con información completa
   */
  @Get(':id')
  async getExperienceById(
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    const agencyId = await this.getUserAgencyId(session.user.id);
    const isHostUser = await this.isHost(session.user.id);

    const trip = await this.prisma.trip.findUnique({
      where: { idTrip: BigInt(id) },
      include: {
        city: true,
        agency: {
          select: {
            idAgency: true,
            nameAgency: true,
            picture: true,
          },
        },
        host: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        promoter: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        galleryImages: {
          orderBy: { order: 'asc' },
        },
        routePoints: {
          orderBy: { order: 'asc' },
        },
        discountCodes: {
          where: {
            active: true,
          },
        },
        bookings: {
          where: {
            status: {
              not: 'CANCELLED',
            },
          },
          select: {
            idBooking: true,
            totalBuy: true,
            currency: true,
          },
        },
        reviews: {
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10, // Últimas 10 reseñas
        },
        _count: {
          select: {
            bookings: true,
            reviews: true,
            favorites: true,
          },
        },
      },
    });

    if (!trip) {
      throw new NotFoundException('Experiencia no encontrada');
    }

    // Verificar que sea una experiencia
    if (trip.type !== 'EXPERIENCE') {
      throw new BadRequestException('Este endpoint solo funciona para experiencias');
    }

    // Verificar permisos: debe pertenecer a la agencia del usuario o ser el host
    if (agencyId && trip.idAgency?.toString() !== agencyId.toString()) {
      throw new ForbiddenException('No tienes permiso para ver esta experiencia');
    }
    if (!agencyId && trip.idHost !== session.user.id) {
      throw new ForbiddenException('No tienes permiso para ver esta experiencia');
    }

    // Calcular estadísticas
    const tripAny = trip as any;
    const totalRevenue = (tripAny.bookings || []).reduce((sum: number, booking: any) => {
      return sum + Number(booking.totalBuy);
    }, 0);

    const avgRating =
      (tripAny.reviews || []).length > 0
        ? (tripAny.reviews || []).reduce((sum: number, review: any) => sum + review.rating, 0) / (tripAny.reviews || []).length
        : 0;

    return {
      data: {
        ...tripAny,
        idTrip: trip.idTrip.toString(),
        idAgency: trip.idAgency?.toString(),
        idHost: trip.idHost,
        idCity: trip.idCity.toString(),
        price: trip.price ? Number(trip.price) : null,
        stats: {
          totalBookings: tripAny._count?.bookings || 0,
          totalReviews: tripAny._count?.reviews || 0,
          totalFavorites: tripAny._count?.favorites || 0,
          totalRevenue,
          averageRating: Math.round(avgRating * 10) / 10,
        },
      },
    };
  }

  /**
   * Actualiza una experiencia existente
   */
  @Patch(':id')
  @UseInterceptors(
    FilesInterceptor('galleryImages', 20),
    ParseJsonFieldInterceptor,
  )
  async updateExperience(
    @Param('id') id: string,
    @Body() dto: UpdateTripDto,
    @UploadedFiles() files: any[],
    @Session() session: UserSession,
  ) {
    const agencyId = await this.getUserAgencyId(session.user.id);
    const isHostUser = await this.isHost(session.user.id);

    // Verificar que la experiencia existe y pertenece al usuario
    const existingTrip = await this.prisma.trip.findUnique({
      where: { idTrip: BigInt(id) },
    });

    if (!existingTrip) {
      throw new NotFoundException('Experiencia no encontrada');
    }

    if (agencyId && existingTrip.idAgency?.toString() !== agencyId.toString()) {
      throw new ForbiddenException('No tienes permiso para editar esta experiencia');
    }
    if (!agencyId && existingTrip.idHost !== session.user.id) {
      throw new ForbiddenException('No tienes permiso para editar esta experiencia');
    }

    // Subir imágenes a S3 si hay archivos
    let uploadedImageUrls: string[] = [];
    if (files && files.length > 0) {
      uploadedImageUrls = await this.s3Service.uploadMultipleImages(files, 'experiences');
    }

    // Procesar imágenes
    if (uploadedImageUrls.length > 0 && dto.galleryImages) {
      const combinedImages = uploadedImageUrls.map((url, index) => ({
        imageUrl: url,
        order: dto.galleryImages?.[index]?.order ?? index,
      }));
      const existingImages = (dto.galleryImages || []).slice(uploadedImageUrls.length);
      dto.galleryImages = [...combinedImages, ...existingImages];
    } else if (uploadedImageUrls.length > 0) {
      dto.galleryImages = uploadedImageUrls.map((url, index) => ({
        imageUrl: url,
        order: index,
      }));
    }

    const trip = await this.updateTripUseCase.execute(
      agencyId || BigInt(0), // Si es host, pasar 0
      BigInt(id),
      dto,
      session.user.id,
      !agencyId, // isHost: true si no hay agencyId
    );

    return {
      message: 'Experiencia actualizada exitosamente',
      data: trip,
    };
  }

}
