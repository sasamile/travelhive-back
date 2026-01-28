import { Injectable, Inject, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import type { ITripRepository } from '../../../domain/ports/trip.repository.port';
import type { IAgencyMemberRepository } from '../../../domain/ports/agency.repository.port';
import { TRIP_REPOSITORY, AGENCY_MEMBER_REPOSITORY } from '../../../domain/ports/tokens';
import { Trip, TripStatus, TripCategory } from '../../../domain/entities/trip.entity';
import { UpdateTripDto } from '../../../presentation/dto/update-trip.dto';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';

@Injectable()
export class UpdateTripUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY)
    private readonly tripRepository: ITripRepository,
    @Inject(AGENCY_MEMBER_REPOSITORY)
    private readonly agencyMemberRepository: IAgencyMemberRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    agencyId: bigint,
    tripId: bigint,
    data: UpdateTripDto,
    userId: string,
    isHost?: boolean,
  ): Promise<Trip> {
    // Verificar que el trip exista
    let trip: Trip | null = null;
    
    if (isHost || agencyId === BigInt(0)) {
      // Si es host, buscar por idHost
      trip = await this.tripRepository.findById(tripId);
      if (!trip) {
        throw new NotFoundException('Trip no encontrado');
      }
      // Verificar que el trip pertenezca al host
      if (trip.idHost !== userId) {
        throw new ForbiddenException('No tienes permiso para actualizar esta experiencia');
      }
    } else {
      // Si es agencia, buscar por agencia
      trip = await this.tripRepository.findByAgencyAndId(agencyId, tripId);
      if (!trip) {
        throw new NotFoundException('Trip no encontrado');
      }

      // Verificar que el usuario pertenezca a la agencia
      const membership = await this.agencyMemberRepository.findByAgencyAndUser(agencyId, userId);
      if (!membership) {
        throw new ForbiddenException('No tienes permiso para actualizar trips de esta agencia');
      }

      // Verificar que el usuario tenga rol de admin o editor
      if (!['admin', 'editor'].includes(membership.role)) {
        throw new ForbiddenException('Solo administradores y editores pueden actualizar trips');
      }
    }

    const updateData: Partial<Trip> = {
      ...(data.idCity && { idCity: BigInt(data.idCity) }),
      ...(data.title && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.category && { category: data.category as TripCategory }),
      ...(data.destinationRegion !== undefined && { destinationRegion: data.destinationRegion }),
      ...(data.location !== undefined && { location: data.location }),
      ...(data.type && { type: data.type as any }),
      ...(data.latitude !== undefined && { latitude: data.latitude }),
      ...(data.longitude !== undefined && { longitude: data.longitude }),
      ...(data.startDate && { startDate: new Date(data.startDate) }),
      ...(data.endDate && { endDate: new Date(data.endDate) }),
      ...(data.durationDays !== undefined && { durationDays: data.durationDays }),
      ...(data.durationNights !== undefined && { durationNights: data.durationNights }),
      ...(data.price !== undefined && { price: data.price }),
      ...(data.currency && { currency: data.currency }),
      ...(data.priceType && { priceType: data.priceType }),
      ...(data.maxPersons !== undefined && { maxPersons: data.maxPersons }),
      ...(data.coverImageIndex !== undefined && {
        coverImageIndex: data.coverImageIndex,
        coverImage:
          data.galleryImages && data.coverImageIndex !== undefined
            ? data.galleryImages[data.coverImageIndex]?.imageUrl
            : undefined,
      }),
      ...(data.status && { status: data.status }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.routePoints && { routePoints: data.routePoints }),
      ...(data.galleryImages && { galleryImages: data.galleryImages }),
      ...(data.itinerary && { itineraryDays: data.itinerary }),
    };

    // Si el status cambia a PUBLISHED, establecer publishedAt
    if (data.status === TripStatus.PUBLISHED && trip.status !== TripStatus.PUBLISHED) {
      updateData.publishedAt = new Date();
    }

    // Manejar promoter: buscar existente o crear nuevo (solo para agencias)
    let promoterId: bigint | undefined = undefined;
    if (!isHost && agencyId !== BigInt(0) && data.promoterCode !== undefined) {
      if (data.promoterCode === null || data.promoterCode === '') {
        // Si se envía vacío, remover el promoter
        promoterId = undefined;
      } else {
        // Buscar promoter existente por código
        const existingPromoter = await this.prisma.promoter.findUnique({
          where: { code: data.promoterCode },
        });
        
        if (existingPromoter) {
          if (existingPromoter.idAgency !== agencyId) {
            throw new BadRequestException('El promoter no pertenece a tu agencia');
          }
          promoterId = existingPromoter.id;
        } else if (data.promoterName) {
          // Crear nuevo promoter
          const newPromoter = await this.prisma.promoter.create({
            data: {
              idAgency: agencyId,
              code: data.promoterCode,
              name: data.promoterName,
              isActive: true,
            },
          });
          promoterId = newPromoter.id;
        } else {
          throw new BadRequestException('Si proporcionas un código de promoter nuevo, debes incluir el nombre');
        }
      }
      updateData.idPromoter = promoterId;
    }

    const updatedTrip = await this.tripRepository.update(tripId, updateData);

    // Manejar códigos de descuento si se proporcionaron (para agencias y hosts)
    if (data.discountCodes !== undefined) {
      // Eliminar códigos de descuento existentes del trip
      await this.prisma.discountCode.deleteMany({
        where: { idTrip: tripId },
      });

      // Crear nuevos códigos de descuento si se proporcionaron
      if (data.discountCodes.length > 0) {
        await Promise.all(
          data.discountCodes.map((discountCode) =>
            this.prisma.discountCode.create({
              data: {
                codeName: discountCode.code,
                discountType: 'PERCENTAGE',
                value: discountCode.percentage,
                maxUses: discountCode.maxUses,
                perUserLimit: discountCode.perUserLimit,
                idAgency: (isHost || agencyId === BigInt(0)) ? null : agencyId, // null si es host
                idTrip: tripId,
                active: true,
              },
            }),
          ),
        );
      }
    }

    // Recargar el trip con relaciones para devolverlo completo
    const tripWithRelations = await this.tripRepository.findById(tripId);
    if (!tripWithRelations) {
      throw new NotFoundException('Error al actualizar el viaje');
    }

    return tripWithRelations;
  }
}
