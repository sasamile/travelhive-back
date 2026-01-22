import { Injectable, Inject, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ITripRepository } from '../../../domain/ports/trip.repository.port';
import type { IAgencyMemberRepository } from '../../../domain/ports/agency.repository.port';
import { TRIP_REPOSITORY, AGENCY_MEMBER_REPOSITORY } from '../../../domain/ports/tokens';
import { Trip, TripStatus } from '../../../domain/entities/trip.entity';

@Injectable()
export class ChangeTripStatusUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY)
    private readonly tripRepository: ITripRepository,
    @Inject(AGENCY_MEMBER_REPOSITORY)
    private readonly agencyMemberRepository: IAgencyMemberRepository,
  ) {}

  async execute(
    agencyId: bigint,
    tripId: bigint,
    status: TripStatus,
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
      throw new ForbiddenException('No tienes permiso para cambiar el estado de trips de esta agencia');
    }

    // Verificar que el usuario tenga rol de admin o editor
    if (!['admin', 'editor'].includes(membership.role)) {
      throw new ForbiddenException('Solo administradores y editores pueden cambiar el estado de trips');
    }

    // Preparar los datos de actualización
    const updateData: Partial<Trip> = {
      status,
    };

    // Si el status cambia a PUBLISHED, establecer publishedAt y activar el trip
    if (status === TripStatus.PUBLISHED && trip.status !== TripStatus.PUBLISHED) {
      updateData.publishedAt = new Date();
      updateData.isActive = true; // Activar automáticamente al publicar
    }

    const updatedTrip = await this.tripRepository.update(tripId, updateData);
    return updatedTrip;
  }
}
