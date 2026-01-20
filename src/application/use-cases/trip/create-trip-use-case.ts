import { Injectable, Inject, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ITripRepository } from '../../../domain/ports/trip.repository.port';
import type { IAgencyMemberRepository } from '../../../domain/ports/agency.repository.port';
import { TRIP_REPOSITORY, AGENCY_MEMBER_REPOSITORY } from '../../../domain/ports/tokens';
import { Trip, TripStatus } from '../../../domain/entities/trip.entity';

export interface CreateTripDto {
  idAgency: bigint;
  idCity: bigint;
  title: string;
  description?: string;
  category: string;
  vibe?: string;
  durationDays: number;
  durationNights: number;
  coverImage?: string;
  status?: TripStatus;
}

@Injectable()
export class CreateTripUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY)
    private readonly tripRepository: ITripRepository,
    @Inject(AGENCY_MEMBER_REPOSITORY)
    private readonly agencyMemberRepository: IAgencyMemberRepository,
  ) {}

  async execute(data: CreateTripDto, userId: string): Promise<Trip> {
    // Verificar que el usuario pertenezca a la agencia
    const membership = await this.agencyMemberRepository.findByAgencyAndUser(
      data.idAgency,
      userId,
    );
    if (!membership) {
      throw new ForbiddenException('No tienes permiso para crear trips en esta agencia');
    }

    // Verificar que el usuario tenga rol de admin o editor
    if (!['admin', 'editor'].includes(membership.role)) {
      throw new ForbiddenException('Solo administradores y editores pueden crear trips');
    }

    const trip = await this.tripRepository.create({
      ...data,
      status: data.status || TripStatus.DRAFT,
    });

    return trip;
  }
}
