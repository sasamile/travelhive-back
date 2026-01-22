import { Injectable, Inject, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import type { ITripRepository } from '../../../domain/ports/trip.repository.port';
import type { IAgencyMemberRepository } from '../../../domain/ports/agency.repository.port';
import { TRIP_REPOSITORY, AGENCY_MEMBER_REPOSITORY } from '../../../domain/ports/tokens';
import { Trip, TripStatus, TripCategory } from '../../../domain/entities/trip.entity';
import { CreateTripDto } from '../../../presentation/dto/create-trip.dto';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';

@Injectable()
export class CreateTripUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY)
    private readonly tripRepository: ITripRepository,
    @Inject(AGENCY_MEMBER_REPOSITORY)
    private readonly agencyMemberRepository: IAgencyMemberRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(data: CreateTripDto, userId: string): Promise<Trip> {
    // Verificar que idAgency esté presente (debe venir del controlador)
    if (!data.idAgency) {
      throw new BadRequestException('idAgency is required');
    }

    // Convertir string a BigInt para la búsqueda (evita pérdida de precisión)
    const agencyIdBigInt = BigInt(data.idAgency);
    
    // Verificar que el usuario pertenezca a la agencia
    const membership = await this.agencyMemberRepository.findByAgencyAndUser(
      agencyIdBigInt,
      userId,
    );
    if (!membership) {
      const userAgencies = await this.agencyMemberRepository.findUserAgencies(userId);
      throw new ForbiddenException(
        `No tienes permiso para crear trips en esta agencia. ` +
        `AgencyId recibido: ${data.idAgency}, UserId: ${userId}. ` +
        `Agencias del usuario: ${userAgencies.map(a => a.idAgency.toString()).join(', ')}`
      );
    }

    // Verificar que el usuario tenga rol de admin o editor
    if (!['admin', 'editor'].includes(membership.role)) {
      throw new ForbiddenException('Solo administradores y editores pueden crear trips');
    }

    // Convertir string a BigInt para idCity (evita pérdida de precisión)
    const cityIdBigInt = BigInt(data.idCity);
    
    // Verificar que la ciudad existe
    const city = await this.prisma.city.findUnique({
      where: { idCity: cityIdBigInt },
    });
    
    if (!city) {
      throw new NotFoundException(`La ciudad con ID ${data.idCity} no existe`);
    }

    const trip = await this.tripRepository.create({
      idAgency: agencyIdBigInt,
      idCity: cityIdBigInt,
      title: data.title,
      description: data.description,
      category: data.category as TripCategory,
      destinationRegion: data.destinationRegion,
      latitude: data.latitude,
      longitude: data.longitude,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      durationDays: data.durationDays,
      durationNights: data.durationNights,
      price: data.price,
      currency: data.currency,
      priceType: data.priceType,
      maxPersons: data.maxPersons,
      coverImage: data.galleryImages && data.coverImageIndex !== undefined
        ? data.galleryImages[data.coverImageIndex]?.imageUrl
        : undefined,
      coverImageIndex: data.coverImageIndex,
      status: data.status || TripStatus.DRAFT,
      isActive: data.isActive ?? true,
      publishedAt: data.status === TripStatus.PUBLISHED ? new Date() : undefined,
      routePoints: data.routePoints,
      galleryImages: data.galleryImages,
      itineraryDays: data.itinerary,
    });

    return trip;
  }
}
