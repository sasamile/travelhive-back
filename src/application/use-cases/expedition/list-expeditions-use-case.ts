import { Injectable, Inject, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { IExpeditionRepository } from '../../../domain/ports/expedition.repository.port';
import type { ITripRepository } from '../../../domain/ports/trip.repository.port';
import type { IAgencyMemberRepository } from '../../../domain/ports/agency.repository.port';
import { EXPEDITION_REPOSITORY, TRIP_REPOSITORY, AGENCY_MEMBER_REPOSITORY } from '../../../domain/ports/tokens';
import { Expedition } from '../../../domain/entities/expedition.entity';

@Injectable()
export class ListExpeditionsUseCase {
  constructor(
    @Inject(EXPEDITION_REPOSITORY)
    private readonly expeditionRepository: IExpeditionRepository,
    @Inject(TRIP_REPOSITORY)
    private readonly tripRepository: ITripRepository,
    @Inject(AGENCY_MEMBER_REPOSITORY)
    private readonly agencyMemberRepository: IAgencyMemberRepository,
  ) {}

  async execute(tripId: bigint, userId: string): Promise<Expedition[]> {
    // Verificar que el trip exista
    const trip = await this.tripRepository.findById(tripId);
    if (!trip) {
      throw new NotFoundException('Trip no encontrado');
    }

    // Verificar permisos: debe ser agencia o host del trip
    if (trip.idAgency) {
      // Es una agencia, verificar membresía
      const membership = await this.agencyMemberRepository.findByAgencyAndUser(
        trip.idAgency,
        userId,
      );
      if (!membership) {
        throw new ForbiddenException('No tienes permiso para ver las expediciones de esta agencia');
      }
    } else if (trip.idHost) {
      // Es un host, verificar que sea el dueño
      if (trip.idHost !== userId) {
        throw new ForbiddenException('No tienes permiso para ver las expediciones de esta experiencia');
      }
    } else {
      throw new ForbiddenException('Trip no tiene agencia ni host asociado');
    }

    const expeditions = await this.expeditionRepository.findByTrip(tripId);
    return expeditions;
  }
}
