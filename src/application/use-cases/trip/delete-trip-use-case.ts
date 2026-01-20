import { Injectable, Inject, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ITripRepository } from '../../../domain/ports/trip.repository.port';
import type { IAgencyMemberRepository } from '../../../domain/ports/agency.repository.port';
import { TRIP_REPOSITORY, AGENCY_MEMBER_REPOSITORY } from '../../../domain/ports/tokens';

@Injectable()
export class DeleteTripUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY)
    private readonly tripRepository: ITripRepository,
    @Inject(AGENCY_MEMBER_REPOSITORY)
    private readonly agencyMemberRepository: IAgencyMemberRepository,
  ) {}

  async execute(agencyId: bigint, tripId: bigint, userId: string): Promise<void> {
    // Verificar que el trip exista y pertenezca a la agencia
    const trip = await this.tripRepository.findByAgencyAndId(agencyId, tripId);
    if (!trip) {
      throw new NotFoundException('Trip no encontrado');
    }

    // Verificar que el usuario pertenezca a la agencia
    const membership = await this.agencyMemberRepository.findByAgencyAndUser(agencyId, userId);
    if (!membership) {
      throw new ForbiddenException('No tienes permiso para eliminar trips de esta agencia');
    }

    // Solo administradores pueden eliminar trips
    if (membership.role !== 'admin') {
      throw new ForbiddenException('Solo administradores pueden eliminar trips');
    }

    await this.tripRepository.delete(tripId);
  }
}
