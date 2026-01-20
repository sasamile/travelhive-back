import { Injectable, Inject, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ITripRepository } from '../../../domain/ports/trip.repository.port';
import type { IAgencyMemberRepository } from '../../../domain/ports/agency.repository.port';
import { TRIP_REPOSITORY, AGENCY_MEMBER_REPOSITORY } from '../../../domain/ports/tokens';
import { Trip, TripStatus } from '../../../domain/entities/trip.entity';

export interface UpdateTripDto {
  title?: string;
  description?: string;
  category?: string;
  vibe?: string;
  durationDays?: number;
  durationNights?: number;
  coverImage?: string;
  status?: TripStatus;
  idCity?: bigint;
}

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

    const updatedTrip = await this.tripRepository.update(tripId, {
      ...data,
      status: data.status as TripStatus | undefined,
    });
    return updatedTrip;
  }
}
