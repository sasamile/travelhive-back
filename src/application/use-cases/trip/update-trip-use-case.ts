import { Injectable, Inject, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ITripRepository } from '../../../domain/ports/trip.repository.port';
import type { IAgencyMemberRepository } from '../../../domain/ports/agency.repository.port';
import { TRIP_REPOSITORY, AGENCY_MEMBER_REPOSITORY } from '../../../domain/ports/tokens';
import { Trip, TripStatus, TripCategory } from '../../../domain/entities/trip.entity';
import { UpdateTripDto } from '../../../presentation/dto/update-trip.dto';

@Injectable()
export class UpdateTripUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY)
    private readonly tripRepository: ITripRepository,
    @Inject(AGENCY_MEMBER_REPOSITORY)
    private readonly agencyMemberRepository: IAgencyMemberRepository,
  ) {}

  async execute(
    agencyId: bigint,
    tripId: bigint,
    data: UpdateTripDto,
    userId: string,
  ): Promise<Trip> {
    // Verificar que el trip exista y pertenezca a la agencia
    const trip = await this.tripRepository.findByAgencyAndId(agencyId, tripId);
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

    const updateData: Partial<Trip> = {
      ...(data.idCity && { idCity: BigInt(data.idCity) }),
      ...(data.title && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.category && { category: data.category as TripCategory }),
      ...(data.destinationRegion !== undefined && { destinationRegion: data.destinationRegion }),
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

    const updatedTrip = await this.tripRepository.update(tripId, updateData);
    return updatedTrip;
  }
}
